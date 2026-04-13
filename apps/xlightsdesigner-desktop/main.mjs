import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import os from "node:os";
import {
  ensureProjectStructure,
  buildAnalysisArtifactPaths,
  listTrackLibrarySummaries,
  updateTrackLibraryRecordIdentity,
  readAnalysisArtifactFromProject,
  readAnalysisArtifactFromLibrary,
  writeAnalysisArtifactToProject,
  writeAnalysisArtifactToLibrary
} from "./renderer/storage/analysis-artifact-store.mjs";
import {
  readProjectArtifact,
  writeProjectArtifact,
  writeProjectArtifacts
} from "./renderer/storage/project-artifact-store.mjs";
import {
  readProjectFileRecord,
  writeProjectFileRecord,
  readSequenceSidecarFile,
  writeSequenceSidecarFile,
  saveReferenceMediaFile,
  createSequenceBackupFile,
  restoreSequenceBackupFile,
  listSequenceFilesInShowFolder,
  listMediaFilesInFolder
} from "./renderer/storage/project-workspace-store.mjs";
import {
  statFileRecord,
  readTrainingPackageAsset,
  appendAgentLogEntry,
  readAgentLogEntries
} from "./renderer/storage/support-file-store.mjs";
import {
  readMediaIdentityFromFile,
  applyMediaIdentityRecommendation
} from "./renderer/storage/media-identity-store.mjs";
import { sanitizeDesignerAssistantMessage } from "./designer-chat-sanitizer.mjs";
import {
  validateDirectSequencePromptState,
  validateDesignConceptState,
  validateWholeSequenceApplyState,
  validateComparativeLiveDesignState,
  buildXLightsSequenceState,
  buildXLightsTimingState,
  buildXLightsEffectOccupancyState
} from "./xlights-validation.mjs";
import {
  flushAutomationRequests,
  processAutomationRequestsOnce,
  createSingleFlightAutomationProcessor
} from "./automation-request-processor.mjs";
import { createLiveValidationSuites } from "./live-validation-suites.mjs";

const require = createRequire(import.meta.url);
const { app, BrowserWindow, dialog, ipcMain, powerSaveBlocker } = require("electron");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prevent macOS GPU helper crash loops on startup.
app.disableHardwareAcceleration();
// Work around helper/service crash loops on some unsigned local builds.
app.commandLine.appendSwitch("no-sandbox");
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-features", "NetworkService,NetworkServiceSandbox");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-renderer-backgrounding");
const XLD_USER_DATA_DIR = path.join(os.homedir(), "Library", "Application Support", "xlightsdesigner-desktop");
const STALE_XLD_USER_DATA_DIRS = [
  path.join(os.homedir(), "Library", "Application Support", "xlightsdesigner-desktop-v2")
];
app.setPath("userData", XLD_USER_DATA_DIR);
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

const UI_URL = String(process.env.XLD_UI_URL || "").trim();
const STATE_FILENAME = "xlightsdesigner-state.json";
const AGENT_APPLY_LOG_FILENAME = "xlightsdesigner-agent-apply-log.jsonl";
const AGENT_CONFIG_FILENAME = "xlightsdesigner-agent-config.json";
const PROJECTS_DIRNAME = "projects";
const OPENAI_BASE_URL = String(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").trim().replace(/\/+$/, "");
const OPENAI_MODEL = String(process.env.OPENAI_MODEL || "gpt-4.1-mini").trim();
const PACKAGED_RENDERER_ENTRY = path.join(__dirname, "renderer", "index.html");
const DEV_RENDERER_ENTRY = path.resolve(__dirname, "..", "xlightsdesigner-ui", "index.html");
let mainWindow = null;
const STARTUP_LOG = "/tmp/xld-desktop-main.log";
const AUTOMATION_CHANNEL = app.isPackaged ? "packaged" : "dev";
const AUTOMATION_ROOT = `/tmp/xld-automation-${AUTOMATION_CHANNEL}`;
const AUTOMATION_REQUESTS_DIR = path.join(AUTOMATION_ROOT, "requests");
const AUTOMATION_RESPONSES_DIR = path.join(AUTOMATION_ROOT, "responses");
const AUTOMATION_APP_LAUNCH_MS = Date.now();
let automationPollTimer = null;
let automationRequestProcessor = null;
let automationHeartbeatTimer = null;
let automationRequestWatcher = null;
let automationPowerSaveBlockerId = null;
let automationLastKickAtMs = 0;
let rendererAutomationReadyPromise = null;
const ANALYSIS_SERVICE_HOST = "127.0.0.1";
const ANALYSIS_SERVICE_PORT = "5055";
let analysisServiceProcess = null;
let analysisServiceStarting = null;
const MEDIA_IDENTITY_PROBE_CACHE = new Map();

function failOnStaleUserDataRoots() {
  const staleRoots = STALE_XLD_USER_DATA_DIRS.filter((dir) => dir && dir !== XLD_USER_DATA_DIR && fs.existsSync(dir));
  if (!staleRoots.length) return;
  const details = staleRoots.join(", ");
  logStartup(`app:userData staleRoots=${details}`);
  throw new Error(`Stale xLightsDesigner user-data root detected: ${details}. Remove stale roots and keep only ${XLD_USER_DATA_DIR}.`);
}

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized?.()) mainWindow.restore();
  mainWindow.show?.();
  mainWindow.focus?.();
});

function logStartup(message) {
  try {
    fs.appendFileSync(STARTUP_LOG, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // ignore logging failures
  }
}

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ensureAutomationDirs() {
  ensureDirSync(AUTOMATION_REQUESTS_DIR);
  ensureDirSync(AUTOMATION_RESPONSES_DIR);
}

function countJsonFiles(dir = "") {
  try {
    return fs.readdirSync(dir).filter((name) => String(name || "").endsWith(".json")).length;
  } catch {
    return 0;
  }
}

function automationResponsePath(id = "") {
  return path.join(AUTOMATION_RESPONSES_DIR, `${String(id || "").trim()}.json`);
}

function normalizeXLightsBody(raw = "") {
  const text = String(raw || "");
  const idx = text.indexOf("{");
  return idx >= 0 ? text.slice(idx) : text;
}

function runCurl(args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk || ""); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `curl exited with code ${code}`));
        return;
      }
      resolve(stdout);
    });
  });
}

function runBinary(command = "", args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(String(command || "").trim(), arr(args).map((row) => String(row)), { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk || ""); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function spawnSyncCompat(command = "", args = []) {
  const childProcess = require("node:child_process");
  const result = childProcess.spawnSync(String(command || "").trim(), arr(args).map((row) => String(row)), {
    encoding: "utf8"
  });
  if (result?.error) throw result.error;
  if (Number(result?.status) !== 0) {
    throw new Error(String(result?.stderr || `${command} exited with code ${result?.status}`));
  }
  return {
    stdout: String(result?.stdout || ""),
    stderr: String(result?.stderr || "")
  };
}


async function postXLightsCommand(endpoint = "", cmd = "", params = {}, options = {}) {
  const payload = JSON.stringify({
    apiVersion: 2,
    cmd,
    params,
    options
  });
  const raw = await runCurl([
    "-sS",
    "-H", "Content-Type: application/json",
    "--data-binary", payload,
    String(endpoint || "").trim()
  ]);
  const normalized = normalizeXLightsBody(raw);
  let json = null;
  try {
    json = JSON.parse(normalized);
  } catch (err) {
    throw new Error(`Invalid JSON from xLights endpoint (${err.message})`);
  }
  if (json?.res !== 200) {
    const code = json?.error?.code || "UNKNOWN";
    const message = json?.error?.message || json?.msg || "Command failed";
    throw new Error(`${cmd} failed (${code}): ${message}`);
  }
  return json;
}

async function getRendererValidationSnapshot() {
  return invokeRendererAutomation("getDirectSequenceValidationSnapshot", {});
}

async function getRendererSequencerValidationSnapshot() {
  return invokeRendererAutomation("getSequencerValidationSnapshot", {});
}

async function getRendererAgentRuntimeSnapshot() {
  return invokeRendererAutomation("getAgentRuntimeSnapshot", {});
}

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function nowMs() {
  return Date.now();
}

function buildEffectQueriesFromSequenceRows(rows = [], expected = {}) {
  const target = str(expected?.target || expected?.targetModelName);
  const section = str(expected?.section || expected?.expectedSectionLabel);
  const effectName = str(expected?.effectName || expected?.expectedEffectName);
  return arr(rows)
    .filter((row) => {
      if (target && str(row?.target) !== target) return false;
      if (section && str(row?.section) !== section) return false;
      if (effectName && !str(row?.summary).toLowerCase().includes(effectName.toLowerCase())) return false;
      return true;
    })
    .map((row) => ({
      modelName: str(row?.target),
      layerIndex: 0,
      effectName,
      startMs: null,
      endMs: null
    }))
    .filter((row) => row.modelName && row.effectName);
}

function buildEffectQueriesFromPlacements(placements = []) {
  return arr(placements)
    .map((row) => ({
      modelName: str(row?.targetId || row?.modelName),
      layerIndex: Number.isFinite(Number(row?.layerIndex)) ? Number(row.layerIndex) : null,
      effectName: str(row?.effectName),
      startMs: Number.isFinite(Number(row?.startMs)) ? Number(row.startMs) : null,
      endMs: Number.isFinite(Number(row?.endMs)) ? Number(row.endMs) : null
    }))
    .filter((row) => row.modelName && row.effectName);
}

async function readXLightsSequenceStateViaCurl(endpoint = "") {
  const [openResp, revisionResp, settingsResp, modelsResp, submodelsResp, displayResp, tracksResp] = await Promise.all([
    safePostXLightsCommand(endpoint, "sequence.getOpen", {}),
    safePostXLightsCommand(endpoint, "sequence.getRevision", {}),
    safePostXLightsCommand(endpoint, "sequence.getSettings", {}),
    safePostXLightsCommand(endpoint, "layout.getModels", {}),
    safePostXLightsCommand(endpoint, "layout.getSubmodels", {}),
    safePostXLightsCommand(endpoint, "layout.getDisplayElements", {}),
    safePostXLightsCommand(endpoint, "timing.getTracks", {})
  ]);

  return buildXLightsSequenceState({
    endpoint,
    openSequence: openResp?.ok !== false && openResp?.data?.isOpen ? openResp?.data?.sequence || null : null,
    revision: str(revisionResp?.ok !== false ? (revisionResp?.data?.revision || revisionResp?.data?.revisionToken || "unknown") : "unknown"),
    sequenceSettings: settingsResp?.ok !== false ? (settingsResp?.data || null) : null,
    models: modelsResp?.ok !== false ? arr(modelsResp?.data?.models) : [],
    submodels: submodelsResp?.ok !== false ? arr(submodelsResp?.data?.submodels) : [],
    displayElements: displayResp?.ok !== false ? arr(displayResp?.data?.elements) : [],
    timingState: buildXLightsTimingState({
      tracks: tracksResp?.ok !== false ? arr(tracksResp?.data?.tracks) : []
    })
  });
}

async function readXLightsEffectOccupancyStateViaCurl(endpoint = "", queries = []) {
  const effectsByQuery = {};
  for (const query of arr(queries)) {
    const key = [
      str(query?.modelName),
      query?.layerIndex == null ? "*" : String(query.layerIndex),
      query?.startMs == null ? "*" : String(query.startMs),
      query?.endMs == null ? "*" : String(query.endMs),
      str(query?.effectName || "*")
    ].join("|");
    const resp = await postXLightsCommand(endpoint, "effects.list", {
      modelName: query.modelName,
      layerIndex: query.layerIndex == null ? undefined : query.layerIndex,
      startMs: query.startMs == null ? undefined : query.startMs,
      endMs: query.endMs == null ? undefined : query.endMs
    });
    effectsByQuery[key] = arr(resp?.data?.effects);
  }
  return buildXLightsEffectOccupancyState({ queries, effectsByQuery });
}

async function safePostXLightsCommand(endpoint = "", command = "", payload = {}) {
  try {
    return await postXLightsCommand(endpoint, command, payload);
  } catch (error) {
    return {
      ok: false,
      error: String(error?.message || error || ""),
      command: str(command)
    };
  }
}

async function runDirectSequenceValidationFromDesktop(expected = {}) {
  const snapshot = await getRendererValidationSnapshot();
  const endpoint = str(snapshot?.endpoint);
  const pageStates = snapshot?.pageStates || {};
  const xlightsSequenceState = await readXLightsSequenceStateViaCurl(endpoint);
  const queries = buildEffectQueriesFromSequenceRows(pageStates?.sequence?.data?.rows || [], {
    target: expected?.target || expected?.targetModelName,
    section: expected?.section || expected?.expectedSectionLabel,
    effectName: expected?.effectName || expected?.expectedEffectName
  });
  const xlightsEffectOccupancyState = queries.length
    ? await readXLightsEffectOccupancyStateViaCurl(endpoint, queries)
    : null;
  const validation = validateDirectSequencePromptState({
    expected: {
      sequenceName: expected?.sequenceName,
      target: expected?.target || expected?.targetModelName,
      section: expected?.section || expected?.expectedSectionLabel,
      effectName: expected?.effectName || expected?.expectedEffectName,
      applied: expected?.applied === true
    },
    pageStates,
    xlightsSequenceState,
    xlightsEffectOccupancyState
  });
  return {
    contract: "direct_sequence_validation_run_v1",
    version: "1.0",
    pageStates,
    xlightsSequenceState,
    xlightsEffectOccupancyState,
    validation
  };
}

async function runDesignConceptValidationFromDesktop(expected = {}) {
  const snapshot = await getRendererValidationSnapshot();
  const endpoint = str(snapshot?.endpoint);
  const pageStates = snapshot?.pageStates || {};
  const xlightsSequenceState = await readXLightsSequenceStateViaCurl(endpoint);
  const expectedTargets = arr(expected?.targets).map((row) => str(row)).filter(Boolean);
  const expectedFamilies = arr(expected?.effectFamilies).map((row) => str(row)).filter(Boolean);
  const queries = [];
  for (const target of expectedTargets) {
    for (const effectName of expectedFamilies) {
      queries.push({
        modelName: target,
        layerIndex: null,
        startMs: null,
        endMs: null,
        effectName
      });
    }
  }
  const xlightsEffectOccupancyState = queries.length
    ? await readXLightsEffectOccupancyStateViaCurl(endpoint, queries)
    : null;
  const validation = validateDesignConceptState({
    expected,
    pageStates,
    xlightsSequenceState,
    xlightsEffectOccupancyState
  });
  return {
    contract: "design_concept_validation_run_v1",
    version: "1.0",
    pageStates,
    xlightsSequenceState,
    xlightsEffectOccupancyState,
    validation
  };
}

async function runWholeSequenceApplyValidationFromDesktop(expected = {}) {
  const snapshot = await getRendererValidationSnapshot();
  const endpoint = str(snapshot?.endpoint);
  const pageStates = snapshot?.pageStates || {};
  const xlightsSequenceState = await readXLightsSequenceStateViaCurl(endpoint);
  const placements = arr(snapshot?.handoffs?.intentHandoff?.executionStrategy?.effectPlacements);
  const queries = buildEffectQueriesFromPlacements(placements);
  const xlightsEffectOccupancyState = queries.length
    ? await readXLightsEffectOccupancyStateViaCurl(endpoint, queries)
    : null;
  const validation = validateWholeSequenceApplyState({
    expected,
    pageStates,
    xlightsSequenceState,
    xlightsEffectOccupancyState,
    effectPlacementCount: placements.length
  });
  return {
    contract: "whole_sequence_apply_validation_run_v1",
    version: "1.0",
    pageStates,
    effectPlacementCount: placements.length,
    xlightsSequenceState,
    xlightsEffectOccupancyState,
    validation
  };
}

async function runComparativeLiveDesignValidationFromDesktop(expected = {}) {
  const runStartedAtMs = nowMs();
  const strongPrompt = str(expected?.strongPrompt);
  const weakPrompt = str(expected?.weakPrompt);
  const sequencePath = str(expected?.sequencePath);
  if (!strongPrompt || !weakPrompt) {
    throw new Error("Comparative live validation requires both strongPrompt and weakPrompt.");
  }
  if (sequencePath) {
    const openStartedAtMs = nowMs();
    await openSequenceFromDesktop(sequencePath);
    expected.__timings = expected.__timings || {};
    expected.__timings.openSequenceMs = nowMs() - openStartedAtMs;
  }
  if (expected?.refreshFirst !== false) {
    const refreshStartedAtMs = nowMs();
    await invokeRendererAutomation("refreshFromXLights", {});
    expected.__timings = expected.__timings || {};
    expected.__timings.refreshMs = nowMs() - refreshStartedAtMs;
  }
  if (str(expected?.analyzePrompt)) {
    const analyzeStartedAtMs = nowMs();
    await invokeRendererAutomation("analyzeAudio", { prompt: str(expected.analyzePrompt) });
    expected.__timings = expected.__timings || {};
    expected.__timings.analyzeMs = nowMs() - analyzeStartedAtMs;
  }

  const safeComparativeSnapshot = async () => {
    try {
      return await invokeRendererAutomation("getComparativeValidationSnapshot", {});
    } catch (err) {
      return {
        ok: false,
        error: String(err?.message || err || "")
      };
    }
  };

  const strongGenerateStartedAtMs = nowMs();
  await invokeRendererAutomation("generateProposal", {
    prompt: strongPrompt,
    forceFresh: true,
    disableDesignerCloud: true,
    requestedRole: "designer_dialog",
    selectedSections: arr(expected?.sections),
    selectedTargetIds: arr(expected?.targets),
    selectedTagNames: arr(expected?.tagNames)
  });
  const strongSnapshot = await safeComparativeSnapshot();
  const strongGenerateMs = nowMs() - strongGenerateStartedAtMs;

  const weakGenerateStartedAtMs = nowMs();
  await invokeRendererAutomation("generateProposal", {
    prompt: weakPrompt,
    forceFresh: true,
    disableDesignerCloud: true,
    requestedRole: "designer_dialog",
    selectedSections: arr(expected?.sections),
    selectedTargetIds: arr(expected?.altTargets),
    selectedTagNames: arr(expected?.altTagNames)
  });
  const weakSnapshot = await safeComparativeSnapshot();
  const weakGenerateMs = nowMs() - weakGenerateStartedAtMs;

  const validation = validateComparativeLiveDesignState({
    expected,
    strong: {
      diagnose: strongSnapshot,
      pageStates: strongSnapshot?.pageStates || {}
    },
    weak: {
      diagnose: weakSnapshot,
      pageStates: weakSnapshot?.pageStates || {}
    }
  });

  return {
    contract: "comparative_live_design_validation_run_v1",
    version: "1.0",
    timings: {
      totalMs: nowMs() - runStartedAtMs,
      openSequenceMs: Number(expected?.__timings?.openSequenceMs || 0),
      refreshMs: Number(expected?.__timings?.refreshMs || 0),
      analyzeMs: Number(expected?.__timings?.analyzeMs || 0),
      strongGenerateMs,
      weakGenerateMs
    },
    comparison: validation?.metrics
      ? {
          strongScore: validation.metrics.strongScore,
          weakScore: validation.metrics.weakScore,
          preferred: validation.metrics.strongScore > validation.metrics.weakScore ? "strong" : "weak"
        }
      : null,
    strong: {
      diagnose: strongSnapshot,
      pageStates: strongSnapshot?.pageStates || {}
    },
    weak: {
      diagnose: weakSnapshot,
      pageStates: weakSnapshot?.pageStates || {}
    },
    validation
  };
}

const {
  runLiveDesignCanaryValidationFromDesktop,
  runLiveDesignValidationSuiteFromDesktop,
  runLiveRevisionPracticalSequenceValidationSuiteFromDesktop,
  runLiveSectionPracticalSequenceValidationSuiteFromDesktop,
  runLiveWholeSequencePracticalValidationSuiteFromDesktop,
  runLiveDesignCanarySuiteFromDesktop
} = createLiveValidationSuites({
  invokeRendererAutomation,
  getRendererAgentRuntimeSnapshot,
  runComparativeLiveDesignValidationFromDesktop,
  runWholeSequenceApplyValidationFromDesktop,
  validateDesignConceptState,
  logStartup,
  nowMs
});

async function openSequenceFromDesktop(sequencePath = "") {
  const file = str(sequencePath);
  if (!file) {
    throw new Error("sequencePath is required.");
  }
  try {
    const runtime = await getRendererAgentRuntimeSnapshot();
    const currentPath = str(runtime?.sequencePathInput);
    if (currentPath && currentPath === file) {
      return {
        ok: true,
        skipped: true,
        activeSequence: str(runtime?.activeSequence),
        sequencePath: file
      };
    }
  } catch {
    // best-effort precheck only
  }
  const opened = await invokeRendererAutomation("openSequence", {
    sequencePath: file
  });
  return {
    ok: true,
    activeSequence: str(opened?.activeSequence),
    sequencePath: file
  };
}

async function invokeRendererAutomation(action = "", payload = {}) {
  await waitForRendererAutomationReady();
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("xLightsDesigner window is not available");
  }
  const script = `(() => {
    const runtime = window.xLightsDesignerRuntime;
    if (!runtime || typeof runtime[${JSON.stringify(action)}] !== "function") {
      throw new Error("Renderer automation action unavailable: ${action}");
    }
    return runtime[${JSON.stringify(action)}](${JSON.stringify(payload)});
  })()`;
  return mainWindow.webContents.executeJavaScript(script, true);
}

async function getAutomationHealthSnapshot() {
  const mainHealth = {
    channel: AUTOMATION_CHANNEL,
    appReady: app.isReady(),
    mainWindowExists: Boolean(mainWindow && !mainWindow.isDestroyed()),
    mainWindowVisible: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible?.()),
    rendererLoadingMainFrame: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents?.isLoadingMainFrame?.()),
    automationPollTimerActive: Boolean(automationPollTimer),
    automationHeartbeatTimerActive: Boolean(automationHeartbeatTimer),
    automationRequestWatcherActive: Boolean(automationRequestWatcher),
    automationRequestProcessorActive: Boolean(automationRequestProcessor),
    automationPowerSaveBlockerActive: Boolean(
      automationPowerSaveBlockerId != null && powerSaveBlocker.isStarted?.(automationPowerSaveBlockerId)
    ),
    rendererAutomationReadyPromiseActive: Boolean(rendererAutomationReadyPromise),
    requestQueuePendingCount: countJsonFiles(AUTOMATION_REQUESTS_DIR),
    responseQueuePendingCount: countJsonFiles(AUTOMATION_RESPONSES_DIR),
    automationLastKickAtMs,
    automationLastKickAgeMs: automationLastKickAtMs > 0 ? Math.max(0, Date.now() - automationLastKickAtMs) : null,
    uptimeMs: Math.max(0, Date.now() - AUTOMATION_APP_LAUNCH_MS),
    timestamp: new Date().toISOString()
  };

  let renderer = null;
  try {
    renderer = await invokeRendererAutomation("getAutomationHealthSnapshot", {});
  } catch (err) {
    renderer = {
      ok: false,
      ready: false,
      error: String(err?.message || err)
    };
  }

  return {
    ok: true,
    main: mainHealth,
    renderer
  };
}

async function waitForRendererAutomationReady({ timeoutMs = 120000 } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error("xLightsDesigner window is not available");
  }
  if (rendererAutomationReadyPromise) {
    return rendererAutomationReadyPromise;
  }
  const targetWindow = mainWindow;
  rendererAutomationReadyPromise = (async () => {
    if (targetWindow.webContents.isLoadingMainFrame()) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("Renderer did not finish loading in time"));
        }, Math.min(timeoutMs, 60000));
        const onFinish = () => {
          cleanup();
          resolve();
        };
        const onFail = (_event, code, desc) => {
          cleanup();
          reject(new Error(`Renderer failed to load (${code}): ${desc}`));
        };
        function cleanup() {
          clearTimeout(timer);
          targetWindow.webContents.off("did-finish-load", onFinish);
          targetWindow.webContents.off("did-fail-load", onFail);
        }
        targetWindow.webContents.once("did-finish-load", onFinish);
        targetWindow.webContents.once("did-fail-load", onFail);
      });
    }
    const deadline = Date.now() + Math.max(1000, Number(timeoutMs || 0));
    while (Date.now() <= deadline) {
      if (!mainWindow || mainWindow !== targetWindow || targetWindow.isDestroyed()) {
        throw new Error("xLightsDesigner window is not available");
      }
      try {
        const ready = await targetWindow.webContents.executeJavaScript(`(() => {
          const runtime = window.xLightsDesignerRuntime;
          if (!runtime || typeof runtime.isAutomationReady !== "function") return false;
          try {
            const state = runtime.isAutomationReady();
            return Boolean(state && state.ready === true);
          } catch {
            return false;
          }
        })()`, true);
        if (ready) {
          return true;
        }
      } catch {
        // Keep polling until the renderer bootstrap finishes.
      }
      await sleep(250);
    }
    throw new Error("Renderer automation runtime did not become ready in time");
  })().catch((err) => {
    rendererAutomationReadyPromise = null;
    throw err;
  });
  return rendererAutomationReadyPromise;
}

async function processAutomationRequests() {
  ensureAutomationDirs();
  return processAutomationRequestsOnce({
    requestsDir: AUTOMATION_REQUESTS_DIR,
    responsePathForId: automationResponsePath,
    requestTimeoutMsForAction: ({ action }) => {
      if (action === "runLiveDesignValidationSuite") return 1800000;
      if (action === "runLiveSectionPracticalSequenceValidationSuite") return 1800000;
      if (action === "runLiveRevisionPracticalSequenceValidationSuite") return 1800000;
      if (action === "runLiveWholeSequencePracticalValidationSuite") return 1800000;
      if (action === "runLiveDesignCanarySuite") return 900000;
      if (action === "runLiveDesignCanaryValidation") return 300000;
      if (action === "runComparativeLiveDesignValidation") return 900000;
      if (action === "runWholeSequenceApplyValidation") return 900000;
      if (action === "runDesignConceptValidation") return 300000;
      if (action === "runDirectSequenceValidation") return 300000;
      if (action === "analyzeAudio") return 300000;
      return 120000;
    },
    onRequestStart: ({ id, action }) => {
      logStartup(`automation:request:start id=${id} action=${action || "missing"}`);
    },
    onRequestFinish: ({ id, action, ok, error }) => {
      logStartup(`automation:request:finish id=${id} action=${action || "missing"} ok=${ok ? "true" : "false"} error=${String(error || "")}`);
    },
    invokeAction: async ({ action, request }) => {
      if (action === "dispatchPrompt") {
        return invokeRendererAutomation("dispatchPrompt", String(request?.payload?.prompt || ""));
      }
      if (action === "generateProposal") {
        return invokeRendererAutomation("generateProposal", request?.payload || {});
      }
      if (action === "openSequence") {
        return invokeRendererAutomation("openSequence", request?.payload || {});
      }
      if (action === "setShowFolder") {
        return invokeRendererAutomation("setShowFolder", request?.payload || {});
      }
      if (action === "setAudioPath") {
        return invokeRendererAutomation("setAudioPath", request?.payload || {});
      }
      if (action === "ping") {
        return { ok: true, appReady: true };
      }
      if (action === "resetAutomationState") {
        return invokeRendererAutomation("resetAutomationState", request?.payload || {});
      }
      if (action === "refreshFromXLights") {
        return invokeRendererAutomation("refreshFromXLights", request?.payload || {});
      }
      if (action === "analyzeAudio") {
        return invokeRendererAutomation("analyzeAudio", request?.payload || {});
      }
      if (action === "seedTimingTracksFromAnalysis") {
        return invokeRendererAutomation("seedTimingTracksFromAnalysis", request?.payload || {});
      }
      if (action === "applyCurrentProposal") {
        return invokeRendererAutomation("applyCurrentProposal", request?.payload || {});
      }
      if (action === "diagnoseCurrentProposal") {
        return invokeRendererAutomation("diagnoseCurrentProposal", request?.payload || {});
      }
      if (action === "setRenderObservation") {
        return invokeRendererAutomation("setRenderObservation", request?.payload || {});
      }
      if (action === "getRenderFeedbackSnapshot") {
        return invokeRendererAutomation("getRenderFeedbackSnapshot", request?.payload || {});
      }
      if (action === "getAgentRuntimeSnapshot") {
        return invokeRendererAutomation("getAgentRuntimeSnapshot", request?.payload || {});
      }
      if (action === "getPageStatesSnapshot") {
        return invokeRendererAutomation("getPageStatesSnapshot", request?.payload || {});
      }
      if (action === "getSequencerValidationSnapshot") {
        return invokeRendererAutomation("getSequencerValidationSnapshot", request?.payload || {});
      }
      if (action === "getAutomationHealthSnapshot") {
        return getAutomationHealthSnapshot();
      }
      if (action === "runDirectSequenceValidation") {
        return runDirectSequenceValidationFromDesktop(request?.payload || {});
      }
      if (action === "runDesignConceptValidation") {
        return runDesignConceptValidationFromDesktop(request?.payload || {});
      }
      if (action === "runWholeSequenceApplyValidation") {
        return runWholeSequenceApplyValidationFromDesktop(request?.payload || {});
      }
      if (action === "runComparativeLiveDesignValidation") {
        return runComparativeLiveDesignValidationFromDesktop(request?.payload || {});
      }
      if (action === "runLiveDesignCanaryValidation") {
        return runLiveDesignCanaryValidationFromDesktop(request?.payload || {});
      }
      if (action === "runLiveDesignValidationSuite") {
        return runLiveDesignValidationSuiteFromDesktop(request?.payload || {});
      }
      if (action === "runLiveSectionPracticalSequenceValidationSuite") {
        return runLiveSectionPracticalSequenceValidationSuiteFromDesktop(request?.payload || {});
      }
      if (action === "runLiveRevisionPracticalSequenceValidationSuite") {
        return runLiveRevisionPracticalSequenceValidationSuiteFromDesktop(request?.payload || {});
      }
      if (action === "runLiveWholeSequencePracticalValidationSuite") {
        return runLiveWholeSequencePracticalValidationSuiteFromDesktop(request?.payload || {});
      }
      if (action === "runLiveDesignCanarySuite") {
        return runLiveDesignCanarySuiteFromDesktop(request?.payload || {});
      }
      throw new Error(`Unknown automation action: ${action || "missing"}`);
    }
  });
}

function kickAutomationProcessor(reason = "unspecified") {
  if (!automationRequestProcessor) return;
  automationLastKickAtMs = Date.now();
  logStartup(`automation:kick reason=${reason}`);
  automationRequestProcessor.processPending();
}

function startAutomationPolling() {
  ensureAutomationDirs();
  if (automationPowerSaveBlockerId == null || !powerSaveBlocker.isStarted(automationPowerSaveBlockerId)) {
    automationPowerSaveBlockerId = powerSaveBlocker.start("prevent-app-suspension");
    logStartup(`automation:powerSaveBlocker started id=${automationPowerSaveBlockerId}`);
  }
  flushAutomationRequests({
    requestsDir: AUTOMATION_REQUESTS_DIR,
    responsePathForId: automationResponsePath,
    reason: "Cleared stale automation request during app startup.",
    olderThanEpochMs: AUTOMATION_APP_LAUNCH_MS
  });
  if (automationPollTimer) return;
  if (!automationRequestProcessor) {
    automationRequestProcessor = createSingleFlightAutomationProcessor({
      processOnce: processAutomationRequests,
      onError: (err) => {
        logStartup(`automation:poll error=${String(err?.message || err)}`);
      }
    });
  }
  logStartup("automation:poll start");
  kickAutomationProcessor("startup");
  automationPollTimer = setInterval(() => {
    kickAutomationProcessor("interval");
  }, 1000);
  if (!automationHeartbeatTimer) {
    automationHeartbeatTimer = setInterval(() => {
      try {
        const pending = fs.readdirSync(AUTOMATION_REQUESTS_DIR).filter((name) => name.endsWith(".json")).length;
        const ageMs = automationLastKickAtMs > 0 ? Math.max(0, Date.now() - automationLastKickAtMs) : -1;
        if (pending > 0) {
          logStartup(`automation:heartbeat pending=${pending} lastKickAgeMs=${ageMs}`);
          kickAutomationProcessor("heartbeat");
        }
      } catch (err) {
        logStartup(`automation:heartbeat error=${String(err?.message || err)}`);
      }
    }, 5000);
  }
  if (!automationRequestWatcher) {
    try {
      automationRequestWatcher = fs.watch(AUTOMATION_REQUESTS_DIR, (_eventType, filename) => {
        const name = String(filename || "").trim();
        if (!name.endsWith(".json")) return;
        logStartup(`automation:watch event file=${name}`);
        kickAutomationProcessor(`watch:${name}`);
      });
    } catch (err) {
      logStartup(`automation:watch error=${String(err?.message || err)}`);
    }
  }
}

function resolveRendererEntry() {
  if (fs.existsSync(PACKAGED_RENDERER_ENTRY)) return PACKAGED_RENDERER_ENTRY;
  return DEV_RENDERER_ENTRY;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function candidateAnalysisServiceDirs() {
  const envDir = String(process.env.XLD_ANALYSIS_SERVICE_DIR || "").trim();
  const out = [];
  if (envDir) out.push(path.resolve(envDir));
  out.push(path.resolve(__dirname, "..", "xlightsdesigner-analysis-service"));
  out.push(path.resolve(process.cwd(), "apps", "xlightsdesigner-analysis-service"));
  out.push(path.resolve(os.homedir(), "Projects", "xLightsDesigner", "apps", "xlightsdesigner-analysis-service"));
  return Array.from(new Set(out));
}

function resolveAnalysisServiceDir() {
  for (const dir of candidateAnalysisServiceDirs()) {
    if (!dir) continue;
    const mainPy = path.join(dir, "main.py");
    if (fs.existsSync(mainPy)) return dir;
  }
  return "";
}

function candidateTrainingPackageDirs() {
  const envDir = String(process.env.XLD_TRAINING_PACKAGE_DIR || "").trim();
  const out = [];
  if (envDir) out.push(path.resolve(envDir));
  out.push(path.resolve(process.cwd(), "training-packages", "training-package-v1"));
  out.push(path.resolve(__dirname, "..", "..", "training-packages", "training-package-v1"));
  out.push(path.resolve(os.homedir(), "Projects", "xLightsDesigner", "training-packages", "training-package-v1"));
  return Array.from(new Set(out));
}

function resolveTrainingPackageDir() {
  for (const dir of candidateTrainingPackageDirs()) {
    if (!dir) continue;
    const manifest = path.join(dir, "manifest.json");
    if (fs.existsSync(manifest)) return dir;
  }
  return "";
}

function parsePythonCommand(raw) {
  const text = String(raw || "").trim();
  if (!text) return [];
  return text.split(/\s+/).filter(Boolean);
}

function resolveAnalysisPythonCommand() {
  const analysisDir = resolveAnalysisServiceDir();
  if (!analysisDir) return [];
  const envCmd = parsePythonCommand(process.env.XLD_ANALYSIS_PYTHON);
  if (envCmd.length) return envCmd;
  const venv310 = path.join(analysisDir, ".venv310", "bin", "python");
  if (fs.existsSync(venv310)) return [venv310];
  const venv = path.join(analysisDir, ".venv", "bin", "python");
  if (fs.existsSync(venv)) return [venv];
  return ["python3"];
}

async function probeAnalysisService(baseUrl, timeoutMs = 15000, headers = {}) {
  if (!baseUrl) return { ok: false, status: 0, error: "Missing analysis service baseUrl", data: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers,
      signal: controller.signal
    });
    const raw = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: String(parsed?.error || parsed?.message || raw || `HTTP ${response.status}`),
        data: parsed
      };
    }
    return { ok: true, status: response.status, error: "", data: parsed || {} };
  } catch (err) {
    const msg = err?.name === "AbortError"
      ? "Analysis service health check timed out."
      : String(err?.message || err);
    return { ok: false, status: 0, error: msg, data: null };
  } finally {
    clearTimeout(timer);
  }
}

function isManagedLocalAnalysisService(baseUrl = "") {
  try {
    const parsed = new URL(String(baseUrl || "").trim());
    const hostname = String(parsed.hostname || "").trim().toLowerCase();
    const port = String(parsed.port || "").trim();
    return (hostname === "127.0.0.1" || hostname === "localhost") && port === ANALYSIS_SERVICE_PORT;
  } catch {
    return false;
  }
}

function buildAnalysisServiceEnv() {
  const next = { ...process.env };
  const analysisDir = resolveAnalysisServiceDir();
  next.MPLCONFIGDIR = String(process.env.MPLCONFIGDIR || "/tmp/mplcache-xld");
  next.PYTHONUNBUFFERED = "1";
  const envFile = analysisDir ? path.join(analysisDir, ".env.local") : "";
  if (fs.existsSync(envFile)) {
    try {
      const lines = fs.readFileSync(envFile, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = String(line || "").trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx <= 0) continue;
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
        if (!next[k]) next[k] = v;
      }
    } catch {
      // best effort
    }
  }
  if (!next.ENABLE_REMOTE_IDENTITY_LOOKUP) next.ENABLE_REMOTE_IDENTITY_LOOKUP = "1";
  if (!next.ENABLE_WEB_TEMPO_LOOKUP) next.ENABLE_WEB_TEMPO_LOOKUP = "1";
  if (!next.ENABLE_LYRICS_LOOKUP) next.ENABLE_LYRICS_LOOKUP = "1";
  if (next.GENIUS_ACCESS_TOKEN && !next.ENABLE_GENIUS_LRCLIB_RETRY) next.ENABLE_GENIUS_LRCLIB_RETRY = "1";
  if (!next.ENABLE_MADMOM_CHORDS) next.ENABLE_MADMOM_CHORDS = "1";
  if (!next.ENABLE_MADMOM_DOWNBEAT_CROSSCHECK) next.ENABLE_MADMOM_DOWNBEAT_CROSSCHECK = "1";
  return next;
}

function analysisServiceNeedsEnvRestart(probe = {}, desiredEnv = {}) {
  const providers = probe?.data?.sectionProviders && typeof probe.data.sectionProviders === "object"
    ? probe.data.sectionProviders
    : {};
  const desiredRemoteIdentity = String(desiredEnv.ENABLE_REMOTE_IDENTITY_LOOKUP || "").trim().toLowerCase() === "1";
  const desiredWebTempo = String(desiredEnv.ENABLE_WEB_TEMPO_LOOKUP || "").trim().toLowerCase() === "1";
  const desiredLyrics = String(desiredEnv.ENABLE_LYRICS_LOOKUP || "").trim().toLowerCase() === "1";
  const desiredMadmomChords = String(desiredEnv.ENABLE_MADMOM_CHORDS || "").trim().toLowerCase() === "1";
  const desiredMadmomDownbeat = String(desiredEnv.ENABLE_MADMOM_DOWNBEAT_CROSSCHECK || "").trim().toLowerCase() === "1";
  return Boolean(
    (desiredRemoteIdentity && providers.remoteIdentityLookupEnabled === false) ||
    (desiredWebTempo && providers.webTempoLookupEnabled === false) ||
    (desiredLyrics && providers.lyricsLookupEnabled === false) ||
    (desiredMadmomChords && providers.madmomChordsEnabled === false) ||
    (desiredMadmomDownbeat && providers.madmomDownbeatCrosscheckEnabled === false)
  );
}

async function stopAnalysisServicePortOccupant() {
  try {
    const { stdout } = await runBinary("bash", ["-lc", `lsof -tiTCP:${ANALYSIS_SERVICE_PORT} -sTCP:LISTEN || true`]);
    const pids = String(stdout || "")
      .split(/\s+/)
      .map((row) => Number.parseInt(String(row).trim(), 10))
      .filter((row) => Number.isFinite(row) && row > 1);
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // ignore
      }
    }
    if (!pids.length) return;
    for (let i = 0; i < 20; i += 1) {
      const { stdout: checkOut } = await runBinary("bash", ["-lc", `lsof -tiTCP:${ANALYSIS_SERVICE_PORT} -sTCP:LISTEN || true`]);
      if (!String(checkOut || "").trim()) return;
      await sleep(250);
    }
    for (const pid of pids) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        // ignore
      }
    }
  } catch {
    // best effort
  }
}

async function isAnalysisServicePortOccupied() {
  try {
    const { stdout } = await runBinary("bash", ["-lc", `lsof -tiTCP:${ANALYSIS_SERVICE_PORT} -sTCP:LISTEN || true`]);
    return Boolean(String(stdout || "").trim());
  } catch {
    return false;
  }
}

async function ensureAnalysisServiceRunning(baseUrl, headers = {}) {
  const desiredEnv = buildAnalysisServiceEnv();
  const current = await probeAnalysisService(baseUrl, 15000, headers);
  const needsRestart = current.ok && isManagedLocalAnalysisService(baseUrl) && analysisServiceNeedsEnvRestart(current, desiredEnv);
  if (current.ok && !needsRestart) return current;
  if (
    !current.ok &&
    isManagedLocalAnalysisService(baseUrl) &&
    /timed out/i.test(String(current.error || "")) &&
    await isAnalysisServicePortOccupied()
  ) {
    logStartup(`analysis:self-heal skipping restart for busy local service baseUrl=${baseUrl}`);
    return current;
  }
  if (needsRestart) {
    logStartup(`analysis:self-heal restarting misconfigured local service baseUrl=${baseUrl}`);
  } else {
    logStartup(`analysis:self-heal probe failed baseUrl=${baseUrl} err=${current.error || "unknown"}`);
  }
  if (analysisServiceStarting) {
    await analysisServiceStarting;
    return probeAnalysisService(baseUrl, 15000, headers);
  }
  analysisServiceStarting = (async () => {
    try {
      const analysisDir = resolveAnalysisServiceDir();
      if (!analysisDir) {
        logStartup("analysis:self-heal skipped no-analysis-dir");
        return;
      }
      const [cmd, ...cmdArgs] = resolveAnalysisPythonCommand();
      if (!cmd) {
        logStartup("analysis:self-heal skipped no-python-cmd");
        return;
      }
      await stopAnalysisServicePortOccupant();
      const args = [...cmdArgs, "-m", "uvicorn", "main:app", "--host", ANALYSIS_SERVICE_HOST, "--port", ANALYSIS_SERVICE_PORT];
      logStartup(`analysis:self-heal spawn cmd=${cmd} cwd=${analysisDir}`);
      const child = spawn(cmd, args, {
        cwd: analysisDir,
        env: desiredEnv,
        stdio: "ignore",
        detached: true
      });
      child.unref();
      analysisServiceProcess = child;
      for (let i = 0; i < 30; i += 1) {
        const probe = await probeAnalysisService(baseUrl, 5000, headers);
        if (probe.ok) {
          logStartup("analysis:self-heal ready");
          return;
        }
        await sleep(1000);
      }
      logStartup("analysis:self-heal timeout waiting-for-health");
    } catch {
      logStartup("analysis:self-heal exception");
    }
  })();
  try {
    await analysisServiceStarting;
  } finally {
    analysisServiceStarting = null;
  }
  return probeAnalysisService(baseUrl, 15000, headers);
}

function createWindow() {
  logStartup("createWindow:enter");
  if (mainWindow && !mainWindow.isDestroyed()) {
    logStartup("createWindow:focus-existing");
    mainWindow.focus();
    return mainWindow;
  }

  const win = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow = win;
  logStartup("createWindow:created");
  win.on("closed", () => {
    logStartup("window:closed");
    if (mainWindow === win) {
      mainWindow = null;
      rendererAutomationReadyPromise = null;
    }
  });

  win.webContents.on("did-fail-load", (_event, code, desc, url, isMainFrame) => {
    logStartup(`webContents:did-fail-load code=${code} desc=${desc} url=${url} main=${isMainFrame}`);
  });

  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    logStartup(`webContents:console level=${level} line=${line} source=${sourceId || "unknown"} message=${String(message || "")}`);
  });

  win.webContents.on("preload-error", (_event, preloadPath, error) => {
    logStartup(`webContents:preload-error path=${preloadPath || "unknown"} error=${String(error?.message || error || "unknown")}`);
  });

  win.webContents.on("render-process-gone", (_event, details) => {
    logStartup(`webContents:render-process-gone reason=${details?.reason || "unknown"} exitCode=${details?.exitCode || 0}`);
    if (mainWindow === win) {
      rendererAutomationReadyPromise = null;
    }
  });

  if (UI_URL) {
    logStartup(`loadURL:${UI_URL}`);
    win.loadURL(UI_URL);
    return win;
  }

  const rendererEntry = resolveRendererEntry();
  logStartup(`loadFile:${rendererEntry}`);
  win.loadFile(rendererEntry).catch((err) => {
    logStartup(`loadFile:error ${String(err?.message || err)}`);
  });
  return win;
}

ipcMain.handle("xld:open-file-dialog", async (_event, options = {}) => {
  const filters = Array.isArray(options?.filters)
    ? options.filters.map((f) => ({
        name: String(f?.name || "Files"),
        extensions: Array.isArray(f?.extensions)
          ? f.extensions.map((ext) => String(ext).replace(/^\./, ""))
          : ["*"]
      }))
    : [];

  const result = await dialog.showOpenDialog({
    title: String(options?.title || "Select File"),
    defaultPath: String(options?.defaultPath || "").trim() || undefined,
    properties: [options?.directory ? "openDirectory" : "openFile"],
    filters
  });

  if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
    return "";
  }
  return result.filePaths[0] || "";
});

function isPathWithinRoot(candidatePath, rootPath) {
  const candidate = path.resolve(String(candidatePath || "").trim());
  const root = path.resolve(String(rootPath || "").trim());
  if (!candidate || !root) return false;
  if (candidate === root) return true;
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

ipcMain.handle("xld:sequence:save-dialog", async (_event, payload = {}) => {
  try {
    const showFolder = String(payload?.showFolder || "").trim();
    if (!showFolder) return { ok: false, canceled: false, error: "Missing showFolder", filePath: "" };

    const defaultNameRaw = String(payload?.defaultName || "NewSequence.xsq").trim() || "NewSequence.xsq";
    const defaultName = defaultNameRaw.toLowerCase().endsWith(".xsq")
      ? defaultNameRaw
      : `${defaultNameRaw}.xsq`;
    const title = String(payload?.title || "Select Sequence File").trim() || "Select Sequence File";

    const result = await dialog.showSaveDialog({
      title,
      defaultPath: path.join(showFolder, defaultName),
      filters: [{ name: "xLights Sequence", extensions: ["xsq"] }]
    });

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true, filePath: "" };
    }

    let selectedPath = String(result.filePath).trim();
    if (!selectedPath.toLowerCase().endsWith(".xsq")) {
      selectedPath += ".xsq";
    }

    if (!isPathWithinRoot(selectedPath, showFolder)) {
      return {
        ok: false,
        canceled: false,
        code: "OUTSIDE_SHOW_FOLDER",
        error: "Selected path must be within Show Directory",
        filePath: ""
      };
    }

    return { ok: true, canceled: false, filePath: selectedPath };
  } catch (err) {
    return { ok: false, canceled: false, error: String(err?.message || err), filePath: "" };
  }
});

ipcMain.handle("xld:project:open-dialog", async (_event, payload = {}) => {
  try {
    const rootPath = String(payload?.rootPath || "").trim();
    const baseDir = resolveProjectsRootPath(rootPath);
    const result = await dialog.showOpenDialog({
      title: "Open Project Metadata",
      defaultPath: baseDir,
      properties: ["openFile"],
      filters: [{ name: "xLightsDesigner Project", extensions: ["xdproj"] }]
    });
    if (result.canceled || !Array.isArray(result.filePaths) || result.filePaths.length === 0) {
      return { ok: false, canceled: true, filePath: "" };
    }
    return { ok: true, canceled: false, filePath: String(result.filePaths[0] || "") };
  } catch (err) {
    return { ok: false, canceled: false, error: String(err?.message || err), filePath: "" };
  }
});

ipcMain.handle("xld:project:save-dialog", async (_event, payload = {}) => {
  try {
    const rootPath = String(payload?.rootPath || "").trim();
    const defaultName = String(payload?.defaultName || "project.xdproj").trim() || "project.xdproj";
    const baseDir = resolveProjectsRootPath(rootPath);
    const result = await dialog.showSaveDialog({
      title: "Save Project As",
      defaultPath: path.join(baseDir, defaultName),
      filters: [{ name: "xLightsDesigner Project", extensions: ["xdproj"] }]
    });
    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true, filePath: "" };
    }
    return { ok: true, canceled: false, filePath: String(result.filePath) };
  } catch (err) {
    return { ok: false, canceled: false, error: String(err?.message || err), filePath: "" };
  }
});

function stateFilePath() {
  return path.join(app.getPath("userData"), STATE_FILENAME);
}

function stateBackupDir() {
  return path.join(app.getPath("userData"), "backups");
}

function timestampToken() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function backupDesktopFileIfExists(filePath, label = "state") {
  const source = String(filePath || "").trim();
  if (!source || !fs.existsSync(source)) return "";
  const backupDir = stateBackupDir();
  const ext = path.extname(source);
  const stem = path.basename(source, ext || undefined);
  const safeLabel = String(label || "state").trim().replace(/[^a-z0-9._-]+/gi, "-");
  const backupName = `${safeLabel}-${stem}-${timestampToken()}${ext || ".json"}`;
  const backupPath = path.join(backupDir, backupName);
  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(source, backupPath);
  return backupPath;
}

function backupDesktopStateSnapshot(reason = "state-write") {
  const backups = [];
  const targets = [
    ["desktop-state", stateFilePath()],
    ["projects-index", desktopProjectsIndexPath()]
  ];
  for (const [label, filePath] of targets) {
    try {
      const backupPath = backupDesktopFileIfExists(filePath, `${reason}-${label}`);
      if (backupPath) backups.push({ label, filePath, backupPath });
    } catch (err) {
      logStartup(`app:state-backup error label=${label} reason=${reason} error=${String(err?.message || err)}`);
    }
  }
  if (backups.length) {
    logStartup(`app:state-backup reason=${reason} count=${backups.length}`);
  }
  return backups;
}

function agentApplyLogPath() {
  return path.join(app.getPath("userData"), AGENT_APPLY_LOG_FILENAME);
}

function agentConfigPath() {
  return path.join(app.getPath("userData"), AGENT_CONFIG_FILENAME);
}

function readStoredAgentConfig() {
  const file = agentConfigPath();
  if (!fs.existsSync(file)) return { apiKey: "", model: "", baseUrl: "" };
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return {
      apiKey: String(parsed?.apiKey || "").trim(),
      model: String(parsed?.model || "").trim(),
      baseUrl: String(parsed?.baseUrl || "").trim().replace(/\/+$/, "")
    };
  } catch {
    return { apiKey: "", model: "", baseUrl: "" };
  }
}

function writeStoredAgentConfig(next = {}) {
  const file = agentConfigPath();
  const payload = {
    apiKey: String(next?.apiKey || "").trim(),
    model: String(next?.model || "").trim(),
    baseUrl: String(next?.baseUrl || "").trim().replace(/\/+$/, "")
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // best effort on platforms that ignore chmod semantics
  }
}

function getAgentConfig() {
  const stored = readStoredAgentConfig();
  const envKey = String(process.env.OPENAI_API_KEY || "").trim();
  const envModel = String(process.env.OPENAI_MODEL || "").trim();
  const envBaseUrl = String(process.env.OPENAI_BASE_URL || "").trim().replace(/\/+$/, "");
  const apiKey = stored.apiKey || envKey;
  const model = stored.model || envModel || OPENAI_MODEL;
  const baseUrl = stored.baseUrl || envBaseUrl || OPENAI_BASE_URL;
  return {
    baseUrl,
    model,
    configured: Boolean(apiKey),
    apiKey,
    hasStoredApiKey: Boolean(stored.apiKey),
    source: stored.apiKey ? "stored" : envKey ? "env" : "none"
  };
}

function extractResponseText(body) {
  if (typeof body?.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  const output = Array.isArray(body?.output) ? body.output : [];
  const textChunks = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const c of content) {
      if (c?.type === "output_text" && typeof c?.text === "string") textChunks.push(c.text);
      if (c?.type === "text" && typeof c?.text === "string") textChunks.push(c.text);
    }
  }
  return textChunks.join("\n").trim();
}

function parseAgentJson(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const inner = raw.slice(start, end + 1);
      try {
        return JSON.parse(inner);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function inferProposalIntent({ userMessage = "", assistantMessage = "", context = {} } = {}) {
  const user = String(userMessage || "").toLowerCase();
  const assistant = String(assistantMessage || "").toLowerCase();
  const route = String(context?.route || "").toLowerCase();
  const sequenceOpen = Boolean(context?.activeSequenceLoaded);
  const planOnly = Boolean(context?.planOnlyMode);
  const actionTerms = [
    "sequence",
    "design",
    "generate",
    "create",
    "build",
    "add",
    "remove",
    "change",
    "update",
    "apply",
    "revise",
    "refine"
  ];
  const hasActionTerm = actionTerms.some((term) => user.includes(term));
  const asksQuestion = user.includes("?");
  const allowsProposal = sequenceOpen || planOnly || route === "design";
  if (!allowsProposal) return false;
  if (!hasActionTerm) return false;
  if (asksQuestion && !assistant.includes("ready")) return false;
  return true;
}

async function callOpenAIResponses({
  cfg,
  systemPrompt = "",
  userMessage = "",
  messages = [],
  previousResponseId = "",
  maxOutputTokens = 900
} = {}) {
  const input = [
    {
      role: "system",
      content: [{ type: "input_text", text: String(systemPrompt || "") }]
    },
    ...normalizeConversationMessages(messages || []),
    {
      role: "user",
      content: [{ type: "input_text", text: String(userMessage || "") }]
    }
  ];

  const body = {
    model: cfg.model,
    input,
    max_output_tokens: maxOutputTokens
  };
  if (previousResponseId) body.previous_response_id = previousResponseId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response = null;
  try {
    response = await fetch(`${cfg.baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  const raw = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const errMsg = parsed?.error?.message || raw || `HTTP ${response.status}`;
    return {
      ok: false,
      code: "AGENT_UPSTREAM_ERROR",
      error: String(errMsg)
    };
  }
  return {
    ok: true,
    parsed: parsed || {},
    modelText: extractResponseText(parsed || {}),
    responseId: String(parsed?.id || "").trim()
  };
}

function buildDesignerSystemPrompt(context = {}) {
  const c = context && typeof context === "object" ? context : {};
  return [
    "You are the xLightsDesigner Designer specialist.",
    "Hold an open-ended creative lighting design conversation while reasoning over the provided local project context.",
    "The user may speak indirectly, emotionally, narratively, or iteratively. Preserve that conversational style.",
    "Use the provided local context to understand what actually exists in the current project: scene/layout, available targets, and music structure.",
    "Do not invent models, groups, submodels, sections, or effects that are not supported by the provided context.",
    "Do not name specific xLights effects unless the user explicitly asked for one or the effect exists in the provided context.",
    "Do not use placeholder or improvised effect names like 'rainbow effect' unless that exact effect exists in context.",
    "Make bounded creative assumptions when the request is broad but usable. Ask targeted questions only when the missing answer materially affects the next useful pass.",
    "Respect project-scoped director preferences as soft guidance only. Do not turn one local preference into a global rule.",
    "Stay in designer mode. Do not speak as if you are already editing, applying, marking sections, or changing the sequence from chat alone.",
    "Do not ask whether you should apply changes now. Review and apply are separate downstream workflow steps.",
    "When ending a response, prefer either a concise design summary or one narrow design question. Do not present menu-like implementation options.",
    "Return JSON only, using this exact shape: {\"responseType\":\"designer_cloud_response_v1\",\"responseVersion\":\"1.0\",\"assistantMessage\":\"...\",\"summary\":\"...\",\"guidedQuestions\":[...],\"assumptions\":[...],\"warnings\":[...],\"brief\":{...},\"proposal\":{...}}",
    "The brief object should contain summary, goalsSummary, inspirationSummary, sections, moodEnergyArc, narrativeCues, visualCues, hypotheses, notes.",
    "The proposal object should contain summary and proposalLines at minimum. Proposal lines must stay human-reviewable and should use real target names from context where possible.",
    "Keep the assistantMessage natural and conversational. The JSON is for application handling, not the end-user voice.",
    `Context: ${JSON.stringify(c)}`
  ].join("\n");
}

function normalizeConversationMessages(messages = []) {
  const rows = Array.isArray(messages) ? messages : [];
  const out = [];
  for (const row of rows.slice(-24)) {
    const roleRaw = String(row?.role || row?.who || "").trim().toLowerCase();
    const content = String(row?.content || row?.text || "").trim();
    if (!content) continue;
    const role = roleRaw === "assistant" || roleRaw === "agent"
      ? "assistant"
      : roleRaw === "system"
        ? "system"
        : "user";
    const contentType = role === "assistant" ? "output_text" : "input_text";
    out.push({
      role,
      content: [{ type: contentType, text: content }]
    });
  }
  return out;
}

function buildAgentSystemPrompt(context = {}) {
  const c = context && typeof context === "object" ? context : {};
  return [
    "You are the xLightsDesigner App Assistant.",
    "You are the unified conversational shell for the whole app, not just the design specialist.",
    "Coordinate naturally across project setup, media selection, metadata, audio analysis, creative design, and sequencing workflow.",
    "When the user is clearly discussing creative direction, behave like a creative design specialist.",
    "When the user is clearly asking about analysis, sequencing, or setup, respond in that workflow context instead of forcing a design conversation.",
    "Hold a natural multi-turn conversation and preserve continuity with prior turns.",
    "Be concise, practical, and collaborative. Ask targeted follow-up questions only when missing information materially affects the next useful step.",
    "Default to making bounded assumptions and moving the workflow forward when the request is broad but still usable.",
    "Do not require the user to specify low-level xLights effects unless they are expressing a concrete constraint.",
    "Do not invent specific effect names that are not supplied by the user or present in the local context.",
    "When relevant, mention concrete next actions you can perform in the app.",
    "Keep specialist boundaries intact: audio analysis is media-only, design proposals are review-first, and sequence execution must remain explicit.",
    "For broad creative kickoff prompts, keep the conversation with the designer. Do not jump straight into sequencing or imply that edits are already being made.",
    "Do not output JSON unless explicitly asked by the user.",
    `Context: ${JSON.stringify(c)}`
  ].join("\n");
}

function readDesktopStatePayload() {
  const file = stateFilePath();
  if (!fs.existsSync(file)) return { localStateRaw: "", projectsStoreRaw: "" };
  const raw = fs.readFileSync(file, "utf8");
  const parsed = JSON.parse(raw);
  return {
    localStateRaw: typeof parsed?.localStateRaw === "string" ? parsed.localStateRaw : "",
    projectsStoreRaw: typeof parsed?.projectsStoreRaw === "string" ? parsed.projectsStoreRaw : ""
  };
}

function getDesktopAppInfo() {
  const appPath = app.getAppPath();
  const appVersion = String(app.getVersion() || "").trim() || "0.0.0";
  let buildTime = "";
  let buildEpochMs = 0;
  let buildInfoSource = "";
  try {
    const buildInfoPath = path.join(__dirname, "renderer", "build-info.json");
    if (fs.existsSync(buildInfoPath)) {
      const raw = fs.readFileSync(buildInfoPath, "utf8");
      const parsed = JSON.parse(raw);
      const parsedTime = String(parsed?.buildTime || "").trim();
      const parsedEpoch = Number(parsed?.buildEpochMs || 0);
      if (parsedTime) buildTime = parsedTime;
      if (Number.isFinite(parsedEpoch) && parsedEpoch > 0) buildEpochMs = parsedEpoch;
      buildInfoSource = "renderer/build-info.json";
    }
  } catch {
    // fallback below
  }
  try {
    if (!buildTime) {
      const stat = fs.statSync(appPath);
      if (stat?.mtime) buildTime = new Date(stat.mtime).toISOString();
      if (stat?.mtimeMs) buildEpochMs = Number(stat.mtimeMs);
      buildInfoSource = "appPath.mtime";
    }
  } catch {
    // ignore stat errors
  }
  return {
    appVersion,
    appPath,
    buildTime,
    buildEpochMs,
    buildInfoSource,
    isPackaged: Boolean(app.isPackaged),
  };
}

function projectKey(projectName, showFolder) {
  return `${String(projectName || "").trim()}::${String(showFolder || "").trim()}`;
}

function sanitizeProjectName(projectName) {
  return String(projectName || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
}

function resolveAppProjectsRootInput(rootPath) {
  const custom = String(rootPath || "").trim();
  if (!custom) {
    return path.join(app.getPath("userData"), PROJECTS_DIRNAME);
  }
  const resolved = path.resolve(custom);
  return path.basename(resolved) === PROJECTS_DIRNAME ? resolved : path.join(resolved, PROJECTS_DIRNAME);
}

function resolveProjectsRootPath(rootPath) {
  return resolveAppProjectsRootInput(rootPath);
}

function projectIdFromKey(key) {
  return crypto.createHash("sha1").update(String(key || "")).digest("hex");
}

ipcMain.handle("xld:state:read", async () => {
  try {
    return { ok: true, ...readDesktopStatePayload() };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:state:write", async (_event, payload = {}) => {
  try {
    const file = stateFilePath();
    const next = {
      localStateRaw: typeof payload?.localStateRaw === "string" ? payload.localStateRaw : "",
      projectsStoreRaw: typeof payload?.projectsStoreRaw === "string" ? payload.projectsStoreRaw : ""
    };
    const backups = backupDesktopStateSnapshot("state-write");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf8");
    return { ok: true, backups };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});


function desktopProjectsIndexPath() {
  return path.join(app.getPath("userData"), PROJECTS_DIRNAME, "index.json");
}

function removeFileIfExists(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
    fs.rmSync(filePath, { force: true });
    return true;
  } catch {
    return false;
  }
}

ipcMain.handle("xld:app:factory-reset", async (_event, payload = {}) => {
  try {
    const backups = backupDesktopStateSnapshot("factory-reset");
    const deleted = [];
    const candidates = [
      ["desktopState", stateFilePath()],
      ["agentApplyLog", agentApplyLogPath()],
      ["projectsIndex", desktopProjectsIndexPath()]
    ];
    for (const [label, filePath] of candidates) {
      if (removeFileIfExists(filePath)) deleted.push({ label, filePath });
    }
    return {
      ok: true,
      backups,
      deleted,
      preserved: {
        agentConfig: true,
        projectFolders: true,
        analysisArtifacts: true,
        projectFiles: true
      },
      resetMode: String(payload?.resetMode || "app-state-only")
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:app:info", async () => {
  try {
    return { ok: true, ...getDesktopAppInfo() };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:audio:read", async (_event, payload = {}) => {
  try {
    const filePath = String(payload?.filePath || "").trim();
    if (!filePath) return { ok: false, error: "Missing filePath" };
    if (!fs.existsSync(filePath)) return { ok: false, error: "Audio file not found" };
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { ok: false, error: "Audio path is not a file" };
    const maxBytes = 200 * 1024 * 1024;
    if (stat.size > maxBytes) return { ok: false, error: "Audio file exceeds 200MB limit" };
    const buf = fs.readFileSync(filePath);
    return {
      ok: true,
      fileName: path.basename(filePath),
      mimeType: "application/octet-stream",
      byteLength: buf.byteLength,
      base64: buf.toString("base64")
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:analysis:run", async (_event, payload = {}) => {
  try {
    const filePath = String(payload?.filePath || "").trim();
    const baseUrl = String(payload?.baseUrl || "").trim().replace(/\/+$/, "");
    const requestedProvider = "librosa";
    let provider = requestedProvider;
    const analysisProfileMode = String(payload?.analysisProfileMode || "").trim().toLowerCase();
    const cachedModulesJson = String(payload?.cachedModulesJson || "").trim();
    const apiKey = String(payload?.apiKey || "").trim();
    const authBearer = String(payload?.authBearer || "").trim();
    const timeoutMsRaw = Number.parseInt(String(payload?.timeoutMs || "90000"), 10);
    const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(3000, Math.min(300000, timeoutMsRaw)) : 90000;
    const retryRaw = Number.parseInt(String(payload?.retryAttempts || "3"), 10);
    const retryAttempts = Number.isFinite(retryRaw) ? Math.max(1, Math.min(5, retryRaw)) : 3;
    if (!filePath) return { ok: false, error: "Missing filePath" };
    if (!baseUrl) return { ok: false, error: "Missing analysis service baseUrl" };
    if (!fs.existsSync(filePath)) return { ok: false, error: "Audio file not found" };
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { ok: false, error: "Audio path is not a file" };
    const maxBytes = 200 * 1024 * 1024;
    if (stat.size > maxBytes) return { ok: false, error: "Audio file exceeds 200MB limit" };

    const transientHttp = new Set([408, 425, 429, 500, 502, 503, 504]);
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const buf = fs.readFileSync(filePath);
    let lastError = "Analysis service unavailable.";
    const healthHeaders = {};
    if (apiKey) healthHeaders["x-api-key"] = apiKey;
    if (authBearer) healthHeaders.Authorization = `Bearer ${authBearer}`;

    // Self-heal: ensure service is up before first analyze attempt.
    const warm = await ensureAnalysisServiceRunning(baseUrl, healthHeaders);
    if (!warm.ok) {
      lastError = String(warm.error || lastError);
    }

    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const form = new FormData();
        form.append("provider", provider);
        if (analysisProfileMode) form.append("analysisProfileMode", analysisProfileMode);
        if (cachedModulesJson) form.append("cachedModulesJson", cachedModulesJson);
        form.append("fileName", path.basename(filePath));
        form.append("file", new Blob([buf]), path.basename(filePath));
        const headers = {};
        if (apiKey) headers["x-api-key"] = apiKey;
        if (authBearer) headers.Authorization = `Bearer ${authBearer}`;
        const response = await fetch(`${baseUrl}/analyze`, {
          method: "POST",
          headers,
          body: form,
          signal: controller.signal
        });
        const raw = await response.text();
        let parsed = null;
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = null;
        }
        if (response.ok) {
          return {
            ok: true,
            provider,
            analysisProfileMode,
            cachedModulesJsonPresent: Boolean(cachedModulesJson),
            baseUrl,
            attempts: attempt,
            data: parsed?.data || parsed || {}
          };
        }
        const detail = String(parsed?.detail || "").trim();
        lastError = String(parsed?.error || parsed?.message || raw || `HTTP ${response.status}`);
        const canRetry = transientHttp.has(response.status);
        if (!canRetry || attempt >= retryAttempts) {
          return { ok: false, error: lastError };
        }
      } catch (err) {
        const isTimeout = err?.name === "AbortError";
        const msg = isTimeout ? "Analysis service request timed out." : String(err?.message || err);
        lastError = msg;
        if (attempt >= retryAttempts) {
          return { ok: false, error: msg };
        }
      } finally {
        clearTimeout(timer);
      }

      // Reconnect grace period between retries.
      await ensureAnalysisServiceRunning(baseUrl, healthHeaders);
      await sleep(Math.min(2000, 300 * (2 ** (attempt - 1))));
    }
    return { ok: false, error: lastError };
  } catch (err) {
    const msg = err?.name === "AbortError"
      ? "Analysis service request timed out."
      : String(err?.message || err);
    return { ok: false, error: msg };
  }
});

ipcMain.handle("xld:analysis:health", async (_event, payload = {}) => {
  try {
    const baseUrl = String(payload?.baseUrl || "").trim().replace(/\/+$/, "");
    const apiKey = String(payload?.apiKey || "").trim();
    const authBearer = String(payload?.authBearer || "").trim();
    const timeoutMsRaw = Number.parseInt(String(payload?.timeoutMs || "20000"), 10);
    const timeoutMs = Number.isFinite(timeoutMsRaw) ? Math.max(3000, Math.min(60000, timeoutMsRaw)) : 20000;
    if (!baseUrl) return { ok: false, reachable: false, error: "Missing analysis service baseUrl" };

    const analysisServiceDir = resolveAnalysisServiceDir();
    const headers = {};
    if (apiKey) headers["x-api-key"] = apiKey;
    if (authBearer) headers.Authorization = `Bearer ${authBearer}`;
    const initial = await probeAnalysisService(baseUrl, timeoutMs, headers);
    if (initial.ok) {
      return {
        ok: true,
        reachable: true,
        status: initial.status,
        baseUrl,
        analysisServiceDir,
        selfHealAttempted: false,
        data: initial.data || {}
      };
    }
    // Self-heal path: try to start service then probe again.
    const healed = await ensureAnalysisServiceRunning(baseUrl, headers);
    if (healed.ok) {
      return {
        ok: true,
        reachable: true,
        status: healed.status,
        baseUrl,
        analysisServiceDir,
        selfHealAttempted: true,
        data: healed.data || {}
      };
    }
    return {
      ok: false,
      reachable: false,
      status: healed.status || initial.status || 0,
      analysisServiceDir,
      selfHealAttempted: true,
      error: String(healed.error || initial.error || "Analysis service unavailable.")
    };
  } catch (err) {
    const msg = err?.name === "AbortError"
      ? "Analysis service health check timed out."
      : String(err?.message || err);
    return { ok: false, reachable: false, error: msg };
  }
});

ipcMain.handle("xld:agent:health", async () => {
  try {
    const cfg = getAgentConfig();
    return {
      ok: true,
      provider: "openai",
      model: cfg.model,
      configured: cfg.configured,
      hasStoredApiKey: cfg.hasStoredApiKey,
      source: cfg.source
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:agent-config:get", async () => {
  try {
    const stored = readStoredAgentConfig();
    const cfg = getAgentConfig();
    return {
      ok: true,
      provider: "openai",
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      hasStoredApiKey: Boolean(stored.apiKey),
      configured: cfg.configured,
      source: cfg.source
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:agent-config:set", async (_event, payload = {}) => {
  try {
    const current = readStoredAgentConfig();
    const clearApiKey = Boolean(payload?.clearApiKey);
    const apiKeyRaw = typeof payload?.apiKey === "string" ? payload.apiKey : null;
    const modelRaw = typeof payload?.model === "string" ? payload.model : null;
    const baseUrlRaw = typeof payload?.baseUrl === "string" ? payload.baseUrl : null;

    const next = {
      apiKey: clearApiKey ? "" : (apiKeyRaw != null ? String(apiKeyRaw).trim() : current.apiKey),
      model: modelRaw != null ? String(modelRaw).trim() : current.model,
      baseUrl: baseUrlRaw != null ? String(baseUrlRaw).trim().replace(/\/+$/, "") : current.baseUrl
    };
    writeStoredAgentConfig(next);
    const cfg = getAgentConfig();
    return {
      ok: true,
      configured: cfg.configured,
      hasStoredApiKey: cfg.hasStoredApiKey,
      model: cfg.model,
      baseUrl: cfg.baseUrl,
      source: cfg.source
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:agent:chat", async (_event, payload = {}) => {
  try {
    const cfg = getAgentConfig();
    if (!cfg.configured) {
      return {
        ok: false,
        code: "AGENT_NOT_CONFIGURED",
        error: "OPENAI_API_KEY is not set in desktop app environment."
      };
    }

    const userMessage = String(payload?.userMessage || "").trim();
    if (!userMessage) return { ok: false, error: "Missing userMessage" };
    const context = payload?.context && typeof payload.context === "object" ? payload.context : {};
    const previousResponseId = String(payload?.previousResponseId || "").trim();
    const response = await callOpenAIResponses({
      cfg,
      systemPrompt: buildAgentSystemPrompt(context),
      userMessage,
      messages: payload?.messages || [],
      previousResponseId,
      maxOutputTokens: 900
    });
    if (!response.ok) {
      return {
        ok: false,
        code: response.code,
        error: response.error
      };
    }
    const modelText = response.modelText;
    const json = parseAgentJson(modelText) || {};
    const assistantMessage = String(json?.assistantMessage || modelText || "I can continue from here. Tell me what you want to design next.").trim();
    const shouldGenerateProposal = typeof json?.shouldGenerateProposal === "boolean"
      ? Boolean(json.shouldGenerateProposal)
      : inferProposalIntent({ userMessage, assistantMessage, context });
    const proposalIntent = String(json?.proposalIntent || userMessage).trim();
    const responseId = String(response.responseId || "").trim();
    if (!assistantMessage) {
      return {
        ok: false,
        code: "AGENT_EMPTY_RESPONSE",
        error: "Agent returned an empty response."
      };
    }
    return {
      ok: true,
      provider: "openai",
      model: cfg.model,
      assistantMessage,
      shouldGenerateProposal,
      proposalIntent,
      responseId
    };
  } catch (err) {
    return {
      ok: false,
      code: String(err?.name || "") === "AbortError" ? "AGENT_TIMEOUT" : "AGENT_RUNTIME_ERROR",
      error: String(err?.message || err)
    };
  }
});

ipcMain.handle("xld:designer:chat", async (_event, payload = {}) => {
  try {
    const cfg = getAgentConfig();
    if (!cfg.configured) {
      return {
        ok: false,
        code: "AGENT_NOT_CONFIGURED",
        error: "OPENAI_API_KEY is not set in desktop app environment."
      };
    }
    const userMessage = String(payload?.userMessage || "").trim();
    if (!userMessage) {
      return { ok: false, code: "AGENT_EMPTY_MESSAGE", error: "Missing userMessage" };
    }
    const response = await callOpenAIResponses({
      cfg,
      systemPrompt: buildDesignerSystemPrompt(payload?.context || {}),
      userMessage,
      messages: payload?.messages || [],
      previousResponseId: String(payload?.previousResponseId || "").trim(),
      maxOutputTokens: 1400
    });
    if (!response.ok) {
      return {
        ok: false,
        code: response.code,
        error: response.error
      };
    }
    const json = parseAgentJson(response.modelText) || {};
    return {
      ok: true,
      provider: "openai",
      model: cfg.model,
      responseId: String(response.responseId || ""),
      assistantMessage: sanitizeDesignerAssistantMessage(String(json?.assistantMessage || response.modelText || "").trim()),
      designerCloudResponse: json
    };
  } catch (err) {
    return {
      ok: false,
      code: String(err?.name || "") === "AbortError" ? "AGENT_TIMEOUT" : "AGENT_RUNTIME_ERROR",
      error: String(err?.message || err)
    };
  }
});

ipcMain.handle("xld:agent-log:append", async (_event, payload = {}) => {
  try {
    return appendAgentLogEntry(payload, { filePath: agentApplyLogPath() });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:agent-log:read", async (_event, payload = {}) => {
  try {
    return readAgentLogEntries(payload, { filePath: agentApplyLogPath() });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:project:open-file", async (_event, payload = {}) => {
  try {
    return readProjectFileRecord(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:file:stat", async (_event, payload = {}) => {
  try {
    return statFileRecord(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:analysis-artifact:read", async (_event, payload = {}) => {
  try {
    if (String(payload?.appRootPath || "").trim()) {
      return readAnalysisArtifactFromLibrary(payload);
    }
    return readAnalysisArtifactFromProject(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:analysis-artifact:write", async (_event, payload = {}) => {
  try {
    if (String(payload?.appRootPath || "").trim()) {
      return writeAnalysisArtifactToLibrary(payload);
    }
    return writeAnalysisArtifactToProject(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:audio-library:analyze-folder", async (_event, payload = {}) => {
  try {
    const appRootPath = String(payload?.appRootPath || "").trim();
    const folderPath = String(payload?.folderPath || "").trim();
    const mode = String(payload?.mode || "deep").trim().toLowerCase();
    const recursive = payload?.recursive !== false;
    const outDir = String(payload?.outDir || "").trim();
    if (!appRootPath) return { ok: false, error: "Missing appRootPath" };
    if (!folderPath) return { ok: false, error: "Missing folderPath" };
    if (!fs.existsSync(folderPath)) return { ok: false, error: "Audio folder not found" };
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) return { ok: false, error: "Audio path is not a folder" };

    const repoRoot = path.resolve(__dirname, "..", "..");
    const runnerPath = path.join(repoRoot, "scripts", "audio-analysis", "build-track-library-and-review.mjs");
    if (!fs.existsSync(runnerPath)) return { ok: false, error: "Audio library runner not found" };
    const targetOutDir = outDir || path.join(repoRoot, "var", "audio-analysis-review", `ui-run-${new Date().toISOString().replace(/[:.]/g, "-")}`);
    fs.mkdirSync(targetOutDir, { recursive: true });

    const args = [
      runnerPath,
      "--app-root", appRootPath,
      "--folder", folderPath,
      "--out-dir", targetOutDir,
      "--mode", mode === "fast" ? "fast" : "deep"
    ];
    if (recursive) args.push("--recursive");
    const { stdout, stderr } = await runBinary(process.execPath, args);
    const jsonPath = path.join(targetOutDir, "track-library-review.json");
    const htmlPath = path.join(targetOutDir, "track-library-review.html");
    if (!fs.existsSync(jsonPath)) {
      return { ok: false, error: "Track library review JSON was not produced", stdout, stderr };
    }
    const review = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const results = Array.isArray(review?.results) ? review.results : [];
    const issueCounts = {};
    for (const row of results) {
      for (const issue of Array.isArray(row?.quality?.topLevelIssues) ? row.quality.topLevelIssues : []) {
        const key = String(issue || "").trim();
        if (!key) continue;
        issueCounts[key] = Number(issueCounts[key] || 0) + 1;
      }
    }
    return {
      ok: true,
      appRootPath,
      folderPath,
      recursive,
      outDir: targetOutDir,
      jsonPath,
      htmlPath: fs.existsSync(htmlPath) ? htmlPath : "",
      review: {
        ...review,
        topLevelIssueCounts: issueCounts
      },
      stdout,
      stderr
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:audio-library:list-tracks", async (_event, payload = {}) => {
  try {
    const appRootPath = String(payload?.appRootPath || "").trim();
    if (!appRootPath) return { ok: false, error: "Missing appRootPath" };
    return listTrackLibrarySummaries({ appRootPath });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:audio-library:update-track-identity", async (_event, payload = {}) => {
  try {
    const appRootPath = String(payload?.appRootPath || "").trim();
    const contentFingerprint = String(payload?.contentFingerprint || "").trim();
    const title = String(payload?.title || "").trim();
    const artist = String(payload?.artist || "").trim();
    if (!appRootPath) return { ok: false, error: "Missing appRootPath" };
    if (!contentFingerprint) return { ok: false, error: "Missing contentFingerprint" };
    if (!title || !artist) return { ok: false, error: "Missing title or artist" };
    return updateTrackLibraryRecordIdentity({ appRootPath, contentFingerprint, title, artist });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:project-artifact:write", async (_event, payload = {}) => {
  try {
    return writeProjectArtifact(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:project-artifacts:write", async (_event, payload = {}) => {
  try {
    return writeProjectArtifacts(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:project-artifact:read", async (_event, payload = {}) => {
  try {
    return readProjectArtifact(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:training-package:read", async (_event, payload = {}) => {
  try {
    return readTrainingPackageAsset(payload, { rootDir: resolveTrainingPackageDir() });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:project:write-file", async (_event, payload = {}) => {
  try {
    return writeProjectFileRecord(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:sidecar:read", async (_event, payload = {}) => {
  try {
    return readSequenceSidecarFile(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:sidecar:write", async (_event, payload = {}) => {
  try {
    return writeSequenceSidecarFile(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:media:save-reference", async (_event, payload = {}) => {
  try {
    return saveReferenceMediaFile(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:media:apply-identity-recommendation", async (_event, payload = {}) => {
  try {
    return await applyMediaIdentityRecommendation(payload, { runBinary });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:backup:create", async (_event, payload = {}) => {
  try {
    return createSequenceBackupFile(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:backup:restore", async (_event, payload = {}) => {
  try {
    return restoreSequenceBackupFile(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:sequence:list", async (_event, payload = {}) => {
  try {
    return listSequenceFilesInShowFolder(payload);
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:media:list", async (_event, payload = {}) => {
  try {
    return listMediaFilesInFolder({
      ...payload,
      readMediaIdentity: (filePath, options = {}) => readMediaIdentityFromFile(filePath, {
        ...options,
        cache: MEDIA_IDENTITY_PROBE_CACHE,
        spawnSyncCompat
      })
    });
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

ipcMain.handle("xld:diagnostics:export", async (_event, payload = {}) => {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const defaultName = `xlightsdesigner-diagnostics-${stamp}.json`;
    const defaultPath = path.join(app.getPath("desktop"), defaultName);
    const save = await dialog.showSaveDialog({
      title: "Export Diagnostics Bundle",
      defaultPath,
      filters: [{ name: "JSON", extensions: ["json"] }]
    });
    if (save.canceled || !save.filePath) {
      return { ok: false, canceled: true, error: "User canceled save dialog" };
    }
    const data = payload && typeof payload === "object" ? payload : {};
    fs.writeFileSync(save.filePath, JSON.stringify(data, null, 2), "utf8");
    return { ok: true, outputPath: save.filePath };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

process.on("uncaughtException", (err) => {
  logStartup(`process:uncaughtException ${String(err?.stack || err)}`);
});

process.on("unhandledRejection", (err) => {
  logStartup(`process:unhandledRejection ${String(err?.stack || err)}`);
});

app.on("will-finish-launching", () => logStartup("app:will-finish-launching"));
app.on("ready", () => {
  failOnStaleUserDataRoots();
  logStartup("app:ready");
  logStartup(`app:userData ${app.getPath("userData")}`);
});
app.on("before-quit", () => logStartup("app:before-quit"));
app.on("will-quit", () => logStartup("app:will-quit"));
app.on("quit", (_event, code) => logStartup(`app:quit code=${code}`));
app.on("child-process-gone", (_event, details) => {
  const type = String(details?.type || "unknown");
  const reason = String(details?.reason || "unknown");
  const name = String(details?.name || "unknown");
  const serviceName = String(details?.serviceName || "").trim();
  const exitCode = Number.isFinite(Number(details?.exitCode)) ? Number(details.exitCode) : 0;
  logStartup(
    `app:child-process-gone type=${type} reason=${reason} name=${name} service=${serviceName || "n/a"} exitCode=${exitCode}`
  );
});

app.whenReady().then(() => {
  logStartup("app:whenReady:resolved");
  createWindow();
  startAutomationPolling();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
