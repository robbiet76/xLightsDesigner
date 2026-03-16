import { evaluatePlanSafety } from '../safety-policy.js';
import { validateCommandGraph } from "./command-graph.js";

function str(value = "") {
  return String(value || "").trim();
}

function toInt(value, fallback = -1) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function buildOwnedSequencingBatchPlan(commands = []) {
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
    replaceExistingMarks: markCommand.cmd === "timing.replaceMarks",
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
  safetyOptions = {}
} = {}) {
  if (!endpoint) throw new Error('endpoint is required');
  if (typeof getRevision !== 'function') throw new Error('getRevision function is required');
  if (typeof validateCommands !== 'function') throw new Error('validateCommands function is required');
  if (typeof beginTransaction !== 'function') throw new Error('beginTransaction function is required');
  if (typeof commitTransaction !== 'function') throw new Error('commitTransaction function is required');
  if (typeof rollbackTransaction !== 'function') throw new Error('rollbackTransaction function is required');
  if (typeof stageTransactionCommand !== 'function') throw new Error('stageTransactionCommand function is required');

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

  const rev = await getRevision(endpoint);
  const currentRevision = rev?.data?.revision ?? 'unknown';
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

  const ownedBatchPlan = buildOwnedSequencingBatchPlan(commands);
  if (ownedBatchPlan && typeof applySequencingBatchPlan === "function" && typeof getOwnedJob === "function") {
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
      const postRev = await getRevision(endpoint).catch(() => ({ data: { revision: currentRevision } }));
      const nextRevision = postRev?.data?.revision ?? currentRevision;
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
      if (!/NOT_FOUND|Failed to fetch|NetworkError|404|owned endpoint/i.test(message)) {
        return {
          ok: false,
          stage: "runtime",
          error: message
        };
      }
    }
  }

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
