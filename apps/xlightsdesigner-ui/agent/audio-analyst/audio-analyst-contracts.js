import { validateAgentHandoff } from "../handoff-contracts.js";

export const AUDIO_ANALYST_ROLE = "audio_analyst";
export const AUDIO_ANALYST_CONTRACT_VERSION = "1.0";

export const AUDIO_ANALYST_INPUT_CONTRACT = "audio_analyst_input_v1";
export const AUDIO_ANALYST_ARTIFACT_CONTRACT = "analysis_artifact_v1";
export const AUDIO_ANALYST_RESULT_CONTRACT = "audio_analyst_result_v1";

const RESULT_STATUS = new Set(["ok", "partial", "failed"]);
const FAILURE_REASONS = new Set([
  "provider_unavailable",
  "media_unreadable",
  "identity_lookup_failed",
  "lyrics_unavailable",
  "partial_analysis",
  "runtime",
  "unknown",
  null
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function str(value = "") {
  return String(value || "").trim();
}

function getByPath(obj, path) {
  const keys = Array.isArray(path) ? path : String(path || "").split(".");
  let cur = obj;
  for (const key of keys) {
    if (!isPlainObject(cur) || !(key in cur)) return undefined;
    cur = cur[key];
  }
  return cur;
}

function pushRequiredString(errors, obj, path, label = "") {
  if (!str(getByPath(obj, path))) errors.push(`${label || path} is required`);
}

function pushRequiredObject(errors, obj, path, label = "") {
  if (!isPlainObject(getByPath(obj, path))) errors.push(`${label || path} is required`);
}

function validateAnalysisModule(errors, obj, path, label = "") {
  const prefix = label || path;
  const moduleObj = getByPath(obj, path);
  if (moduleObj == null) return;
  if (!isPlainObject(moduleObj)) {
    errors.push(`${prefix} must be an object when provided`);
    return;
  }
  if (!isPlainObject(moduleObj.data)) errors.push(`${prefix}.data is required`);
  if (moduleObj.confidence != null && !Number.isFinite(Number(moduleObj.confidence))) {
    errors.push(`${prefix}.confidence must be numeric when provided`);
  }
  if (moduleObj.sources != null && !Array.isArray(moduleObj.sources)) {
    errors.push(`${prefix}.sources must be an array when provided`);
  }
  if (moduleObj.diagnostics != null && !Array.isArray(moduleObj.diagnostics)) {
    errors.push(`${prefix}.diagnostics must be an array when provided`);
  }
  if (moduleObj.cacheKey != null && typeof moduleObj.cacheKey !== "string") {
    errors.push(`${prefix}.cacheKey must be a string when provided`);
  }
  if (moduleObj.metadata != null && !isPlainObject(moduleObj.metadata)) {
    errors.push(`${prefix}.metadata must be an object when provided`);
  }
  if (isPlainObject(moduleObj.metadata)) {
    if (moduleObj.metadata.moduleVersion != null && typeof moduleObj.metadata.moduleVersion !== "string") {
      errors.push(`${prefix}.metadata.moduleVersion must be a string when provided`);
    }
    if (moduleObj.metadata.generatedAt != null && typeof moduleObj.metadata.generatedAt !== "string") {
      errors.push(`${prefix}.metadata.generatedAt must be a string when provided`);
    }
    if (moduleObj.metadata.profileMode != null && typeof moduleObj.metadata.profileMode !== "string") {
      errors.push(`${prefix}.metadata.profileMode must be a string when provided`);
    }
    if (moduleObj.metadata.invalidationKey != null && typeof moduleObj.metadata.invalidationKey !== "string") {
      errors.push(`${prefix}.metadata.invalidationKey must be a string when provided`);
    }
  }
}

export function validateAudioAnalystInput(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.agentRole) !== AUDIO_ANALYST_ROLE) {
    errors.push(`agentRole must be ${AUDIO_ANALYST_ROLE}`);
  }
  if (str(obj.contractVersion) !== AUDIO_ANALYST_CONTRACT_VERSION) {
    errors.push(`contractVersion must be ${AUDIO_ANALYST_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "requestId");
  pushRequiredObject(errors, obj, "context");
  pushRequiredObject(errors, obj, "context.media");
  pushRequiredString(errors, obj, "context.media.path");
  pushRequiredObject(errors, obj, "context.service");
  pushRequiredString(errors, obj, "context.service.baseUrl");

  const provider = str(getByPath(obj, "context.service.provider")).toLowerCase();
  if (provider && provider !== "librosa") {
    errors.push("context.service.provider must be librosa when provided");
  }

  const mediaRootPath = getByPath(obj, "context.project.mediaRootPath");
  if (mediaRootPath != null && typeof mediaRootPath !== "string") {
    errors.push("context.project.mediaRootPath must be a string when provided");
  }
  const projectFilePath = getByPath(obj, "context.project.projectFilePath");
  if (projectFilePath != null && typeof projectFilePath !== "string") {
    errors.push("context.project.projectFilePath must be a string when provided");
  }

  if (getByPath(obj, "context.sequence") != null) {
    errors.push("context.sequence is not allowed for audio_analyst");
  }
  if (getByPath(obj, "context.layout") != null) {
    errors.push("context.layout is not allowed for audio_analyst");
  }
  if (getByPath(obj, "context.sequenceRevision") != null) {
    errors.push("context.sequenceRevision is not allowed for audio_analyst");
  }

  if (obj.analysisProfile != null && !isPlainObject(obj.analysisProfile)) {
    errors.push("analysisProfile must be an object when provided");
  }

  return errors;
}

export function validateAnalysisArtifact(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.artifactType) !== AUDIO_ANALYST_ARTIFACT_CONTRACT) {
    errors.push(`artifactType must be ${AUDIO_ANALYST_ARTIFACT_CONTRACT}`);
  }
  if (str(obj.artifactVersion) !== AUDIO_ANALYST_CONTRACT_VERSION) {
    errors.push(`artifactVersion must be ${AUDIO_ANALYST_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "artifactId");
  pushRequiredString(errors, obj, "createdAt");
  pushRequiredObject(errors, obj, "media");
  pushRequiredString(errors, obj, "media.path");
  pushRequiredString(errors, obj, "media.mediaId");
  pushRequiredObject(errors, obj, "timing");
  pushRequiredObject(errors, obj, "harmonic");
  pushRequiredObject(errors, obj, "lyrics");
  pushRequiredObject(errors, obj, "structure");
  pushRequiredObject(errors, obj, "provenance");
  pushRequiredString(errors, obj, "provenance.generatedAt");
  pushRequiredObject(errors, obj, "provenance.pipeline");
  pushRequiredObject(errors, obj, "diagnostics");

  if (obj.timing?.beats != null && !Array.isArray(obj.timing.beats)) errors.push("timing.beats must be an array when provided");
  if (obj.timing?.bars != null && !Array.isArray(obj.timing.bars)) errors.push("timing.bars must be an array when provided");
  if (obj.harmonic?.chords != null && !Array.isArray(obj.harmonic.chords)) errors.push("harmonic.chords must be an array when provided");
  if (obj.lyrics?.lines != null && !Array.isArray(obj.lyrics.lines)) errors.push("lyrics.lines must be an array when provided");
  if (obj.structure?.sections != null && !Array.isArray(obj.structure.sections)) errors.push("structure.sections must be an array when provided");
  if (obj.diagnostics?.warnings != null && !Array.isArray(obj.diagnostics.warnings)) errors.push("diagnostics.warnings must be an array when provided");
  if (obj.modules != null && !isPlainObject(obj.modules)) errors.push("modules must be an object when provided");

  validateAnalysisModule(errors, obj, "modules.identity");
  validateAnalysisModule(errors, obj, "modules.rhythm");
  validateAnalysisModule(errors, obj, "modules.harmony");
  validateAnalysisModule(errors, obj, "modules.lyrics");
  validateAnalysisModule(errors, obj, "modules.structureBackbone");
  validateAnalysisModule(errors, obj, "modules.semanticStructure");

  return errors;
}

export function validateAudioAnalystResult(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};

  if (str(obj.agentRole) !== AUDIO_ANALYST_ROLE) {
    errors.push(`agentRole must be ${AUDIO_ANALYST_ROLE}`);
  }
  if (str(obj.contractVersion) !== AUDIO_ANALYST_CONTRACT_VERSION) {
    errors.push(`contractVersion must be ${AUDIO_ANALYST_CONTRACT_VERSION}`);
  }

  pushRequiredString(errors, obj, "requestId");
  const status = str(obj.status);
  if (!RESULT_STATUS.has(status)) errors.push("status must be ok|partial|failed");

  const failureReason = obj.failureReason == null ? null : str(obj.failureReason);
  if (!FAILURE_REASONS.has(failureReason)) {
    errors.push("failureReason must be provider_unavailable|media_unreadable|identity_lookup_failed|lyrics_unavailable|partial_analysis|runtime|unknown|null");
  }

  if (obj.artifact != null) {
    const artifactErrors = validateAnalysisArtifact(obj.artifact);
    for (const error of artifactErrors) errors.push(`artifact.${error}`);
  }
  if (obj.handoff != null) {
    const handoffErrors = validateAgentHandoff("analysis_handoff_v1", obj.handoff);
    for (const error of handoffErrors) errors.push(`handoff.${error}`);
  }
  if (obj.warnings != null && !Array.isArray(obj.warnings)) {
    errors.push("warnings must be an array when provided");
  }

  return errors;
}

export function buildAudioAnalystResult({
  requestId = "",
  status = "failed",
  failureReason = null,
  artifact = null,
  handoff = null,
  warnings = [],
  summary = ""
} = {}) {
  return {
    agentRole: AUDIO_ANALYST_ROLE,
    contractVersion: AUDIO_ANALYST_CONTRACT_VERSION,
    requestId: str(requestId),
    status: str(status),
    failureReason: failureReason == null ? null : str(failureReason),
    artifact: isPlainObject(artifact) ? artifact : undefined,
    handoff: isPlainObject(handoff) ? handoff : undefined,
    warnings: Array.isArray(warnings) ? warnings.map((row) => str(row)).filter(Boolean) : [],
    summary: str(summary)
  };
}

export function classifyAudioAnalysisFailureReason(stage = "", detail = "", artifact = null) {
  const stageValue = str(stage).toLowerCase();
  const detailValue = str(detail).toLowerCase();
  const combined = `${stageValue} ${detailValue}`.trim();

  if (artifact && isPlainObject(artifact)) {
    const lyricsLines = Array.isArray(artifact?.lyrics?.lines) ? artifact.lyrics.lines.length : 0;
    const warnings = Array.isArray(artifact?.diagnostics?.warnings) ? artifact.diagnostics.warnings.map((row) => str(row).toLowerCase()) : [];
    if (lyricsLines === 0 && warnings.some((line) => line.includes("no synced lyrics") || line.includes("lyrics source detail"))) {
      return "lyrics_unavailable";
    }
    if (artifact?.diagnostics?.degraded) {
      return "partial_analysis";
    }
  }

  if (!combined) return "unknown";
  if (combined.includes("service unavailable") || combined.includes("bridge unavailable") || combined.includes("provider") || combined.includes("baseurl")) {
    return "provider_unavailable";
  }
  if (combined.includes("no audio track") || combined.includes("unreadable") || combined.includes("metadata") || combined.includes("media")) {
    return "media_unreadable";
  }
  if (combined.includes("track identity") || combined.includes("fingerprinted") || combined.includes("exact track lookup")) {
    return "identity_lookup_failed";
  }
  if (combined.includes("lyrics")) {
    return "lyrics_unavailable";
  }
  if (combined.includes("partial") || combined.includes("degraded")) {
    return "partial_analysis";
  }
  if (combined.includes("runtime") || combined.includes("exception") || combined.includes("failed")) {
    return "runtime";
  }
  return "unknown";
}

export function validateAudioAnalystContractGate(kind = "", payload = {}, runId = "") {
  const key = str(kind);
  let contractName = "";
  let errors = [];
  let stage = "";

  if (key === "input") {
    contractName = AUDIO_ANALYST_INPUT_CONTRACT;
    stage = "input_contract";
    errors = validateAudioAnalystInput(payload);
  } else if (key === "artifact") {
    contractName = AUDIO_ANALYST_ARTIFACT_CONTRACT;
    stage = "artifact_contract";
    errors = validateAnalysisArtifact(payload);
  } else if (key === "result") {
    contractName = AUDIO_ANALYST_RESULT_CONTRACT;
    stage = "result_contract";
    errors = validateAudioAnalystResult(payload);
  } else {
    contractName = "unknown";
    stage = "unknown_contract";
    errors = ["unknown contract gate kind"];
  }

  return {
    ok: errors.length === 0,
    stage,
    report: {
      runId: str(runId),
      stage,
      contractName,
      contractVersion: AUDIO_ANALYST_CONTRACT_VERSION,
      agentRole: AUDIO_ANALYST_ROLE,
      valid: errors.length === 0,
      errors
    }
  };
}
