const DEFAULT_BLOCKED_PREFIXES = [
  'controllers.',
  'layout.set',
  'layout.create',
  'layout.update',
  'layout.delete'
];

export function evaluatePlanSafety(commands = [], options = {}) {
  const maxCommands = Number.isFinite(options?.maxCommands) ? Number(options.maxCommands) : 200;
  const blockedPrefixes = Array.isArray(options?.blockedPrefixes)
    ? options.blockedPrefixes
    : DEFAULT_BLOCKED_PREFIXES;

  const errors = [];
  const warnings = [];
  const rows = Array.isArray(commands) ? commands : [];

  if (!rows.length) {
    errors.push('Plan is empty.');
  }
  if (rows.length > maxCommands) {
    errors.push(`Plan exceeds max command limit (${rows.length}/${maxCommands}).`);
  }

  for (const row of rows) {
    const cmd = String(row?.cmd || '').trim();
    if (!cmd) {
      errors.push('Plan contains command with empty cmd.');
      continue;
    }
    if (blockedPrefixes.some((prefix) => cmd.startsWith(prefix))) {
      errors.push(`Blocked command in plan: ${cmd}`);
    }
  }

  // Group-level conflict safety: mixed insert/replace on same timing track in one plan.
  const timingWriteKindsByTrack = new Map();
  for (const row of rows) {
    const cmd = String(row?.cmd || "").trim();
    if (cmd !== "timing.insertMarks" && cmd !== "timing.replaceMarks") continue;
    const trackName = String(row?.params?.trackName || "").trim();
    if (!trackName) continue;
    const kinds = timingWriteKindsByTrack.get(trackName) || new Set();
    kinds.add(cmd);
    timingWriteKindsByTrack.set(trackName, kinds);
  }
  for (const [trackName, kinds] of timingWriteKindsByTrack.entries()) {
    if (kinds.has("timing.insertMarks") && kinds.has("timing.replaceMarks")) {
      errors.push(`Conflicting timing write group for track ${trackName}: insertMarks + replaceMarks.`);
    }
  }

  if (rows.length >= 50) {
    warnings.push(`Large plan size: ${rows.length} commands.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    commandCount: rows.length
  };
}
