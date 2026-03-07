function clampLines(lines, max = 8) {
  return lines.filter(Boolean).slice(0, max);
}

export function buildSequencingStrategy(normalizedIntent, targets = []) {
  const intent = normalizedIntent || {};
  const targetNames = targets.map((t) => String(t?.name || t?.id || "").trim()).filter(Boolean);
  const targetText = targetNames.length ? targetNames.join(" + ") : "Whole Show";
  const sections = Array.isArray(intent.sections) && intent.sections.length ? intent.sections : ["General"];

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

  if (intent.creativeBrief?.visualCues) {
    directives.push(`Global / ${targetText} / align palette and texture choices to brief visual cues: ${intent.creativeBrief.visualCues}`);
  }
  if (Array.isArray(intent.effectOverrides) && intent.effectOverrides.length) {
    directives.push(`Global / ${targetText} / honor explicit user effect preferences: ${intent.effectOverrides.join(", ")}`);
  }
  return clampLines(directives, 10);
}
