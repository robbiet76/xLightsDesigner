import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv = []) {
  const options = {
    channel: "dev",
    outDir: "/tmp/live-reviewed-timing-wholesequence-baseline",
    suitePath: "",
    pretty: true
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = str(argv[index]);
    if (token === "--channel") {
      options.channel = str(argv[index + 1] || options.channel) || options.channel;
      index += 1;
    } else if (token === "--out-dir") {
      options.outDir = str(argv[index + 1] || options.outDir) || options.outDir;
      index += 1;
    } else if (token === "--suite") {
      options.suitePath = str(argv[index + 1] || "");
      index += 1;
    } else if (token === "--compact") {
      options.pretty = false;
    } else if (token === "--pretty") {
      options.pretty = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!["dev", "packaged"].includes(options.channel)) {
    throw new Error(`Unsupported channel: ${options.channel}`);
  }
  return options;
}

function assertNativeParityAvailable() {
  throw new Error(
    "run-live-reviewed-timing-wholesequence-baseline.mjs still depends on removed legacy desktop automation actions. " +
    "Do not run this baseline until native automation parity exists for reviewed-timing whole-sequence commands."
  );
}

function resolveRepoRoot() {
  return path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
}

function runCommand(cmd, args, { cwd }) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk || ""); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk || ""); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `${cmd} exited with code ${code}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function runAutomation(repoRoot, channel, resultPath, command, args = []) {
  const script = path.join(repoRoot, "scripts", "desktop", "automation.mjs");
  const commandArgs = [script, "--channel", channel, "--result-file", resultPath, command, ...args];
  await runCommand("node", commandArgs, { cwd: repoRoot });
  return readJson(resultPath);
}

function writePayload(filePath, payload = {}) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function classifyAutomationHealth(snapshot = {}) {
  const main = snapshot?.main && typeof snapshot.main === "object" ? snapshot.main : {};
  const renderer = snapshot?.renderer && typeof snapshot.renderer === "object" ? snapshot.renderer : {};
  const issues = [];
  if (snapshot?.ok !== true) {
    issues.push("snapshot_unavailable");
  }
  if (!main.appReady) issues.push("app_not_ready");
  if (!main.mainWindowExists) issues.push("main_window_missing");
  if (!main.automationPollTimerActive) issues.push("poll_timer_inactive");
  if (!main.automationRequestProcessorActive) issues.push("request_processor_inactive");
  if (!renderer.ready) issues.push("renderer_not_ready");
  if (renderer?.error) issues.push("renderer_error");
  return {
    ok: issues.length === 0,
    issues,
    main,
    renderer
  };
}

function restoreValidationSequenceFromBaseline({ sequencePath = "", baselineSequencePath = "" } = {}) {
  const targetPath = str(sequencePath);
  const baselinePath = str(baselineSequencePath);
  if (!targetPath || !baselinePath) return;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(baselinePath, targetPath);
  const ext = path.extname(targetPath);
  const name = path.basename(targetPath, ext || undefined);
  const backupSibling = path.join(path.dirname(targetPath), `${name}.xbkp`);
  try {
    fs.rmSync(backupSibling, { force: true });
  } catch {
    // best effort
  }
}

function extractPracticalValidation(snapshot = {}, applyResponse = {}) {
  return snapshot?.result?.latestPracticalValidation
    || applyResponse?.result?.latestPracticalValidation
    || applyResponse?.result?.applyOutcome?.applyResult?.practicalValidation
    || null;
}

function summarizeTimingBaseline(results = []) {
  const rows = arr(results)
    .map((row) => ({
      name: str(row?.name),
      practicalValidation: row?.practicalValidation && typeof row.practicalValidation === "object" ? row.practicalValidation : null
    }))
    .filter((row) => row.practicalValidation);
  const timingRows = rows.map((row) => ({
    name: row.name,
    timingFidelity: row.practicalValidation?.summary?.timingFidelity && typeof row.practicalValidation.summary.timingFidelity === "object"
      ? row.practicalValidation.summary.timingFidelity
      : {},
    timingFailures: arr(row.practicalValidation?.failures?.timing),
    overallOk: row.practicalValidation?.overallOk === true
  }));
  return {
    scenarioCount: results.length,
    scenarioCountWithPracticalValidation: rows.length,
    scenarioCountWithTimingData: timingRows.filter((row) => Object.keys(row.timingFidelity).length > 0).length,
    reviewedStructureScenarioCount: timingRows.filter((row) => row.timingFidelity?.structureTrackPresent === true).length,
    reviewedPhraseScenarioCount: timingRows.filter((row) => row.timingFidelity?.phraseTrackPresent === true).length,
    timingAwareScenarioCount: timingRows.filter((row) => Number(row.timingFidelity?.timingAwareEffectCount || 0) > 0).length,
    crossingStructureScenarioCount: timingRows.filter((row) => Number(row.timingFidelity?.crossingStructureCount || 0) > 0).length,
    timingFailureScenarioCount: timingRows.filter((row) => row.timingFailures.length > 0).length,
    practicalFailureScenarioCount: timingRows.filter((row) => row.overallOk !== true).length,
    rows: timingRows
  };
}

async function main() {
  assertNativeParityAvailable();
  const options = parseArgs(process.argv.slice(2));
  const repoRoot = resolveRepoRoot();
  const suitePath = options.suitePath
    ? path.resolve(repoRoot, options.suitePath)
    : path.join(repoRoot, "apps", "xlightsdesigner-ui", "eval", "live-reviewed-timing-wholesequence-baseline-suite-v1.json");
  const suite = readJson(suitePath);
  const scenarios = arr(suite?.scenarios);
  if (!scenarios.length) {
    throw new Error("Live reviewed timing whole-sequence baseline suite requires at least one scenario.");
  }

  const outDir = path.resolve(options.outDir);
  const baselinesDir = path.join(outDir, "baselines");
  fs.mkdirSync(baselinesDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const runtimeSuite = {
    ...suite,
    scenarios: scenarios.map((scenario, index) => {
      const sequencePath = str(scenario?.sequencePath);
      const ext = path.extname(sequencePath) || ".xsq";
      const baseName = path.basename(sequencePath, ext);
      const baselineSequencePath = path.join(baselinesDir, `${String(index + 1).padStart(2, "0")}-${baseName}-baseline${ext}`);
      fs.copyFileSync(sequencePath, baselineSequencePath);
      return {
        ...scenario,
        baselineSequencePath
      };
    })
  };
  const runtimeSuitePath = path.join(outDir, "live-reviewed-timing-wholesequence-runtime-suite.json");
  fs.writeFileSync(runtimeSuitePath, `${JSON.stringify(runtimeSuite, null, 2)}\n`, "utf8");

  const results = [];
  const initialAutomationHealthResponse = await runAutomation(
    repoRoot,
    options.channel,
    path.join(outDir, "00-initial-automation-health.json"),
    "get-automation-health-snapshot"
  );
  const initialAutomationHealth = classifyAutomationHealth(initialAutomationHealthResponse?.result || {});
  try {
    for (let index = 0; index < runtimeSuite.scenarios.length; index += 1) {
      const scenario = runtimeSuite.scenarios[index];
      const prefix = `${String(index + 1).padStart(2, "0")}-${str(scenario?.name) || `scenario-${index + 1}`}`;
      const scenarioStartedAt = Date.now();
      const timings = {};
      let generateResponse = null;
      let applyResponse = null;
      let wholeSequenceApplyValidation = null;
      let sequencerSnapshot = null;
      let scenarioHealthBefore = null;
      let scenarioHealthAfter = null;
      let failure = null;
      try {
        scenarioHealthBefore = classifyAutomationHealth((await runAutomation(
          repoRoot,
          options.channel,
          path.join(outDir, `${prefix}-health-before.json`),
          "get-automation-health-snapshot"
        ))?.result || {});

        await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-reset.json`), "reset-automation-state");
        restoreValidationSequenceFromBaseline({
          sequencePath: str(scenario?.sequencePath),
          baselineSequencePath: str(scenario?.baselineSequencePath)
        });

        if (str(scenario?.showFolder || runtimeSuite?.showFolder)) {
          const setShowPayloadPath = path.join(outDir, `${prefix}-show-folder-payload.json`);
          writePayload(setShowPayloadPath, {
            showFolder: str(scenario?.showFolder || runtimeSuite?.showFolder)
          });
          const started = Date.now();
          await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-show-folder.json`), "set-show-folder", ["--payload-file", setShowPayloadPath]);
          timings.setShowFolderMs = Date.now() - started;
        }

        {
          const openPayloadPath = path.join(outDir, `${prefix}-open-payload.json`);
          writePayload(openPayloadPath, {
            sequencePath: str(scenario?.sequencePath),
            skipPostOpenRefresh: true
          });
          const started = Date.now();
          await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-open.json`), "open-sequence", ["--payload-file", openPayloadPath]);
          timings.openSequenceMs = Date.now() - started;
        }

        {
          const started = Date.now();
          await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-refresh.json`), "refresh-from-xlights");
          timings.refreshMs = Date.now() - started;
        }

        if (str(scenario?.audioPathOverride)) {
          const audioPayloadPath = path.join(outDir, `${prefix}-audio-payload.json`);
          writePayload(audioPayloadPath, {
            audioPath: str(scenario?.audioPathOverride)
          });
          const started = Date.now();
          await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-set-audio.json`), "set-audio-path", ["--payload-file", audioPayloadPath]);
          timings.setAudioMs = Date.now() - started;
        }

        if (str(scenario?.analyzePrompt)) {
          const analyzePayloadPath = path.join(outDir, `${prefix}-analyze-payload.json`);
          const analyzePayload = {
            prompt: str(scenario?.analyzePrompt)
          };
          if (scenario?.analysisProfile && typeof scenario.analysisProfile === "object") {
            analyzePayload.analysisProfile = scenario.analysisProfile;
          }
          if (scenario?.forceFreshAnalysis === true) {
            analyzePayload.forceFresh = true;
          }
          writePayload(analyzePayloadPath, analyzePayload);
          const started = Date.now();
          await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-analyze.json`), "analyze-audio", ["--payload-file", analyzePayloadPath]);
          timings.analyzeMs = Date.now() - started;
        }

        if (scenario?.seedTimingTracksFromAnalysis === true) {
          const started = Date.now();
          await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-seed-timing.json`), "seed-timing-tracks-from-analysis");
          timings.seedTimingTracksMs = Date.now() - started;
        }

        {
          const generatePayloadPath = path.join(outDir, `${prefix}-generate-payload.json`);
          writePayload(generatePayloadPath, {
            prompt: str(scenario?.prompt || scenario?.strongPrompt),
            requestedRole: str(scenario?.requestedRole || runtimeSuite?.requestedRole || "sequence_agent"),
            forceFresh: true,
            clearRevisionTarget: true,
            selectedSections: arr(scenario?.sections),
            selectedTargetIds: arr(scenario?.targets),
            selectedTagNames: arr(scenario?.tagNames)
          });
          const started = Date.now();
          generateResponse = await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-generate.json`), "generate-proposal", ["--payload-file", generatePayloadPath]);
          timings.generateMs = Date.now() - started;
        }

        if (generateResponse?.result?.planHandoff || generateResponse?.result?.hasDraftProposal) {
          const started = Date.now();
          applyResponse = await runAutomation(repoRoot, options.channel, path.join(outDir, `${prefix}-apply.json`), "apply-current-proposal");
          timings.applyMs = Date.now() - started;
        } else {
          timings.applyMs = 0;
        }

        {
          const validationPayloadPath = path.join(outDir, `${prefix}-whole-sequence-validate-payload.json`);
          writePayload(validationPayloadPath, {
            sequenceName: scenario?.sequenceName,
            minConceptCount: Number(scenario?.minConceptCount || 8),
            minPlacementCount: Number(scenario?.minPlacementCount || 200)
          });
          const started = Date.now();
          wholeSequenceApplyValidation = await runAutomation(
            repoRoot,
            options.channel,
            path.join(outDir, `${prefix}-whole-sequence-validate.json`),
            "run-whole-sequence-apply-validation",
            ["--payload-file", validationPayloadPath]
          );
          timings.validationMs = Date.now() - started;
        }

        sequencerSnapshot = await runAutomation(
          repoRoot,
          options.channel,
          path.join(outDir, `${prefix}-sequencer-snapshot.json`),
          "get-sequencer-validation-snapshot"
        );
      } catch (err) {
        failure = String(err?.message || err);
      }

      scenarioHealthAfter = classifyAutomationHealth((await runAutomation(
        repoRoot,
        options.channel,
        path.join(outDir, `${prefix}-health-after.json`),
        "get-automation-health-snapshot"
      ))?.result || {});

      const practicalValidation = extractPracticalValidation(sequencerSnapshot, applyResponse);
      const wholeSequenceValidation = wholeSequenceApplyValidation?.result?.validation || null;
      const runtimeFailure = Boolean(failure) || !scenarioHealthAfter.ok;
      const ok = !runtimeFailure && practicalValidation?.overallOk === true && wholeSequenceValidation?.ok === true;

      results.push({
        name: str(scenario?.name),
        sequencePath: str(scenario?.sequencePath),
        timings: {
          totalMs: Date.now() - scenarioStartedAt,
          setShowFolderMs: Number(timings.setShowFolderMs || 0),
          openSequenceMs: Number(timings.openSequenceMs || 0),
          refreshMs: Number(timings.refreshMs || 0),
          setAudioMs: Number(timings.setAudioMs || 0),
          analyzeMs: Number(timings.analyzeMs || 0),
          seedTimingTracksMs: Number(timings.seedTimingTracksMs || 0),
          generateMs: Number(timings.generateMs || 0),
          applyMs: Number(timings.applyMs || 0),
          validationMs: Number(timings.validationMs || 0)
        },
        ok,
        failure,
        failureClass: runtimeFailure ? "automation_runtime" : (ok ? "" : "sequence_product"),
        automationHealthBefore: scenarioHealthBefore,
        automationHealthAfter: scenarioHealthAfter,
        practicalValidation,
        wholeSequenceApplyValidation: wholeSequenceApplyValidation?.result || null,
        generateResponse: generateResponse?.result || null,
        applyResponse: applyResponse?.result || null,
        sequencerSnapshot: sequencerSnapshot?.result || null
      });
    }
  } finally {
    for (const scenario of runtimeSuite.scenarios) {
      restoreValidationSequenceFromBaseline({
        sequencePath: str(scenario?.sequencePath),
        baselineSequencePath: str(scenario?.baselineSequencePath)
      });
    }
  }

  const failed = results.filter((row) => row.ok !== true);
  const report = {
    contract: "live_reviewed_timing_wholesequence_baseline_run_v1",
    version: "1.0",
    channel: options.channel,
    suitePath,
    runtimeSuitePath,
    outDir,
    ok: failed.length === 0,
    scenarioCount: results.length,
    failedScenarioCount: failed.length,
    failedScenarioNames: failed.map((row) => row.name),
    summary: failed.length === 0
      ? `Live reviewed timing whole-sequence baseline passed ${results.length}/${results.length} scenarios.`
      : `Live reviewed timing whole-sequence baseline passed ${results.length - failed.length}/${results.length} scenarios.`,
    initialAutomationHealth,
    timingSummary: summarizeTimingBaseline(results),
    results
  };

  const reportPath = path.join(outDir, "live-reviewed-timing-wholesequence-baseline-report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`);
  if (!report.ok) process.exitCode = 1;
}

await main();
