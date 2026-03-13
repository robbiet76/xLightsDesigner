import {
  buildCreativeBriefContract,
  buildProposalBundle,
  buildDesignerDialogResult,
  DESIGNER_DIALOG_CONTRACT_VERSION
} from "./designer-dialog-contracts.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pushRequiredString(errors, obj, path) {
  const value = path.split(".").reduce((cur, key) => (isPlainObject(cur) ? cur[key] : undefined), obj);
  if (!str(value)) errors.push(`${path} is required`);
}

export function validateDesignerCloudResponse(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.responseType) !== "designer_cloud_response_v1") {
    errors.push("responseType must be designer_cloud_response_v1");
  }
  if (str(obj.responseVersion) !== DESIGNER_DIALOG_CONTRACT_VERSION) {
    errors.push(`responseVersion must be ${DESIGNER_DIALOG_CONTRACT_VERSION}`);
  }
  pushRequiredString(errors, obj, "assistantMessage");
  pushRequiredString(errors, obj, "summary");

  if (obj.brief != null && !isPlainObject(obj.brief)) errors.push("brief must be an object when provided");
  if (obj.proposal != null && !isPlainObject(obj.proposal)) errors.push("proposal must be an object when provided");
  if (obj.guidedQuestions != null && !Array.isArray(obj.guidedQuestions)) errors.push("guidedQuestions must be an array when provided");
  if (obj.assumptions != null && !Array.isArray(obj.assumptions)) errors.push("assumptions must be an array when provided");
  if (obj.warnings != null && !Array.isArray(obj.warnings)) errors.push("warnings must be an array when provided");

  return errors;
}

function buildNormalizedBrief(cloud = {}, fallback = {}) {
  const brief = isPlainObject(cloud?.brief) ? cloud.brief : {};
  return buildCreativeBriefContract(
    {
      summary: str(brief.summary || cloud.summary || fallback.summary),
      goalsSummary: str(brief.goalsSummary || fallback.goalsSummary || cloud.summary),
      inspirationSummary: str(brief.inspirationSummary || fallback.inspirationSummary),
      sections: arr(brief.sections).length ? brief.sections : arr(fallback.sections),
      moodEnergyArc: str(brief.moodEnergyArc || fallback.moodEnergyArc),
      narrativeCues: str(brief.narrativeCues || fallback.narrativeCues),
      visualCues: str(brief.visualCues || fallback.visualCues),
      hypotheses: arr(brief.hypotheses).length ? brief.hypotheses : arr(fallback.hypotheses),
      notes: str(brief.notes || fallback.notes)
    },
    isPlainObject(fallback.traceability) ? fallback.traceability : null
  );
}

function buildNormalizedProposal(cloud = {}, fallback = {}) {
  const proposal = isPlainObject(cloud?.proposal) ? cloud.proposal : {};
  return buildProposalBundle({
    proposalId: str(proposal.proposalId || fallback.proposalId || `proposal-${Date.now()}`),
    summary: str(proposal.summary || cloud.summary || fallback.summary),
    baseRevision: str(proposal.baseRevision || fallback.baseRevision || "unknown"),
    scope: isPlainObject(proposal.scope) ? proposal.scope : (fallback.scope || {}),
    constraints: isPlainObject(proposal.constraints) ? proposal.constraints : (fallback.constraints || {}),
    lifecycle: isPlainObject(proposal.lifecycle) ? proposal.lifecycle : (fallback.lifecycle || {}),
    proposalLines: arr(proposal.proposalLines).length ? proposal.proposalLines : arr(fallback.proposalLines),
    guidedQuestions: arr(cloud.guidedQuestions).length ? cloud.guidedQuestions : arr(fallback.guidedQuestions),
    assumptions: arr(cloud.assumptions).length ? cloud.assumptions : arr(fallback.assumptions),
    riskNotes: arr(proposal.riskNotes).length ? proposal.riskNotes : arr(fallback.riskNotes),
    impact: isPlainObject(proposal.impact) ? proposal.impact : (fallback.impact || {}),
    traceability: isPlainObject(fallback.traceability) ? fallback.traceability : null
  });
}

export function normalizeDesignerCloudResponse({
  cloudResponse = null,
  fallback = {},
  requestId = "",
  handoff = null
} = {}) {
  const errors = validateDesignerCloudResponse(cloudResponse);
  const cloud = isPlainObject(cloudResponse) ? cloudResponse : {};
  const creativeBrief = buildNormalizedBrief(cloud, fallback.creativeBrief || {});
  const proposalBundle = buildNormalizedProposal(cloud, fallback.proposalBundle || {});
  const warnings = [
    ...arr(fallback.warnings),
    ...arr(cloud.warnings).map((row) => str(row)).filter(Boolean)
  ];

  return buildDesignerDialogResult({
    requestId: str(requestId || fallback.requestId),
    status: errors.length ? "partial" : "ok",
    failureReason: errors.length ? "proposal_generation" : null,
    creativeBrief,
    proposalBundle,
    handoff: isPlainObject(handoff) ? handoff : undefined,
    warnings: [...warnings, ...errors],
    summary: str(cloud.summary || proposalBundle.summary || creativeBrief.summary),
    assistantMessage: str(cloud.assistantMessage || "")
  });
}
