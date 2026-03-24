function str(value = "") {
  return String(value || "").trim();
}

function cleanClause(value = "") {
  return str(value).replace(/\s+/g, " ").replace(/[.]+$/, "").trim();
}

function splitHintAndMeaning(rawName = "", rawMeaning = "") {
  const name = str(rawName).replace(/^["']|["']$/g, "").trim();
  const meaning = cleanClause(rawMeaning);
  if (!name || !meaning) return null;
  return {
    name,
    description: meaning,
    behavioralIntent: meaning
  };
}

export function parseExplicitVisualHintDefinitionIntent(text = "") {
  const raw = str(text);
  if (!raw) return null;

  const patterns = [
    /define\s+(?:the\s+)?visual\s+hint\s+["']?([^"'.:]+?)["']?\s+as\s+(.+)$/i,
    /visual\s+hint\s+["']?([^"'.:]+?)["']?\s+means\s+(.+)$/i,
    /["']([^"']+)["']\s+is\s+a\s+visual\s+hint\s+for\s+(.+)$/i,
    /define\s+["']([^"']+)["']\s+as\s+a\s+visual\s+hint\s+for\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    return splitHintAndMeaning(match[1], match[2]);
  }
  return null;
}
