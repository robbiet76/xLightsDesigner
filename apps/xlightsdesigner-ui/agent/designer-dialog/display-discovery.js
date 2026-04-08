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

export function shouldContinueDisplayDiscovery({ context = {} } = {}) {
  const status = str(context?.displayDiscovery?.status).toLowerCase();
  return status === "in_progress" && !hasMeaningfulLayoutMetadata(context);
}

export function inferUserPreferenceNotes(userMessage = "") {
  const text = str(userMessage);
  const lower = text.toLowerCase();
  const notes = [];
  const maybeAdd = (prefix, value) => {
    const normalized = str(value).replace(/[.?!]+$/, "");
    if (!normalized) return;
    if (normalized.length < 12) return;
    if (normalized.length > 160) return;
    notes.push(`${prefix}${normalized}`);
  };

  let match = text.match(/\bI prefer\b[:\s]+(.+)$/i);
  if (match) maybeAdd("User prefers ", match[1]);

  match = text.match(/\bI want\b[:\s]+(.+)$/i);
  if (match) maybeAdd("User wants ", match[1]);

  match = text.match(/\bwe should\b[:\s]+(.+)$/i);
  if (match) maybeAdd("Preferred workflow: ", match[1]);

  match = text.match(/\blet'?s\b[:\s]+(.+)$/i);
  if (match && /(keep|use|avoid|start|focus|guide|review|capture)/.test(lower)) {
    maybeAdd("Preferred workflow: ", match[1]);
  }

  if (/\bpages are really there to support the dialog\b/i.test(text)) {
    notes.push("Pages support the conversation and act as visual confirmation, not the primary control surface");
  }

  const sorted = Array.from(new Set(notes));
  const broadIndex = sorted.findIndex((note) => /broad metadata first/i.test(note));
  const guideIndex = sorted.findIndex((note) => /chat to guide/i.test(note));
  if (broadIndex >= 0 && guideIndex >= 0 && broadIndex != guideIndex) {
    return sorted.filter((_, index) => index !== guideIndex);
  }
  return sorted;
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
