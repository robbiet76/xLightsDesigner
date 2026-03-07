import { evaluatePlanSafety } from './safety-policy.js';

export async function validateAndApplyPlan({
  endpoint,
  commands,
  expectedRevision = 'unknown',
  getRevision,
  validateCommands,
  executePlan,
  safetyOptions = {}
} = {}) {
  if (!endpoint) throw new Error('endpoint is required');
  if (typeof getRevision !== 'function') throw new Error('getRevision function is required');
  if (typeof validateCommands !== 'function') throw new Error('validateCommands function is required');
  if (typeof executePlan !== 'function') throw new Error('executePlan function is required');

  const safety = evaluatePlanSafety(commands, safetyOptions);
  if (!safety.ok) {
    return {
      ok: false,
      stage: 'safety',
      error: safety.errors.join('\n'),
      details: safety
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

  const result = await executePlan(endpoint, commands, true);
  const executedCount = result?.data?.executedCount ?? 0;
  const jobId = result?.data?.jobId || null;

  const postRev = await getRevision(endpoint).catch(() => ({ data: { revision: currentRevision } }));
  const nextRevision = postRev?.data?.revision ?? currentRevision;

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
