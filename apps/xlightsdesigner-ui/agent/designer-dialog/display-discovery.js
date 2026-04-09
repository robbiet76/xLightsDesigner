function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizedTagNames(context = {}) {
  return arr(context?.display?.labelNames)
    .map((row) => str(row))
    .filter(Boolean);
}

function normalizedFamilies(context = {}) {
  return arr(context?.display?.displayDiscoveryFamilies)
    .map((row) => ({
      name: str(row?.name),
      type: str(row?.type),
      count: str(row?.count),
      examples: str(row?.examples),
      reason: str(row?.reason)
    }))
    .filter((row) => row.name);
}

function normalizedTypeBreakdown(context = {}) {
  return arr(context?.display?.typeBreakdown)
    .map((row) => ({
      type: str(row?.type),
      count: str(row?.count)
    }))
    .filter((row) => row.type);
}

function normalizedModelSamples(context = {}) {
  return arr(context?.display?.modelSamples)
    .map((row) => ({
      name: str(row?.name),
      type: str(row?.type),
      nodeCount: str(row?.nodeCount),
      positionX: str(row?.positionX),
      positionY: str(row?.positionY),
      width: str(row?.width),
      height: str(row?.height)
    }))
    .filter((row) => row.name);
}

function looksLikeWorkflowPreference(text = "") {
  const lower = str(text).toLowerCase();
  if (!lower) return false;
  return (
    /\b(chat|conversation|dialog|guide|guided|workflow|process|step[- ]by[- ]step|questions?|confirm|confirmation|pages?|review|broad metadata|details? first|concise|brief|fewer questions|one question at a time)\b/.test(lower) &&
    !/\b(christmas|halloween|scary|cheerful|nostalgic|warm|cool|cinematic|palette|color|red|white|spooky|aggressive|gentle|dense|layered|style|look|mood|tone)\b/.test(lower)
  );
}

function isMeaningfulTagName(name = "") {
  const value = str(name).toLowerCase();
  if (!value) return false;
  if (/^test\d*$/.test(value)) return false;
  if (/^(tag|group|misc|temp|tmp)\d*$/.test(value)) return false;
  return true;
}

export function hasMeaningfulDisplayMetadata(context = {}) {
  const tagNames = normalizedTagNames(context).filter(isMeaningfulTagName);
  const labeledTargetCount = Number(context?.display?.labeledTargetCount || 0);
  return tagNames.length > 0 && labeledTargetCount > 0;
}

export function shouldStartDisplayDiscovery({ context = {}, userMessage = "" } = {}) {
  const text = str(userMessage).toLowerCase();
  if (hasMeaningfulDisplayMetadata(context)) return false;
  if (!Number(context?.display?.targetCount || 0)) return false;
  return (
    /\b(display|layout|tag|metadata|models|props)\b/.test(text) ||
    /\b(start|begin|understand|learn|get to know|guide|help)\b/.test(text) ||
    (/\bdesign\b/.test(text) && !/\bapply|render|save|open sequence\b/.test(text))
  );
}

export function shouldContinueDisplayDiscovery({ context = {} } = {}) {
  const status = str(context?.displayDiscovery?.status).toLowerCase();
  return status === "in_progress" && !hasMeaningfulDisplayMetadata(context);
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
    if (!looksLikeWorkflowPreference(normalized)) return;
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
  const families = normalizedFamilies(context);
  const typeBreakdown = normalizedTypeBreakdown(context);
  const modelSamples = normalizedModelSamples(context);
  const candidates = arr(context?.display?.displayDiscoveryCandidates)
    .map((row) => ({
      name: str(row?.name),
      type: str(row?.type),
      reason: str(row?.reason)
    }))
    .filter((row) => row.name);

  const candidateSummary = candidates.length
    ? candidates.map((row) => `${row.name} (${row.type || "unknown type"}: ${row.reason || "candidate prop"})`).join("; ")
    : "No specific candidate props were identified from current layout names.";
  const familySummary = families.length
    ? families.map((row) => `${row.name} (${row.count || "?"} ${row.type || "model"} models${row.examples ? `; examples: ${row.examples}` : ""})`).join("; ")
    : "No repeated model families were identified.";
  const typeSummary = typeBreakdown.length
    ? typeBreakdown.map((row) => `${row.type}: ${row.count}`).join("; ")
    : "No type breakdown available.";
  const sampleSummary = modelSamples.length
    ? modelSamples
        .slice(0, 12)
        .map((row) => `${row.name} (${row.type || "unknown"}, nodes ${row.nodeCount || "?"}, x ${row.positionX || "?"}, size ${row.width || "?"}x${row.height || "?"})`)
        .join("; ")
    : "No raw model samples available.";

  return [
    "Display-discovery mode is available for this conversation.",
    "When layout metadata is thin, do not jump straight to final design directions.",
    "Instead, start a short 'Getting To Know Your Display' conversation.",
    "Before asking questions, analyze the raw model list for likely focal props, repeated families, type patterns, comparable node counts, and broad spatial patterns so your questions sound informed rather than random.",
    "Use the raw model samples as primary evidence. Use the repeated-family and candidate summaries only as supporting hints, not as hard truth.",
    "You are expected to notice loose naming patterns, approximate siblings, and visually similar repeated props even when the naming convention is imperfect.",
    "When several models appear to be the same prop family, ask about the family as one topic before drilling into individual exceptions.",
    "Start with model-level understanding first. Use group questions only after model questions, or when group meaning is not obvious from the models involved.",
    "Use likely prop candidates from layout names and types only as prompts for questions, never as confirmed truth.",
    "Phrase candidate mentions as observations such as 'I noticed...' or 'I see...' rather than as settled conclusions.",
    "Ask 2 to 4 concise questions that first classify one likely focal topic, one likely repeated family, and one broad display-structure topic as focal, supporting, repeating, or special themed elements.",
    "Only ask about groups early when a group itself appears to have unique meaning that cannot be inferred from its member models.",
    "If you mention a candidate prop, explain that you noticed it from the layout name/type and want confirmation before using it semantically.",
    `Model type breakdown: ${typeSummary}`,
    `Raw model samples: ${sampleSummary}`,
    `Repeated model families: ${familySummary}`,
    `Candidate props: ${candidateSummary}`
  ].join("\n");
}
