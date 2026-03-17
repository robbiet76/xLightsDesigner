function clampLines(lines, max = 8) {
  return lines.filter(Boolean).slice(0, max);
}

export function buildSequencingStrategy(normalizedIntent, targets = []) {
  const intent = normalizedIntent || {};
  const targetNames = targets.map((t) => String(t?.name || t?.id || "").trim()).filter(Boolean);
  const targetText = targetNames.length ? targetNames.join(" + ") : "Whole Show";
  const sections = Array.isArray(intent.sections) && intent.sections.length ? intent.sections : ["General"];
  const goal = String(intent.goal || "").trim();
  const lowerGoal = goal.toLowerCase();

  const isDirectEffectRequest =
    /(apply|set|make|put|add)\b/.test(lowerGoal) &&
    targetNames.length > 0 &&
    Array.isArray(intent.effectOverrides) &&
    intent.effectOverrides.length > 0;

  if (isDirectEffectRequest) {
    const effectName = String(intent.effectOverrides[0] || "").trim();
    const colorText = String(intent.explicitColor || "").trim();
    const rawDurationMs = intent.durationMs;
    const durationMs =
      rawDurationMs == null || rawDurationMs === ""
        ? null
        : (Number.isFinite(Number(rawDurationMs)) ? Math.max(1, Number(rawDurationMs)) : null);
    const startText = String(intent.startHint || "").trim() === "track_start" ? "starting at 0 ms" : "using the current target timing";
    const durationText = durationMs ? `for ${durationMs} ms` : "for the requested duration";
    const colorClause = colorText ? ` in ${colorText}` : "";
    return clampLines([
      `${sections[0]} / ${targetText} / apply ${effectName} effect${colorClause} ${durationText} ${startText}`
    ], 4);
  }

  const directives = [];
  for (const section of sections.slice(0, 3)) {
    if (intent.tempoIntent === "increase") {
      directives.push(`${section} / ${targetText} / increase pulse contrast and accelerate motion pacing into phrase peaks`);
    } else if (intent.tempoIntent === "decrease") {
      directives.push(`${section} / ${targetText} / reduce motion density and favor longer fades with cleaner transitions`);
    } else {
      directives.push(`${section} / ${targetText} / preserve groove and improve clarity with tighter transition timing`);
    }

    if (intent.motionIntent === "punchy") {
      directives.push(`${section} / ${targetText} / use punchy accents on downbeats with controlled high-contrast hits`);
    } else if (intent.motionIntent === "smooth") {
      directives.push(`${section} / ${targetText} / emphasize smooth sweeps and gentle shimmer layers for continuity`);
    } else {
      directives.push(`${section} / ${targetText} / balance focal effects and ambient beds to keep readable depth`);
    }
  }

  if (Array.isArray(intent.effectOverrides) && intent.effectOverrides.length) {
    directives.push(`Global / ${targetText} / honor explicit user effect preferences: ${intent.effectOverrides.join(", ")}`);
  }
  return clampLines(directives, 10);
}
