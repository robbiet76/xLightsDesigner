import { evaluatePlanSafety } from './safety-policy.js';
import { validateCommandGraph } from "./command-graph.js";

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
    warnings: safety.warnings
  };
}
