function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizedTagNames(context = {}) {
  return arr(context?.layout?.tagNames)
    .map((row) => str(row))
    .filter(Boolean);
}

function isMeaningfulTagName(name = "") {
  const value = str(name).toLowerCase();
  if (!value) return false;
  if (/^test\d*$/.test(value)) return false;
  if (/^(tag|group|misc|temp|tmp)\d*$/.test(value)) return false;
  return true;
}

export function hasMeaningfulLayoutMetadata(context = {}) {
  const tagNames = normalizedTagNames(context).filter(isMeaningfulTagName);
  const taggedTargetCount = Number(context?.layout?.taggedTargetCount || 0);
  return tagNames.length > 0 && taggedTargetCount > 0;
}

export function shouldStartDisplayDiscovery({ context = {}, userMessage = "" } = {}) {
  const text = str(userMessage).toLowerCase();
  if (hasMeaningfulLayoutMetadata(context)) return false;
  if (!Number(context?.layout?.targetCount || 0)) return false;
  return (
    /\b(display|layout|tag|metadata|models|props)\b/.test(text) ||
    /\b(start|begin|understand|learn|get to know|guide|help)\b/.test(text) ||
    (/\bdesign\b/.test(text) && !/\bapply|render|save|open sequence\b/.test(text))
  );
}

export function buildDisplayDiscoveryGuidance(context = {}) {
  const candidates = arr(context?.layout?.displayDiscoveryCandidates)
    .map((row) => ({
      name: str(row?.name),
      type: str(row?.type),
      reason: str(row?.reason)
    }))
    .filter((row) => row.name);

  const candidateSummary = candidates.length
    ? candidates.map((row) => `${row.name} (${row.type || "unknown type"}: ${row.reason || "candidate prop"})`).join("; ")
    : "No specific candidate props were identified from current layout names.";

  return [
    "Display-discovery mode is available for this conversation.",
    "When layout metadata is thin, do not jump straight to final design directions.",
    "Instead, start a short 'Getting To Know Your Display' conversation.",
    "Use likely prop candidates from layout names and types only as prompts for questions, never as confirmed truth.",
    "Phrase candidate mentions as observations such as 'I noticed...' or 'I see...' rather than as settled conclusions.",
    "Ask 2 to 4 concise questions that help classify focal props, supporting props, repeating groups, and special themed elements.",
    "If you mention a candidate prop, explain that you noticed it from the layout name/type and want confirmation before using it semantically.",
    `Candidate props: ${candidateSummary}`
  ].join("\n");
}
