function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function unique(values = []) {
  return [...new Set(arr(values).map((row) => str(row)).filter(Boolean))];
}

function stableHash(value = "") {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function numberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function targetIdentityFromRecord(targetRecord = {}) {
  const identity = obj(targetRecord?.identity);
  return {
    targetId: str(targetRecord?.targetId),
    targetKind: str(targetRecord?.targetKind),
    targetFingerprint: str(identity?.fingerprint),
    fingerprintVersion: str(identity?.fingerprintVersion),
    displayName: str(identity?.displayName),
    parentId: str(identity?.parentId || targetRecord?.structure?.submodelMetadata?.parentId),
    parentName: str(identity?.parentName || targetRecord?.structure?.submodelMetadata?.parentName)
  };
}

function normalizeEvidenceRefs({
  renderObservation = null,
  renderValidationEvidence = null,
  sourceArtifactRefs = {}
} = {}) {
  const refs = obj(sourceArtifactRefs);
  return {
    renderObservationRef: str(renderObservation?.artifactId || renderValidationEvidence?.renderObservationRef || refs.renderObservationRef),
    renderCritiqueContextRef: str(renderValidationEvidence?.renderCritiqueContextRef || refs.renderCritiqueContextRef),
    sequenceCritiqueRef: str(renderValidationEvidence?.sequenceCritiqueRef || refs.sequenceCritiqueRef),
    planHandoffRef: str(refs.planHandoffRef),
    applyResultRef: str(refs.applyResultRef)
  };
}

function normalizeOutcome({ outcome = {}, renderObservation = null } = {}) {
  const source = obj(outcome);
  const macro = obj(renderObservation?.macro);
  return {
    coverageRead: str(source.coverageRead || macro.coverageRead),
    temporalRead: str(source.temporalRead || macro.temporalRead),
    readability: str(source.readability),
    blankRisk: str(source.blankRisk),
    activeCoverageRatio: numberOrNull(source.activeCoverageRatio ?? macro.activeCoverageRatio),
    confidence: str(source.confidence || "observed"),
    notes: unique(source.notes).slice(0, 8)
  };
}

function behaviorKeyPayload(record = {}) {
  return {
    targetFingerprint: str(record.targetFingerprint),
    targetId: str(record.targetId),
    targetKind: str(record.targetKind),
    effectName: str(record.effectName),
    effectFamily: str(record.effectFamily),
    probeScope: str(record.probeScope),
    structureHints: unique(record.structureHints).sort()
  };
}

export function buildTargetBehaviorLearningRecord({
  targetRecord = null,
  targetIdentity = null,
  effectName = "",
  effectFamily = "",
  probeScope = "",
  submodelEvidence = null,
  renderObservation = null,
  renderValidationEvidence = null,
  outcome = {},
  sourceArtifactRefs = {},
  observedAt = new Date().toISOString()
} = {}) {
  const identity = targetIdentity && typeof targetIdentity === "object"
    ? {
        targetId: str(targetIdentity.targetId),
        targetKind: str(targetIdentity.targetKind),
        targetFingerprint: str(targetIdentity.targetFingerprint),
        fingerprintVersion: str(targetIdentity.fingerprintVersion),
        displayName: str(targetIdentity.displayName),
        parentId: str(targetIdentity.parentId),
        parentName: str(targetIdentity.parentName)
      }
    : targetIdentityFromRecord(obj(targetRecord));
  const submodel = obj(submodelEvidence);
  const structureHints = unique([
    ...arr(targetRecord?.structure?.submodelMetadata?.structureHints),
    ...arr(submodel?.structureHints)
  ]);
  const scope = str(probeScope) || (identity.targetKind === "submodel" ? "submodel" : "target");
  const baseRecord = {
    targetId: identity.targetId,
    targetKind: identity.targetKind,
    targetFingerprint: identity.targetFingerprint,
    fingerprintVersion: identity.fingerprintVersion,
    displayName: identity.displayName,
    parentId: identity.parentId || str(submodel?.parentId),
    parentName: identity.parentName,
    effectName: str(effectName),
    effectFamily: str(effectFamily || effectName),
    probeScope: scope,
    structureHints,
    submodelContext: {
      siblingCount: numberOrNull(submodel?.siblingCount),
      overlappingSiblingIds: unique(submodel?.overlappingSiblingIds).slice(0, 16),
      nodeCoverage: obj(submodel?.nodeCoverage)
    },
    evidenceRefs: normalizeEvidenceRefs({ renderObservation, renderValidationEvidence, sourceArtifactRefs }),
    outcome: normalizeOutcome({ outcome, renderObservation }),
    observedAt: str(observedAt)
  };
  const recordId = `tbl1:${stableHash(stableJson(behaviorKeyPayload(baseRecord)))}`;
  return {
    artifactType: "target_behavior_learning_record_v1",
    artifactVersion: "1.0",
    recordId,
    ...baseRecord
  };
}

export function upsertTargetBehaviorLearningRecord(document = null, record = null, { now = new Date().toISOString() } = {}) {
  const current = document && typeof document === "object" && !Array.isArray(document) ? document : {};
  const records = arr(current.records).filter((row) => row && typeof row === "object" && !Array.isArray(row));
  const incoming = record && typeof record === "object" && !Array.isArray(record) ? record : null;
  if (!incoming?.recordId) {
    return {
      artifactType: "project_target_behavior_learning_v1",
      artifactVersion: "1.0",
      updatedAt: str(current.updatedAt || now),
      records
    };
  }

  const index = records.findIndex((row) => str(row.recordId) === str(incoming.recordId));
  const prior = index >= 0 ? records[index] : null;
  const sampleCount = Number(prior?.stats?.sampleCount || 0) + 1;
  const next = {
    ...prior,
    ...incoming,
    createdAt: str(prior?.createdAt || incoming.observedAt || now),
    updatedAt: str(now),
    stats: {
      sampleCount,
      lastObservedAt: str(incoming.observedAt || now),
      positiveCount: Number(prior?.stats?.positiveCount || 0) + (str(incoming.outcome?.readability).toLowerCase() === "good" ? 1 : 0),
      negativeCount: Number(prior?.stats?.negativeCount || 0) + (["poor", "blank", "confusing"].includes(str(incoming.outcome?.readability).toLowerCase()) ? 1 : 0)
    }
  };
  if (index >= 0) records[index] = next;
  else records.push(next);

  return {
    artifactType: "project_target_behavior_learning_v1",
    artifactVersion: "1.0",
    updatedAt: str(now),
    records: records.sort((left, right) => str(left.recordId).localeCompare(str(right.recordId)))
  };
}

function commandTargetId(command = {}) {
  const params = obj(command?.params);
  return str(params.modelName || params.targetId || params.targetName || params.model || params.elementName);
}

function commandEffectName(command = {}) {
  const params = obj(command?.params);
  return str(params.effectName || params.effect || params.name);
}

function matchSubmodelEvidence(renderValidationEvidence = null, targetId = "") {
  const id = str(targetId);
  if (!id) return null;
  return arr(renderValidationEvidence?.submodelEvidence)
    .find((row) => str(row?.targetId) === id || str(row?.submodelId) === id) || null;
}

export function normalizeModelIndexTargetRecords(modelIndexArtifact = null) {
  const records = arr(modelIndexArtifact?.records);
  return records
    .map((record) => {
      const targetId = str(record?.targetId);
      if (!targetId) return null;
      const identity = obj(record?.identity);
      return {
        targetId,
        targetKind: str(record?.targetKind),
        identity: {
          displayName: str(identity.displayName || targetId),
          rawType: str(identity.rawType),
          canonicalType: str(identity.canonicalType),
          fingerprint: str(identity.fingerprint),
          fingerprintVersion: str(identity.fingerprintVersion)
        },
        structure: obj(record?.structure),
        provenance: { source: "display/model-index.json" }
      };
    })
    .filter(Boolean);
}

export function mergeTargetBehaviorTargetRecords(primaryRecords = [], supplementalRecords = []) {
  const byId = new Map();
  for (const record of arr(supplementalRecords)) {
    const targetId = str(record?.targetId);
    if (targetId) byId.set(targetId, record);
  }
  for (const record of arr(primaryRecords)) {
    const targetId = str(record?.targetId);
    if (!targetId) continue;
    const supplemental = byId.get(targetId) || {};
    byId.set(targetId, {
      ...supplemental,
      ...record,
      identity: {
        ...obj(supplemental.identity),
        ...obj(record.identity),
        fingerprint: str(record?.identity?.fingerprint || supplemental?.identity?.fingerprint),
        fingerprintVersion: str(record?.identity?.fingerprintVersion || supplemental?.identity?.fingerprintVersion),
        displayName: str(record?.identity?.displayName || supplemental?.identity?.displayName || targetId)
      },
      structure: {
        ...obj(supplemental.structure),
        ...obj(record.structure)
      }
    });
  }
  return [...byId.values()];
}

function outcomeFromCritique({ renderCritiqueContext = null, renderObservation = null } = {}) {
  const quality = obj(renderCritiqueContext?.quality);
  const observed = obj(renderCritiqueContext?.observed);
  const band = str(quality?.band);
  let readability = str(quality?.readability);
  if (!readability) {
    if (["strong", "acceptable"].includes(band)) readability = "good";
    else if (band === "very_low") readability = "poor";
    else if (band === "weak") readability = "confusing";
  }
  return normalizeOutcome({
    outcome: {
      coverageRead: observed.coverageRead,
      temporalRead: observed.temporalRead,
      readability,
      blankRisk: Number(observed.activeCoverageRatio || renderObservation?.macro?.activeCoverageRatio || 0) <= 0 ? "high" : "",
      activeCoverageRatio: observed.activeCoverageRatio,
      confidence: "observed",
      notes: arr(quality?.issues).slice(0, 8)
    },
    renderObservation
  });
}

export function buildTargetBehaviorLearningRecordsForApply({
  commands = [],
  targetRecords = [],
  renderObservation = null,
  renderValidationEvidence = null,
  renderCritiqueContext = null,
  sourceArtifactRefs = {},
  observedAt = new Date().toISOString()
} = {}) {
  const byId = new Map(arr(targetRecords).map((row) => [str(row?.targetId), row]).filter(([id]) => id));
  const byDisplayName = new Map(arr(targetRecords).map((row) => [str(row?.identity?.displayName), row]).filter(([name]) => name));
  const rows = [];
  const seen = new Set();
  for (const command of arr(commands)) {
    const cmd = str(command?.cmd);
    if (!["effects.create", "effects.update"].includes(cmd)) continue;
    const targetId = commandTargetId(command);
    const effectName = commandEffectName(command);
    if (!targetId || !effectName) continue;
    const targetRecord = byId.get(targetId) || byDisplayName.get(targetId);
    if (!targetRecord) continue;
    const submodelEvidence = matchSubmodelEvidence(renderValidationEvidence, targetRecord.targetId);
    const record = buildTargetBehaviorLearningRecord({
      targetRecord,
      effectName,
      effectFamily: effectName,
      probeScope: targetRecord.targetKind === "submodel" ? "submodel" : "target",
      submodelEvidence,
      renderObservation,
      renderValidationEvidence,
      outcome: outcomeFromCritique({ renderCritiqueContext, renderObservation }),
      sourceArtifactRefs,
      observedAt
    });
    if (seen.has(record.recordId)) continue;
    seen.add(record.recordId);
    rows.push(record);
  }
  return rows;
}
