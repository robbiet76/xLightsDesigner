function str(value = "") {
  return String(value || "").trim();
}

function cleanClause(value = "") {
  return str(value).replace(/\s+/g, " ").replace(/[.]+$/, "").trim();
}

function splitHintAndMeaning(rawName = "", rawMeaning = "", mode = "define") {
  const name = str(rawName).replace(/^["']|["']$/g, "").trim();
  const meaning = cleanClause(rawMeaning);
  if (!name || !meaning) return null;
  return {
    mode,
    name,
    description: meaning,
    behavioralIntent: meaning
  };
}

export function parseExplicitVisualHintDefinitionIntent(text = "") {
  const raw = str(text);
  if (!raw) return null;

  const patterns = [
    { mode: "define", pattern: /define\s+(?:the\s+)?visual\s+hint\s+["']?([^"'.:]+?)["']?\s+as\s+(.+)$/i },
    { mode: "define", pattern: /visual\s+hint\s+["']?([^"'.:]+?)["']?\s+means\s+(.+)$/i },
    { mode: "define", pattern: /["']([^"']+)["']\s+is\s+a\s+visual\s+hint\s+for\s+(.+)$/i },
    { mode: "define", pattern: /define\s+["']([^"']+)["']\s+as\s+a\s+visual\s+hint\s+for\s+(.+)$/i },
    { mode: "update", pattern: /update\s+(?:the\s+)?visual\s+hint\s+["']?([^"'.:]+?)["']?\s+to\s+mean\s+(.+)$/i },
    { mode: "update", pattern: /refine\s+(?:the\s+)?visual\s+hint\s+["']?([^"'.:]+?)["']?\s+to\s+mean\s+(.+)$/i },
    { mode: "update", pattern: /change\s+(?:the\s+)?visual\s+hint\s+["']?([^"'.:]+?)["']?\s+to\s+mean\s+(.+)$/i }
  ];

  for (const row of patterns) {
    const match = raw.match(row.pattern);
    if (!match) continue;
    return splitHintAndMeaning(match[1], match[2], row.mode);
  }
  return null;
}
