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
  const source = arr(context?.xlightsLayout?.families).length
    ? arr(context?.xlightsLayout?.families)
    : arr(context?.display?.displayDiscoveryFamilies);
  return source
    .map((row) => ({
      name: str(row?.name),
      type: str(row?.type),
      count: str(row?.count),
      examples: str(row?.examples),
      reason: str(row?.reason),
      confidence: str(row?.confidence),
      totalNodeCount: str(row?.totalNodeCount)
    }))
    .filter((row) => row.name);
}

function normalizedTypeBreakdown(context = {}) {
  const source = arr(context?.xlightsLayout?.typeBreakdown).length
    ? arr(context?.xlightsLayout?.typeBreakdown)
    : arr(context?.display?.typeBreakdown);
  return source
    .map((row) => ({
      type: str(row?.type),
      count: str(row?.count)
    }))
    .filter((row) => row.type);
}

function normalizedModelSamples(context = {}) {
  const source = arr(context?.xlightsLayout?.modelSamples).length
    ? arr(context?.xlightsLayout?.modelSamples)
    : arr(context?.display?.modelSamples);
  return source
    .map((row) => ({
      name: str(row?.name),
      type: str(row?.type),
      nodeCount: str(row?.nodeCount),
      positionX: str(row?.positionX),
      positionY: str(row?.positionY),
      positionZ: str(row?.positionZ),
      width: str(row?.width),
      height: str(row?.height),
      depth: str(row?.depth),
      horizontalZone: str(row?.horizontalZone),
      depthZone: str(row?.depthZone),
      visualWeight: str(row?.visualWeight),
      uniqueness: str(row?.uniqueness),
      symmetryPeers: arr(row?.symmetryPeers).map((value) => str(value)).filter(Boolean)
    }))
    .filter((row) => row.name);
}

function normalizedGroupMemberships(context = {}) {
  const source = arr(context?.xlightsLayout?.groupMemberships).length
    ? arr(context?.xlightsLayout?.groupMemberships)
    : arr(context?.display?.groupMemberships);
  return source
    .map((row) => ({
      groupName: str(row?.groupName),
      structureKind: str(row?.structureKind),
      relatedFamilies: arr(row?.relatedFamilies).map((value) => str(value)).filter(Boolean),
      supersetOfGroups: arr(row?.supersetOfGroups).map((value) => str(value)).filter(Boolean),
      overlapsWithGroups: arr(row?.overlapsWithGroups).map((value) => str(value)).filter(Boolean),
      directMembers: arr(row?.directMembers).map((member) => str(member?.name || member)).filter(Boolean),
      flattenedAllMembers: arr(row?.flattenedAllMembers).map((member) => str(member?.name || member)).filter(Boolean)
    }))
    .filter((row) => row.groupName);
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
  const route = str(context?.route).toLowerCase();
  if (route === "project") return false;
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
  const route = str(context?.route).toLowerCase();
  if (route === "project") return false;
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
  const groupMemberships = normalizedGroupMemberships(context);
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
    ? families.map((row) => `${row.name} (${row.count || "?"} ${row.type || "model"} models${row.examples ? `; examples: ${row.examples}` : ""}${row.confidence ? `; confidence ${row.confidence}` : ""}${row.totalNodeCount ? `; total nodes ${row.totalNodeCount}` : ""})`).join("; ")
    : "No repeated model families were identified.";
  const typeSummary = typeBreakdown.length
    ? typeBreakdown.map((row) => `${row.type}: ${row.count}`).join("; ")
    : "No type breakdown available.";
  const sampleSummary = modelSamples.length
    ? modelSamples
        .slice(0, 12)
        .map((row) => `${row.name} (${row.type || "unknown"}, nodes ${row.nodeCount || "?"}, zone ${row.horizontalZone || "?"}/${row.depthZone || "?"}, weight ${row.visualWeight || "?"}, uniqueness ${row.uniqueness || "?"}${row.symmetryPeers.length ? `, mirrored with ${row.symmetryPeers.join(", ")}` : ""})`)
        .join("; ")
    : "No raw model samples available.";
  const groupSummary = groupMemberships.length
    ? groupMemberships
        .slice(0, 12)
        .map((row) => `${row.groupName} (${row.structureKind || "group"}${row.relatedFamilies.length ? `; families: ${row.relatedFamilies.join(", ")}` : ""}${row.supersetOfGroups.length ? `; supersets: ${row.supersetOfGroups.join(", ")}` : ""}${row.overlapsWithGroups.length ? `; overlaps: ${row.overlapsWithGroups.join(", ")}` : ""})`)
        .join("; ")
    : "No group membership summary available.";

  return [
    "Display-discovery mode is available for this conversation.",
    "When layout metadata is thin, do not jump straight to final design directions.",
    "Start a natural conversation that helps the user teach you how their display is organized and what matters most.",
    "Before responding, analyze the raw model list for broad structural branches such as named props, major structures, repeated support families, architectural/background layers, and visually dominant clusters.",
    "Use the structural xlightsLayout context to form hypotheses about likely foreground, background, left/right balance, visually dominant props, repeated support families, and mirrored sets.",
    "Those structural signals are not user-facing truth by themselves. They are only evidence to help you choose better questions and recognize when the user has clarified something important.",
    "Use the raw model samples as primary evidence. Use the repeated-family and candidate summaries only as supporting hints, not as hard truth.",
    "Notice loose naming patterns, approximate siblings, and visually similar repeated props even when the naming convention is imperfect.",
    "Treat conversation as collaborative discovery, not a scripted interview.",
    "Behave like a real designer learning a display: attentive to visual hierarchy, framing, rhythm, balance, scene-setting, and where the eye will go first.",
    "Bring a little design perspective to the conversation. Do not just transcribe what the user says back to them.",
    "Keep that perspective grounded and restrained. The goal is to sound like a thoughtful designer, not a performer.",
    "Start broad, let the user steer, and narrow gradually.",
    "Choose the next useful question based on what the user has already emphasized and what is still needed to understand the display well, rather than following a fixed sequence of topics.",
    "Let the user's answer suggest the next design branch. If they describe a strong centerpiece, it is natural to ask what frames it or supports it. If they describe character props, it is natural to ask how those relate to the main structure. If they describe background architecture, it is natural to ask how active or quiet that layer should feel.",
    "As the display understanding grows, begin to sense the likely design language of the show without jumping ahead into fully formed design proposals, effect choices, or sequencing tactics.",
    "Optimize for information gain: ask the question that collapses the most important remaining uncertainty in a natural, efficient way.",
    "Prefer one natural question over a list. Ask a second question only when it is tightly coupled and truly needed.",
    "Avoid sounding like a form, checklist, or interview script.",
    "Do not try to cover every branch in one turn.",
    "Stop asking once you have enough semantic understanding to support a strong design starting point. Do not chase completeness for its own sake.",
    "For the first substantive discovery reply, ask one primary high-level question.",
    "In the first substantive discovery reply, do not use bullet lists.",
    "In the first substantive discovery reply, do not enumerate many candidate props, families, or groups.",
    "Avoid naming specific xLights models early unless it genuinely helps ground the question. Prefer broader visual language first, then narrow into named props when useful.",
    "Keep the first substantive discovery reply under roughly 70 words when possible.",
    "When several models appear to be the same prop family, treat that as one possible branch of conversation rather than multiple separate first-turn questions.",
    "Start with model-level understanding first. Use group questions only after model questions, or when group meaning is not obvious from the models involved.",
    "Use likely prop candidates from layout names and types only as prompts for questions, never as confirmed truth.",
    "When you refer to a specific xLights model or family, use the exact xLights name and wrap it in backticks so it is visually distinct from normal conversation.",
    "Do not replace xLights names with conversational aliases or prettier names unless the exact xLights name is also shown.",
    "Phrase structural observations as observations such as 'I noticed...' or 'I see...' rather than as settled conclusions.",
    "Keep early questions high level unless the user has already narrowed the topic.",
    "Avoid repetitive wording and avoid sounding like a checklist or bot.",
    "When possible, ask the smallest useful next question that helps you understand how the user thinks about the display.",
    "Only ask about groups early when a group itself appears to have unique meaning that cannot be inferred from its member models.",
    "If you mention a candidate prop, explain that you noticed it from the layout name or structure and want confirmation before using it semantically.",
    `Model type breakdown: ${typeSummary}`,
    `Raw model samples: ${sampleSummary}`,
    `Repeated model families: ${familySummary}`,
    `Group membership summary: ${groupSummary}`,
    `Candidate props: ${candidateSummary}`
  ].join("\n");
}
