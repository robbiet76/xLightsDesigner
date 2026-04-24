import { evaluatePlanSafety } from '../safety-policy.js';
import { validateCommandGraph } from "./command-graph.js";

function str(value = "") {
  return String(value || "").trim();
}

function norm(value = "") {
  return str(value).toLowerCase();
}

function toInt(value, fallback = -1) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function buildOwnedSequencingBatchPlan(commands = []) {
  const rows = Array.isArray(commands) ? commands : [];
  let trackName = "";
  let markCommand = null;
  const effects = [];

  for (const step of rows) {
    const cmd = str(step?.cmd);
    const params = step?.params && typeof step.params === "object" ? step.params : {};
    if (cmd === "timing.createTrack") {
      trackName = str(params.trackName || trackName);
      continue;
    }
    if (cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") {
      if (markCommand) return null;
      markCommand = { cmd, params };
      trackName = str(params.trackName || trackName);
      continue;
    }
    if (cmd === "effects.create") {
      const modelName = str(params.modelName);
      const effectName = str(params.effectName);
      const layer = toInt(params.layerIndex, -1);
      const startMs = toInt(params.startMs, -1);
      const endMs = toInt(params.endMs, -1);
      if (!modelName || !effectName || layer < 0 || startMs < 0 || endMs < startMs) {
        return null;
      }
      effects.push({
        element: modelName,
        layer,
        effectName,
        startMs,
        endMs,
        settings: params.settings ?? "",
        palette: params.palette ?? "",
        clearExisting: false
      });
      continue;
    }
    if (cmd === "effects.alignToTiming") {
      const timingTrackName = str(params.timingTrackName);
      if (timingTrackName && trackName && timingTrackName !== trackName) return null;
      continue;
    }
    return null;
  }

  if (!trackName || !markCommand || !effects.length) return null;
  const marks = Array.isArray(markCommand.params?.marks) ? markCommand.params.marks : [];
  if (marks.length < 2) return null;
  const normalizedMarks = marks.map((row) => ({
    label: str(row?.label),
    startMs: toInt(row?.startMs, -1),
    endMs: toInt(row?.endMs, -1)
  }));
  if (normalizedMarks.some((row) => row.startMs < 0 || row.endMs < row.startMs)) return null;

  return {
    track: trackName,
    replaceExistingMarks: markCommand.cmd === "timing.replaceMarks" || norm(trackName) === "xd: song structure",
    marks: normalizedMarks,
    effects
  };
}

async function waitForOwnedJob(endpoint, jobId, getOwnedJob, attempts = 40, delayMs = 500) {
  for (let idx = 0; idx < attempts; idx += 1) {
    const body = await getOwnedJob(endpoint, jobId);
    const state = str(body?.data?.state).toLowerCase();
    if (state === "succeeded" || state === "completed") return body;
    if (state === "failed") return body;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timed out waiting for owned xLights job ${jobId}.`);
}

function isOwnedApiUnavailable(message = "") {
  const text = norm(message);
  return (
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("load failed") ||
    text.includes("couldn't connect") ||
    text.includes("not found") ||
    text.includes("econnrefused")
  );
}

function isOwnedEndpoint(endpoint = "") {
  const text = norm(endpoint);
  return text.includes("/xlightsdesigner/api") || text.includes(":49915/");
}

function isOwnedHealthReady(health = {}) {
  const data = health?.data && typeof health.data === "object" ? health.data : {};
  const state = norm(data.state || data.startupState || data.status);
  const listenerReachable = data.listenerReachable === true;
  const appReady = data.appReady == null ? true : data.appReady === true;
  const startupSettled = data.startupSettled === true || state === "ready";
  return health?.ok === true && listenerReachable && appReady && startupSettled;
}

export async function validateAndApplyPlan({
  endpoint,
  commands,
  expectedRevision = 'unknown',
  getRevision,
  validateCommands,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  stageTransactionCommand,
  applySequencingBatchPlan = null,
  getOwnedJob = null,
  getOwnedHealth = null,
  getOwnedRevision = null,
  safetyOptions = {}
} = {}) {
  if (!endpoint) throw new Error('endpoint is required');
  if (typeof getRevision !== 'function') throw new Error('getRevision function is required');
  if (typeof validateCommands !== 'function') throw new Error('validateCommands function is required');

  const safety = evaluatePlanSafety(commands, safetyOptions);
  if (!safety.ok) {
    return {
      ok: false,
      stage: 'safety',
      error: safety.errors.join('\n'),
      details: safety
    };
  }

  const graph = validateCommandGraph(commands);
  if (!graph.ok) {
    return {
      ok: false,
      stage: "graph",
      error: graph.errors.join("\n"),
      details: graph
    };
  }

  const ownedBatchPlan = buildOwnedSequencingBatchPlan(commands);
  const ownedPathAvailable = Boolean(
    ownedBatchPlan &&
    typeof applySequencingBatchPlan === "function" &&
    typeof getOwnedJob === "function"
  );
  let currentRevision = 'unknown';
  let ownedApiReady = false;
  let ownedHealthError = "";
  let ownedHealth = null;

  if (ownedPathAvailable) {
    if (typeof getOwnedHealth !== "function") {
      return {
        ok: false,
        stage: "runtime",
        error: "owned xLights API health probe is required for compressible apply plans"
      };
    }
    try {
      ownedHealth = await getOwnedHealth(endpoint);
      ownedApiReady = isOwnedHealthReady(ownedHealth);
      if (typeof getOwnedRevision === 'function') {
        const rev = await getOwnedRevision(endpoint).catch(() => ({ data: { revision: 'unknown' } }));
        currentRevision = str(rev?.data?.revision || rev?.data?.revisionToken || 'unknown') || 'unknown';
      }
    } catch (err) {
      ownedApiReady = false;
      ownedHealthError = str(err?.message || err);
    }
  }

  if (ownedPathAvailable && isOwnedEndpoint(endpoint) && !ownedApiReady) {
    const state = str(ownedHealth?.data?.state || ownedHealth?.data?.startupState || "unknown") || "unknown";
    const reason = ownedHealthError || `owned xLights API not ready (state=${state})`;
    return {
      ok: false,
      stage: "runtime",
      error: `owned xLights API unavailable: ${reason}`
    };
  }

  if (!ownedApiReady) {
    const rev = await getRevision(endpoint);
    currentRevision = rev?.data?.revision ?? 'unknown';
  } else {
    // already populated from owned revision path above
  }

  if (
    expectedRevision &&
    expectedRevision !== 'unknown' &&
    currentRevision !== 'unknown' &&
    currentRevision !== expectedRevision
  ) {
    return {
      ok: false,
      stage: 'revision',
      error: `Revision mismatch. expected=${expectedRevision} current=${currentRevision}`,
      details: { expectedRevision, currentRevision }
    };
  }

  const shouldUseOwnedPath = ownedPathAvailable && ownedApiReady;

  if (shouldUseOwnedPath) {
    if (typeof getOwnedHealth !== "function") {
      return {
        ok: false,
        stage: "runtime",
        error: "owned xLights API health probe is required for compressible apply plans"
      };
    }
    try {
    } catch (err) {
      return {
        ok: false,
        stage: "runtime",
        error: `owned xLights API unavailable: ${str(err?.message || err)}`
      };
    }
    try {
      const accepted = await applySequencingBatchPlan(endpoint, ownedBatchPlan);
      const jobId = str(accepted?.data?.jobId);
      if (!jobId) {
        return {
          ok: false,
          stage: "runtime",
          error: "owned sequencing.applyBatchPlan returned no jobId",
          details: accepted
        };
      }
      const settled = await waitForOwnedJob(endpoint, jobId, getOwnedJob);
      const state = str(settled?.data?.state).toLowerCase();
      if (state === "failed") {
        return {
          ok: false,
          stage: "runtime",
          error: str(settled?.data?.result?.error?.message || "owned sequencing.applyBatchPlan failed"),
          details: settled
        };
      }
      const postRev = typeof getOwnedRevision === 'function'
        ? await getOwnedRevision(endpoint).catch(() => ({ data: { revision: currentRevision } }))
        : { data: { revision: currentRevision } };
      const nextRevision = str(postRev?.data?.revision || postRev?.data?.revisionToken || currentRevision) || currentRevision;
      return {
        ok: true,
        stage: "done",
        executedCount: Array.isArray(commands) ? commands.length : 0,
        jobId,
        currentRevision,
        nextRevision,
        warnings: safety.warnings,
        applyPath: "owned_batch_plan"
      };
    } catch (err) {
      const message = str(err?.message || err);
      if (isOwnedApiUnavailable(message) && !isOwnedEndpoint(endpoint)) {
        // Fall through to legacy transaction apply when the owned sidecar is down.
      } else {
      return {
        ok: false,
        stage: "runtime",
        error: `owned sequencing.applyBatchPlan failed: ${message}`
      };
      }
    }
  }

  if (typeof beginTransaction !== 'function') throw new Error('beginTransaction function is required for legacy transaction apply');
  if (typeof commitTransaction !== 'function') throw new Error('commitTransaction function is required for legacy transaction apply');
  if (typeof rollbackTransaction !== 'function') throw new Error('rollbackTransaction function is required for legacy transaction apply');
  if (typeof stageTransactionCommand !== 'function') throw new Error('stageTransactionCommand function is required for legacy transaction apply');

  const validation = await validateCommands(
    endpoint,
    (Array.isArray(commands) ? commands : []).map((step) => ({ cmd: step.cmd, params: step.params }))
  );
  if (validation?.data?.valid === false) {
    const invalidResults = (validation?.data?.results || []).filter((r) => r.valid === false);
    const detailText = invalidResults
      .map((r) => {
        const code = r?.error?.code || 'VALIDATION_ERROR';
        const msg = r?.error?.message || 'Invalid command';
        return `step ${r.index}: ${code} - ${msg}`;
      })
      .join('\n');

    return {
      ok: false,
      stage: 'validate',
      error: detailText || 'Validation failed with no detailed payload.',
      details: { invalidResults }
    };
  }

  let executedCount = 0;
  let jobId = null;
  let commitRevision = "";
  let transactionId = "";
  try {
    const begun = await beginTransaction(endpoint);
    transactionId = String(begun?.data?.transactionId || "").trim();
    if (!transactionId) {
      return {
        ok: false,
        stage: "runtime",
        error: "transactions.begin returned no transactionId",
        details: begun
      };
    }

    for (const step of Array.isArray(commands) ? commands : []) {
      await stageTransactionCommand(endpoint, transactionId, step);
      executedCount += 1;
    }

    const commit = await commitTransaction(
      endpoint,
      transactionId,
      expectedRevision && expectedRevision !== "unknown" ? expectedRevision : null
    );
    commitRevision = String(commit?.data?.newRevision || "").trim();
  } catch (err) {
    if (transactionId) {
      try {
        await rollbackTransaction(endpoint, transactionId);
      } catch {
        // Best-effort rollback only.
      }
    }
    return {
      ok: false,
      stage: "runtime",
      error: String(err?.message || err || "transaction apply failed")
    };
  }

  const postRev = await getRevision(endpoint).catch(() => ({ data: { revision: currentRevision } }));
  const nextRevision = commitRevision || (postRev?.data?.revision ?? currentRevision);

  return {
    ok: true,
    stage: 'done',
    executedCount,
    jobId,
    currentRevision,
    nextRevision,
    warnings: safety.warnings,
    applyPath: "legacy_transactions"
  };
}
