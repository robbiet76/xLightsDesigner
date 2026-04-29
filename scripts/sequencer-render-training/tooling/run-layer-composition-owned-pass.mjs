import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ENDPOINT = "http://127.0.0.1:49915/xlightsdesigner/api";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function normalizeJobState(state = "") {
  const text = str(state).toLowerCase();
  if (text === "completed" || text === "succeeded") return "completed";
  if (text === "failed") return "failed";
  if (text === "queued" || text === "running") return text;
  return "";
}

function modalBlockedMessage(healthJson = {}) {
  const data = healthJson?.data && typeof healthJson.data === "object" ? healthJson.data : {};
  const modalState = data?.modalState && typeof data.modalState === "object" ? data.modalState : null;
  if (!modalState || modalState.observed === false || modalState.blocked !== true) return "";
  const titles = arr(modalState.windows)
    .filter((window) => window?.isModal)
    .map((window) => str(window?.title || window?.className))
    .filter(Boolean);
  return `xLights is blocked by a modal${titles.length ? `: ${titles.join(", ")}` : ""}`;
}

function isReadyHealth(healthJson = {}) {
  const data = healthJson?.data && typeof healthJson.data === "object" ? healthJson.data : {};
  const state = str(data.state || data.startupState || data.status).toLowerCase();
  const listenerReachable = data.listenerReachable !== false;
  const appReady = data.appReady !== false;
  const startupSettled = data.startupSettled === true || state === "ready";
  return healthJson?.ok === true && listenerReachable && appReady && startupSettled && !modalBlockedMessage(healthJson);
}

async function requestJson(endpoint, route, { method = "GET", body = null, request = fetch } = {}) {
  const response = await request(`${endpoint}${route}`, {
    method,
    headers: body == null ? undefined : { "Content-Type": "application/json" },
    body: body == null ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${method} ${route}: ${text}`);
  }
  if (!response.ok || json?.ok === false) {
    throw new Error(`${method} ${route} failed (${response.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function assertOwnedReady(endpoint, deps = {}) {
  const health = await requestJson(endpoint, "/health", deps);
  const modalMessage = modalBlockedMessage(health);
  if (modalMessage) throw new Error(modalMessage);
  if (!isReadyHealth(health)) {
    throw new Error(`Owned xLights API is not ready: ${JSON.stringify(health)}`);
  }
  return health;
}

async function waitForJob(endpoint, jobId, deps = {}) {
  const timeoutMs = Number(deps.timeoutMs || 180000);
  const pollMs = Number(deps.pollMs || 1000);
  const started = Date.now();
  for (;;) {
    await assertOwnedReady(endpoint, deps);
    const job = await requestJson(endpoint, `/jobs/get?jobId=${encodeURIComponent(jobId)}`, deps);
    const state = normalizeJobState(job?.data?.state || job?.state);
    if (state === "completed") {
      const result = job?.data?.result && typeof job.data.result === "object" ? job.data.result : job;
      if (result?.ok === false) throw new Error(`Job ${jobId} completed with failure: ${JSON.stringify(result)}`);
      return result;
    }
    if (state === "failed") throw new Error(`Job ${jobId} failed: ${JSON.stringify(job)}`);
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for job ${jobId}`);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

async function settleQueued(endpoint, route, json, deps = {}) {
  const jobId = str(json?.data?.jobId || json?.jobId);
  const accepted = json?.data?.accepted === true || json?.accepted === true;
  if (!jobId && !accepted) return json;
  if (!jobId) throw new Error(`${route} returned accepted response without jobId: ${JSON.stringify(json)}`);
  return waitForJob(endpoint, jobId, deps);
}

async function postAndSettle(endpoint, route, body = {}, deps = {}) {
  const json = await requestJson(endpoint, route, { ...deps, method: "POST", body });
  return settleQueued(endpoint, route, json, deps);
}

async function resolveRenderedFseqPath(endpoint, sequencePath, renderResult = {}, deps = {}) {
  const direct = str(renderResult?.data?.fseqPath || renderResult?.fseqPath);
  if (direct && fs.existsSync(direct)) return direct;
  const media = await requestJson(endpoint, "/media/current", deps);
  const showDirectory = str(media?.data?.showDirectory);
  const openSequencePath = str(media?.data?.sequencePath || sequencePath);
  const base = path.basename(openSequencePath, ".xsq");
  const candidates = [
    path.join(path.dirname(openSequencePath), `${base}.fseq`),
    showDirectory ? path.join(showDirectory, `${base}.fseq`) : "",
    direct
  ].filter(Boolean);
  return candidates.find((candidate) => fs.existsSync(candidate)) || direct || "";
}

function commandBodies(passExecution = {}) {
  return arr(passExecution.directCommands)
    .filter((command) => str(command?.cmd) === "sequencer.setDisplayElementOrder")
    .map((command) => ({
      route: "/elements/display-order",
      body: { orderedIds: JSON.stringify(arr(command?.params?.orderedIds).map(str).filter(Boolean)) }
    }));
}

export async function runLayerCompositionOwnedPass({
  endpoint = DEFAULT_ENDPOINT,
  sequencePath,
  passExecution,
  deps = {}
} = {}) {
  const sequence = path.resolve(str(sequencePath));
  if (!sequence) throw new Error("sequencePath is required");
  if (!fs.existsSync(sequence)) throw new Error(`Sequence not found: ${sequence}`);
  if (passExecution?.artifactType !== "layer_composition_pass_execution_v1") {
    throw new Error("passExecution must be layer_composition_pass_execution_v1");
  }
  const startedAt = new Date().toISOString();
  const steps = [];

  await assertOwnedReady(endpoint, deps);
  try {
    const closeBefore = await postAndSettle(endpoint, "/sequence/close", { force: true, quiet: true }, deps);
    steps.push({ step: "close_before_open", ok: true, result: closeBefore });
  } catch (error) {
    steps.push({ step: "close_before_open", ok: false, ignored: true, error: str(error?.message || error) });
  }

  steps.push({ step: "open_sequence", ok: true, result: await postAndSettle(endpoint, "/sequence/open", {
    file: sequence,
    force: true,
    promptIssues: false
  }, deps) });

  for (const body of commandBodies(passExecution)) {
    steps.push({ step: "direct_display_order", ok: true, result: await postAndSettle(endpoint, body.route, body.body, deps) });
  }

  if (arr(passExecution?.ownedBatchPayload?.effects).length) {
    steps.push({ step: "apply_batch_plan", ok: true, result: await postAndSettle(
      endpoint,
      "/sequencing/apply-batch-plan",
      passExecution.ownedBatchPayload || {},
      deps
    ) });
  } else {
    steps.push({
      step: "apply_batch_plan",
      ok: true,
      skipped: true,
      reason: "empty_control_pass"
    });
  }

  try {
    steps.push({ step: "save_sequence", ok: true, result: await postAndSettle(endpoint, "/sequence/save", { file: sequence }, deps) });
  } catch (error) {
    steps.push({ step: "save_sequence", ok: false, warning: str(error?.message || error) });
  }

  const renderResult = await postAndSettle(endpoint, "/sequence/render-current", {}, deps);
  steps.push({ step: "render_current", ok: true, result: renderResult });
  const fseqPath = await resolveRenderedFseqPath(endpoint, sequence, renderResult, deps);
  if (!fseqPath) throw new Error("render-current completed but no FSEQ path could be resolved");

  try {
    steps.push({ step: "close_after_render", ok: true, result: await postAndSettle(endpoint, "/sequence/close", { force: true, quiet: true }, deps) });
  } catch (error) {
    steps.push({ step: "close_after_render", ok: false, ignored: true, error: str(error?.message || error) });
  }

  return {
    artifactType: "layer_composition_owned_pass_result_v1",
    artifactVersion: 1,
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    endpoint,
    sequencePath: sequence,
    runId: str(passExecution.runId),
    experimentId: str(passExecution.experimentId),
    passId: str(passExecution.passId),
    learningId: str(passExecution.learningId),
    fseqPath,
    unsupportedLayerSettings: arr(passExecution.unsupportedLayerSettings),
    steps
  };
}

function parseArgs(argv) {
  const args = {
    endpoint: DEFAULT_ENDPOINT,
    sequencePath: "",
    passExecutionPath: "",
    resultPath: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--endpoint") args.endpoint = str(argv[++index]);
    else if (arg === "--sequence") args.sequencePath = str(argv[++index]);
    else if (arg === "--pass-execution") args.passExecutionPath = str(argv[++index]);
    else if (arg === "--result") args.resultPath = str(argv[++index]);
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/sequencer-render-training/tooling/run-layer-composition-owned-pass.mjs --sequence <working.xsq> --pass-execution <pass-execution.json> --result <result.json>
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(usage());
    return;
  }
  if (!args.sequencePath) throw new Error("--sequence is required");
  if (!args.passExecutionPath) throw new Error("--pass-execution is required");
  if (!args.resultPath) throw new Error("--result is required");
  const result = await runLayerCompositionOwnedPass({
    endpoint: args.endpoint,
    sequencePath: args.sequencePath,
    passExecution: readJson(args.passExecutionPath)
  });
  writeJson(args.resultPath, result);
  process.stdout.write(`${args.resultPath}\n`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exit(1);
  });
}
