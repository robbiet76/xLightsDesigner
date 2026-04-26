import {
  normalizeSubmodelGraph,
  parseSubmodelParentId
} from "../shared/target-semantics-registry.js";

function timingMarksSignature(marks = []) {
  const rows = (Array.isArray(marks) ? marks : [])
    .map((m) => {
      const s = Math.max(0, Math.round(Number(m?.startMs || 0)));
      const e = Math.max(s + 1, Math.round(Number(m?.endMs || (s + 1))));
      const l = String(m?.label || "").trim();
      return `${s}:${e}:${l}`;
    })
    .filter(Boolean)
    .sort();
  return rows.join("|");
}

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function effectPlanKey(modelName = "", layerIndex = 0, startMs = 0, endMs = 0, effectName = "") {
  return [
    String(modelName || "").trim(),
    Number(layerIndex),
    Number(startMs),
    Number(endMs),
    String(effectName || "").trim()
  ].join("|");
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function intNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function normalizeElementName(params = {}) {
  return str(params.modelName || params.element || params.targetId);
}

function normalizeComparableValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value || "").trim();
    }
  }
  return String(value || "").trim();
}

function compareIfExpected(actual, expected) {
  const normalizedExpected = normalizeComparableValue(expected);
  if (!normalizedExpected) return true;
  return normalizeComparableValue(actual) === normalizedExpected;
}

function normalizeEffectRow(params = {}) {
  const modelName = normalizeElementName(params);
  const layerIndex = intNumber(params.layerIndex ?? params.layer, null);
  const startMs = intNumber(params.startMs, null);
  const endMs = intNumber(params.endMs, null);
  const effectName = str(params.effectName);
  if (!modelName || layerIndex === null || startMs === null || endMs === null || endMs < startMs || !effectName) {
    return null;
  }
  return {
    modelName,
    layerIndex,
    startMs,
    endMs,
    effectName
  };
}

function parseJsonArrayString(value = "") {
  const text = str(value);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cloneTargetNames(params = {}, clonePolicy = {}) {
  const fromArray = arr(params.targetModels).concat(arr(clonePolicy.targetModelNames));
  const fromJson = typeof params.targetModels === "string" ? parseJsonArrayString(params.targetModels) : [];
  return Array.from(new Set(
    [
      params.targetModelName,
      params.targetElement,
      params.targetModel,
      clonePolicy.targetModelName,
      ...fromArray,
      ...fromJson
    ]
      .map((row) => str(row))
      .filter(Boolean)
  ));
}

function normalizeCloneReadback(step = {}) {
  const params = step?.params && typeof step.params === "object" ? step.params : {};
  const clonePolicy = step?.intent?.clonePolicy && typeof step.intent.clonePolicy === "object"
    ? step.intent.clonePolicy
    : {};
  const sourceModelName = str(params.sourceModelName || params.sourceElement || params.sourceModel || clonePolicy.sourceModelName);
  const sourceLayerIndex = intNumber(
    params.sourceLayerIndex ?? params.sourceLayer ?? clonePolicy.sourceLayerIndex,
    null
  );
  const sourceStartMs = intNumber(params.sourceStartMs ?? clonePolicy.sourceStartMs, null);
  const sourceEndMs = intNumber(params.sourceEndMs ?? clonePolicy.sourceEndMs, null);
  const targetStartMs = intNumber(params.targetStartMs ?? clonePolicy.targetStartMs, sourceStartMs);
  const targetLayerIndex = intNumber(
    params.targetLayerIndex ?? params.targetLayer ?? clonePolicy.targetLayerIndex,
    sourceLayerIndex
  );
  const mode = str(params.mode || clonePolicy.mode).toLowerCase() === "move" ? "move" : "copy";
  const sourceEffectCount = intNumber(clonePolicy.sourceEffectCount ?? params.sourceEffectCount, null);
  if (!sourceModelName || sourceStartMs === null || sourceEndMs === null || sourceEndMs <= sourceStartMs || targetStartMs === null) {
    return null;
  }
  const durationMs = sourceEndMs - sourceStartMs;
  const targetEndMs = targetStartMs + durationMs;
  const targetModels = cloneTargetNames(params, clonePolicy);
  if (!targetModels.length) return null;
  return {
    sourceModelName,
    sourceLayerIndex,
    sourceStartMs,
    sourceEndMs,
    targetModels,
    targetLayerIndex,
    targetStartMs,
    targetEndMs,
    mode,
    sourceEffectCount: sourceEffectCount !== null && sourceEffectCount > 0 ? sourceEffectCount : 1
  };
}

function effectMatchesSelector(effect = {}, params = {}) {
  const selectorModel = normalizeElementName(params);
  if (selectorModel && effect.modelName !== selectorModel) return false;
  const selectorLayer = intNumber(params.layerIndex ?? params.layer, null);
  if (selectorLayer !== null && effect.layerIndex !== selectorLayer) return false;
  const selectorStart = intNumber(params.startMs, null);
  if (selectorStart !== null && effect.startMs !== selectorStart) return false;
  const selectorEnd = intNumber(params.endMs, null);
  if (selectorEnd !== null && effect.endMs !== selectorEnd) return false;
  const selectorEffect = str(params.effectName);
  if (selectorEffect && effect.effectName !== selectorEffect) return false;
  return true;
}

function applyLayerReorder(effects = [], modelName = "", fromLayer = null, toLayer = null) {
  if (!modelName || fromLayer === null || toLayer === null || fromLayer === toLayer) return effects;
  return effects.map((effect) => {
    if (effect.modelName !== modelName) return effect;
    let nextLayer = effect.layerIndex;
    if (nextLayer === fromLayer) {
      nextLayer = toLayer;
    } else if (fromLayer < toLayer && nextLayer > fromLayer && nextLayer <= toLayer) {
      nextLayer -= 1;
    } else if (fromLayer > toLayer && nextLayer >= toLayer && nextLayer < fromLayer) {
      nextLayer += 1;
    }
    return nextLayer === effect.layerIndex ? effect : { ...effect, layerIndex: nextLayer };
  });
}

function applyLayerCompact(effects = [], modelName = "") {
  if (!modelName) return effects;
  const occupied = Array.from(new Set(
    effects
      .filter((effect) => effect.modelName === modelName)
      .map((effect) => effect.layerIndex)
      .filter((layerIndex) => Number.isInteger(layerIndex) && layerIndex >= 0)
  )).sort((a, b) => a - b);
  const layerMap = new Map(occupied.map((layerIndex, index) => [layerIndex, index]));
  return effects.map((effect) => {
    if (effect.modelName !== modelName || !layerMap.has(effect.layerIndex)) return effect;
    const nextLayer = layerMap.get(effect.layerIndex);
    return nextLayer === effect.layerIndex ? effect : { ...effect, layerIndex: nextLayer };
  });
}

function buildExpectedFinalEffects(commands = []) {
  let effects = [];
  for (const step of arr(commands)) {
    const cmd = str(step?.cmd);
    const params = step?.params && typeof step.params === "object" ? step.params : {};
    if (cmd === "effects.create") {
      const effect = normalizeEffectRow(params);
      if (effect) effects.push({ ...effect, sourceStep: step });
      continue;
    }
    if (cmd === "effects.update") {
      const matchIndex = effects.findIndex((effect) => effectMatchesSelector(effect, params));
      if (matchIndex < 0) {
        const existing = normalizeEffectRow(params);
        if (existing) {
          effects.push({
            modelName: normalizeElementName(params) || existing.modelName,
            layerIndex: intNumber(params.newLayerIndex ?? params.newLayer ?? params.targetLayerIndex ?? params.targetLayer, existing.layerIndex),
            startMs: intNumber(params.newStartMs ?? params.targetStartMs, existing.startMs),
            endMs: intNumber(params.newEndMs ?? params.targetEndMs, existing.endMs),
            effectName: str(params.newEffectName) || existing.effectName,
            sourceStep: step
          });
        }
        continue;
      }
      const updated = {
        ...effects[matchIndex],
        modelName: normalizeElementName(params) || effects[matchIndex].modelName,
        layerIndex: intNumber(params.newLayerIndex ?? params.newLayer ?? params.targetLayerIndex ?? params.targetLayer, effects[matchIndex].layerIndex),
        startMs: intNumber(params.newStartMs ?? params.targetStartMs, effects[matchIndex].startMs),
        endMs: intNumber(params.newEndMs ?? params.targetEndMs, effects[matchIndex].endMs),
        effectName: str(params.newEffectName) || effects[matchIndex].effectName,
        sourceStep: {
          ...effects[matchIndex].sourceStep,
          updatedBy: step
        }
      };
      effects[matchIndex] = updated;
      continue;
    }
    if (cmd === "effects.delete") {
      effects = effects.filter((effect) => !effectMatchesSelector(effect, params));
      continue;
    }
    if (cmd === "effects.deleteLayer") {
      const modelName = normalizeElementName(params);
      const layerIndex = intNumber(params.layerIndex ?? params.layer, null);
      if (!modelName || layerIndex === null) continue;
      effects = effects
        .filter((effect) => !(effect.modelName === modelName && effect.layerIndex === layerIndex))
        .map((effect) => effect.modelName === modelName && effect.layerIndex > layerIndex
          ? { ...effect, layerIndex: effect.layerIndex - 1 }
          : effect);
      continue;
    }
    if (cmd === "effects.reorderLayer") {
      effects = applyLayerReorder(
        effects,
        normalizeElementName(params),
        intNumber(params.fromLayerIndex ?? params.fromLayer, null),
        intNumber(params.toLayerIndex ?? params.toLayer, null)
      );
      continue;
    }
    if (cmd === "effects.compactLayers") {
      effects = applyLayerCompact(effects, normalizeElementName(params));
    }
  }
  return effects;
}

function preservationPolicyForStep(step = {}) {
  const policy = step?.intent?.existingSequencePolicy;
  if (!policy || typeof policy !== "object" || Array.isArray(policy)) return null;
  const overlapCount = Number(policy.overlapCount || 0);
  const originalLayerIndex = finiteNumber(policy.originalLayerIndex);
  const plannedLayerIndex = finiteNumber(policy.plannedLayerIndex);
  if (!Number.isFinite(overlapCount) || overlapCount <= 0) return null;
  if (policy.replacementAuthorized) return null;
  if (originalLayerIndex === null || plannedLayerIndex === null) return null;
  return {
    overlapCount,
    originalLayerIndex,
    plannedLayerIndex,
    overlappingEffectNames: arr(policy.overlappingEffectNames).map((row) => str(row)).filter(Boolean)
  };
}

function buildReadbackDesignContext(planMetadata = {}, sequencingDesignHandoff = null) {
  const metadata = planMetadata && typeof planMetadata === "object" && !Array.isArray(planMetadata) ? planMetadata : {};
  const handoff = sequencingDesignHandoff && typeof sequencingDesignHandoff === "object" && !Array.isArray(sequencingDesignHandoff)
    ? sequencingDesignHandoff
    : (metadata?.sequencingDesignHandoff && typeof metadata.sequencingDesignHandoff === "object" && !Array.isArray(metadata.sequencingDesignHandoff)
        ? metadata.sequencingDesignHandoff
        : null);
  return {
    designSummary: str(handoff?.designSummary || metadata?.sequencingDesignHandoffSummary),
    sectionDirectiveCount: Array.isArray(handoff?.sectionDirectives)
      ? handoff.sectionDirectives.length
      : Number(metadata?.sequencingSectionDirectiveCount || 0),
    focusPlan: handoff?.focusPlan && typeof handoff.focusPlan === "object" ? handoff.focusPlan : {},
    propRoleAssignments: arr(handoff?.propRoleAssignments),
    sectionDirectives: arr(handoff?.sectionDirectives),
    trainingKnowledge: metadata?.trainingKnowledge && typeof metadata.trainingKnowledge === "object"
      ? metadata.trainingKnowledge
      : {}
  };
}

function collectAppliedEffectTargets(commands = []) {
  return buildExpectedFinalEffects(commands)
    .map((effect) => ({
      targetId: str(effect?.modelName),
      effectName: str(effect?.effectName)
    }))
    .filter((row) => row.targetId && row.effectName);
}

function buildDesignAlignment(designContext = {}, appliedEffectTargets = []) {
  const primaryFocusTargetIds = arr(designContext?.focusPlan?.primaryTargetIds).map((row) => str(row)).filter(Boolean);
  const observedTargets = Array.from(new Set(appliedEffectTargets.map((row) => row.targetId).filter(Boolean)));
  const observedEffectNames = Array.from(new Set(appliedEffectTargets.map((row) => row.effectName).filter(Boolean)));
  const preferredVisualFamilies = Array.from(new Set(
    arr(designContext?.sectionDirectives)
      .flatMap((row) => arr(row?.preferredVisualFamilies))
      .map((row) => str(row))
      .filter(Boolean)
  ));
  const roleCoverage = arr(designContext?.propRoleAssignments)
    .map((row) => {
      const role = str(row?.role);
      const targetIds = arr(row?.targetIds).map((value) => str(value)).filter(Boolean);
      if (!role || !targetIds.length) return null;
      const coveredTargetIds = targetIds.filter((targetId) => observedTargets.includes(targetId));
      return {
        role,
        targetIds,
        coveredTargetIds,
        uncoveredTargetIds: targetIds.filter((targetId) => !coveredTargetIds.includes(targetId)),
        ok: coveredTargetIds.length > 0
      };
    })
    .filter(Boolean);
  const coveredPrimaryFocusTargetIds = primaryFocusTargetIds.filter((targetId) => observedTargets.includes(targetId));
  return {
    designSummary: str(designContext?.designSummary),
    sectionDirectiveCount: Number(designContext?.sectionDirectiveCount || 0),
    primaryFocusTargetIds,
    coveredPrimaryFocusTargetIds,
    uncoveredPrimaryFocusTargetIds: primaryFocusTargetIds.filter((targetId) => !coveredPrimaryFocusTargetIds.includes(targetId)),
    preferredVisualFamilies,
    observedTargets,
    observedEffectNames,
    roleCoverage,
    trainingKnowledge: designContext?.trainingKnowledge && typeof designContext.trainingKnowledge === "object"
      ? designContext.trainingKnowledge
      : {}
  };
}

function buildDesignChecks(designAlignment = {}) {
  const checks = [];
  if (Array.isArray(designAlignment.primaryFocusTargetIds) && designAlignment.primaryFocusTargetIds.length) {
    const ok = Array.isArray(designAlignment.coveredPrimaryFocusTargetIds) && designAlignment.coveredPrimaryFocusTargetIds.length > 0;
    checks.push({
      kind: "design-focus",
      target: "primary-focus",
      ok,
      detail: ok
        ? `covered ${designAlignment.coveredPrimaryFocusTargetIds.join(", ")}`
        : "no primary focus targets received effects"
    });
  }
  for (const role of arr(designAlignment.roleCoverage)) {
    checks.push({
      kind: "design-role",
      target: role.role,
      ok: Boolean(role.ok),
      detail: role.ok
        ? `covered ${role.coveredTargetIds.join(", ")}`
        : `no applied targets matched ${role.role}`
    });
  }
  return checks;
}

export async function verifyAppliedPlanReadback(plan = [], deps = {}) {
  const commands = Array.isArray(plan) ? plan : [];
  const endpoint = String(deps?.endpoint || "").trim();
  const getTimingMarks = typeof deps?.getTimingMarks === "function" ? deps.getTimingMarks : null;
  const getDisplayElementOrder = typeof deps?.getDisplayElementOrder === "function" ? deps.getDisplayElementOrder : null;
  const listEffects = typeof deps?.listEffects === "function" ? deps.listEffects : null;
  const submodelGraph = normalizeSubmodelGraph(deps?.submodelsById || {});
  const verification = {
    revisionAdvanced: false,
    expectedMutationsPresent: false,
    lockedTracksUnchanged: true,
    checks: [],
    designContext: {},
    designAlignment: {},
    designChecks: []
  };
  const expectedFinalEffects = buildExpectedFinalEffects(commands);
  const plannedEffectKeys = new Set(
    expectedFinalEffects.map((effect) => effectPlanKey(
      effect.modelName,
      effect.layerIndex,
      effect.startMs,
      effect.endMs,
      effect.effectName
    ))
  );

  const readbackChecks = [];
  for (const step of commands) {
    const cmd = String(step?.cmd || "").trim();
    const params = step?.params && typeof step.params === "object" ? step.params : {};
    if ((cmd === "timing.insertMarks" || cmd === "timing.replaceMarks") && String(params.trackName || "").trim() && getTimingMarks) {
      readbackChecks.push((async () => {
        const trackName = String(params.trackName || "").trim();
        const expectedSignature = timingMarksSignature(Array.isArray(params.marks) ? params.marks : []);
        const resp = await getTimingMarks(endpoint, trackName);
        const actualMarks = Array.isArray(resp?.data?.marks) ? resp.data.marks : [];
        const actualSignature = timingMarksSignature(actualMarks);
        const ok = Boolean(expectedSignature) && actualSignature === expectedSignature;
        return {
          kind: "timing",
          target: trackName,
          ok,
          detail: ok ? "mark signature matched" : "mark signature mismatch",
          expectedMarks: Array.isArray(params.marks) ? params.marks : [],
          actualMarks
        };
      })());
    }
    if (cmd === "sequencer.setDisplayElementOrder" && Array.isArray(params.orderedIds) && params.orderedIds.length && getDisplayElementOrder) {
      readbackChecks.push((async () => {
        const expectedOrder = params.orderedIds.map((row) => String(row || "").trim()).filter(Boolean);
        const resp = await getDisplayElementOrder(endpoint);
        const sourceRows = Array.isArray(resp?.data?.rows) && resp.data.rows.length
          ? resp.data.rows
          : (Array.isArray(resp?.data?.elements) ? resp.data.elements : []);
        const actualOrder = sourceRows.map((row) => typeof row === "string" ? row : String(row?.id || row?.name || "").trim()).filter(Boolean);
        const ok =
          expectedOrder.length === actualOrder.length &&
          expectedOrder.every((id, idx) => id === actualOrder[idx]);
        return {
          kind: "display-order",
          target: "master-view",
          ok,
          detail: ok ? "display element order matched" : "display element order mismatch"
        };
      })());
    }
    if (cmd === "effects.delete" && normalizeElementName(params) && listEffects) {
      readbackChecks.push((async () => {
        const modelName = normalizeElementName(params);
        const layerIndex = intNumber(params.layerIndex ?? params.layer, 0);
        const startMs = intNumber(params.startMs, 0);
        const endMs = intNumber(params.endMs, startMs);
        const effectName = str(params.effectName);
        const resp = await listEffects(endpoint, { modelName, layerIndex, startMs, endMs });
        const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
        const present = effects.some((row) =>
          (!effectName || str(row?.effectName) === effectName) &&
          Number(row?.startMs) === startMs &&
          Number(row?.endMs) === endMs &&
          Number(row?.layerIndex) === layerIndex
        );
        return {
          kind: "effect-delete",
          target: `${modelName}@${layerIndex}`,
          ok: !present,
          detail: present ? `${effectName || "effect"} still present` : `${effectName || "effect"} absent`
        };
      })());
    }
    if (cmd === "effects.clone" && listEffects) {
      const cloneReadback = normalizeCloneReadback(step);
      if (cloneReadback) {
        for (const targetModel of cloneReadback.targetModels) {
          readbackChecks.push((async () => {
            const query = {
              modelName: targetModel,
              startMs: cloneReadback.targetStartMs,
              endMs: cloneReadback.targetEndMs
            };
            if (cloneReadback.targetLayerIndex !== null) query.layerIndex = cloneReadback.targetLayerIndex;
            const resp = await listEffects(endpoint, query);
            const effects = arr(resp?.data?.effects);
            const matchingEffects = effects.filter((row) => {
              if (str(row?.modelName || targetModel) !== targetModel) return false;
              if (cloneReadback.targetLayerIndex !== null && Number(row?.layerIndex) !== cloneReadback.targetLayerIndex) return false;
              const startMs = Number(row?.startMs);
              const endMs = Number(row?.endMs);
              return Number.isFinite(startMs) &&
                Number.isFinite(endMs) &&
                startMs >= cloneReadback.targetStartMs &&
                endMs <= cloneReadback.targetEndMs;
            });
            const ok = matchingEffects.length >= cloneReadback.sourceEffectCount;
            return {
              kind: "effect-clone-native",
              target: cloneReadback.targetLayerIndex === null ? targetModel : `${targetModel}@${cloneReadback.targetLayerIndex}`,
              ok,
              detail: ok
                ? `found ${matchingEffects.length} cloned effect${matchingEffects.length === 1 ? "" : "s"}`
                : `expected at least ${cloneReadback.sourceEffectCount} cloned effect${cloneReadback.sourceEffectCount === 1 ? "" : "s"}`,
              expectedCount: cloneReadback.sourceEffectCount,
              actualCount: matchingEffects.length
            };
          })());
        }
        if (cloneReadback.mode === "move") {
          readbackChecks.push((async () => {
            const query = {
              modelName: cloneReadback.sourceModelName,
              startMs: cloneReadback.sourceStartMs,
              endMs: cloneReadback.sourceEndMs
            };
            if (cloneReadback.sourceLayerIndex !== null) query.layerIndex = cloneReadback.sourceLayerIndex;
            const resp = await listEffects(endpoint, query);
            const effects = arr(resp?.data?.effects);
            const remaining = effects.filter((row) => {
              if (str(row?.modelName || cloneReadback.sourceModelName) !== cloneReadback.sourceModelName) return false;
              if (cloneReadback.sourceLayerIndex !== null && Number(row?.layerIndex) !== cloneReadback.sourceLayerIndex) return false;
              const startMs = Number(row?.startMs);
              const endMs = Number(row?.endMs);
              return Number.isFinite(startMs) &&
                Number.isFinite(endMs) &&
                startMs >= cloneReadback.sourceStartMs &&
                endMs <= cloneReadback.sourceEndMs;
            });
            const ok = remaining.length === 0;
            return {
              kind: "effect-clone-native-source-delete",
              target: cloneReadback.sourceLayerIndex === null ? cloneReadback.sourceModelName : `${cloneReadback.sourceModelName}@${cloneReadback.sourceLayerIndex}`,
              ok,
              detail: ok ? "source window empty after move" : "source window still contains moved effects",
              actualCount: remaining.length
            };
          })());
        }
      }
    }
    if (cmd === "effects.reorderLayer" && normalizeElementName(params) && listEffects) {
      const policy = step?.intent?.existingSequencePolicy && typeof step.intent.existingSequencePolicy === "object"
        ? step.intent.existingSequencePolicy
        : {};
      const movedEffectNames = arr(policy?.movedEffectNames).map((row) => str(row)).filter(Boolean);
      const movedEffects = arr(policy?.movedEffects)
        .map((row) => ({
          effectName: str(row?.effectName),
          startMs: intNumber(row?.startMs, null),
          endMs: intNumber(row?.endMs, null)
        }))
        .filter((row) => row.effectName && row.startMs !== null && row.endMs !== null && row.endMs > row.startMs);
      if (movedEffectNames.length || movedEffects.length) {
        readbackChecks.push((async () => {
          const modelName = normalizeElementName(params);
          const toLayer = intNumber(params.toLayerIndex ?? params.toLayer, null);
          if (toLayer === null) {
            return {
              kind: "effect-layer-reorder",
              target: `${modelName}@?`,
              ok: false,
              detail: "target layer missing"
            };
          }
          const rowsToVerify = movedEffects.length
            ? movedEffects
            : [{ effectName: movedEffectNames[0], startMs: 0, endMs: 1 }];
          const results = await Promise.all(rowsToVerify.map(async (expected) => {
            const resp = await listEffects(endpoint, {
              modelName,
              layerIndex: toLayer,
              startMs: expected.startMs,
              endMs: expected.endMs
            });
            const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
            return effects.some((row) =>
              Number(row?.layerIndex) === toLayer &&
              str(row?.effectName) === expected.effectName &&
              Number(row?.startMs) === expected.startMs &&
              Number(row?.endMs) === expected.endMs
            );
          }));
          const movedPresent = results.every(Boolean);
          const expectedNames = rowsToVerify.map((row) => row.effectName).filter(Boolean);
          return {
            kind: "effect-layer-reorder",
            target: `${modelName}@${toLayer}`,
            ok: movedPresent,
            detail: movedPresent
              ? `${expectedNames.join(", ")} moved to layer ${toLayer}`
              : `${expectedNames.join(", ")} missing from layer ${toLayer}`
          };
        })());
      }
    }
    if (cmd === "effects.deleteLayer" && normalizeElementName(params) && listEffects) {
      const policy = step?.intent?.existingSequencePolicy && typeof step.intent.existingSequencePolicy === "object"
        ? step.intent.existingSequencePolicy
        : {};
      const deletedEffects = arr(policy?.deletedEffects)
        .map((row) => ({
          effectName: str(row?.effectName),
          startMs: intNumber(row?.startMs, null),
          endMs: intNumber(row?.endMs, null)
        }))
        .filter((row) => row.effectName && row.startMs !== null && row.endMs !== null && row.endMs > row.startMs);
      readbackChecks.push((async () => {
        const modelName = normalizeElementName(params);
        const layerIndex = intNumber(params.layerIndex ?? params.layer, null);
        if (layerIndex === null) {
          return {
            kind: "effect-layer-delete",
            target: `${modelName}@?`,
            ok: false,
            detail: "layer missing"
          };
        }
        const rowsToVerify = deletedEffects.length ? deletedEffects : [{ effectName: "", startMs: undefined, endMs: undefined }];
        const results = await Promise.all(rowsToVerify.map(async (expected) => {
          const query = { modelName, layerIndex };
          if (expected.startMs !== undefined) query.startMs = expected.startMs;
          if (expected.endMs !== undefined) query.endMs = expected.endMs;
          const resp = await listEffects(endpoint, query);
          const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
          return !effects.some((row) =>
            Number(row?.layerIndex) === layerIndex &&
            (!expected.effectName || str(row?.effectName) === expected.effectName) &&
            (expected.startMs === undefined || Number(row?.startMs) === expected.startMs) &&
            (expected.endMs === undefined || Number(row?.endMs) === expected.endMs)
          );
        }));
        const layerAbsent = results.every(Boolean);
        return {
          kind: "effect-layer-delete",
          target: `${modelName}@${layerIndex}`,
          ok: layerAbsent,
          detail: layerAbsent ? `layer ${layerIndex} effects absent` : `layer ${layerIndex} still contains deleted effects`
        };
      })());
    }
    if (cmd === "effects.compactLayers" && normalizeElementName(params) && listEffects) {
      const policy = step?.intent?.existingSequencePolicy && typeof step.intent.existingSequencePolicy === "object"
        ? step.intent.existingSequencePolicy
        : {};
      const compactedEffects = arr(policy?.compactedEffects)
        .map((row) => ({
          effectName: str(row?.effectName),
          startMs: intNumber(row?.startMs, null),
          endMs: intNumber(row?.endMs, null),
          fromLayerIndex: intNumber(row?.fromLayerIndex, null),
          toLayerIndex: intNumber(row?.toLayerIndex, null)
        }))
        .filter((row) =>
          row.effectName &&
          row.startMs !== null &&
          row.endMs !== null &&
          row.endMs > row.startMs &&
          row.fromLayerIndex !== null &&
          row.toLayerIndex !== null &&
          row.fromLayerIndex !== row.toLayerIndex);
      if (compactedEffects.length) {
        readbackChecks.push((async () => {
          const modelName = normalizeElementName(params);
          const results = await Promise.all(compactedEffects.map(async (expected) => {
            const resp = await listEffects(endpoint, {
              modelName,
              layerIndex: expected.toLayerIndex,
              startMs: expected.startMs,
              endMs: expected.endMs
            });
            const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
            return effects.some((row) =>
              Number(row?.layerIndex) === expected.toLayerIndex &&
              str(row?.effectName) === expected.effectName &&
              Number(row?.startMs) === expected.startMs &&
              Number(row?.endMs) === expected.endMs
            );
          }));
          const compactedPresent = results.every(Boolean);
          return {
            kind: "effect-layer-compact",
            target: modelName,
            ok: compactedPresent,
            detail: compactedPresent ? "compacted effects moved to expected layers" : "compacted effects missing from expected layers"
          };
        })());
      }
    }
  }

  for (const effect of expectedFinalEffects) {
    if (effect?.modelName && listEffects) {
      const modelName = effect.modelName;
      const parentId = parseSubmodelParentId(modelName);
      const layerIndex = Number(effect.layerIndex);
      const startMs = Number(effect.startMs);
      const endMs = Number(effect.endMs);
      const effectName = String(effect.effectName || "").trim();
      const preservationPolicy = preservationPolicyForStep(effect.sourceStep);
      readbackChecks.push((async () => {
        const resp = await listEffects(endpoint, { modelName, layerIndex, startMs, endMs });
        const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
        const ok = effects.some((row) =>
          String(row?.effectName || "").trim() === effectName &&
          Number(row?.startMs) === startMs &&
          Number(row?.endMs) === endMs &&
          Number(row?.layerIndex) === layerIndex
        );
        return {
          kind: "effect",
          target: `${modelName}@${layerIndex}`,
          ok,
          detail: ok ? `${effectName} present` : `${effectName} missing`
        };
      })());
      if (preservationPolicy) {
        readbackChecks.push((async () => {
          const resp = await listEffects(endpoint, {
            modelName,
            layerIndex: preservationPolicy.originalLayerIndex,
            startMs,
            endMs
          });
          const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
          const preserved = preservationPolicy.overlappingEffectNames.length
            ? effects.some((row) => preservationPolicy.overlappingEffectNames.includes(str(row?.effectName)))
            : effects.length > 0;
          return {
            kind: "effect-preservation",
            target: `${modelName}@${preservationPolicy.originalLayerIndex}->${preservationPolicy.plannedLayerIndex}`,
            ok: preserved && layerIndex === preservationPolicy.plannedLayerIndex,
            detail: preserved
              ? `original layer ${preservationPolicy.originalLayerIndex} preserved`
              : `original layer ${preservationPolicy.originalLayerIndex} missing preserved effects`
          };
        })());
      }
      if (effect.sourceStep?.intent?.clonePolicy?.explicitCloneRequest === true) {
        readbackChecks.push((async () => {
          const resp = await listEffects(endpoint, { modelName, layerIndex, startMs, endMs });
          const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
          const actual = effects.find((row) =>
            String(row?.effectName || "").trim() === effectName &&
            Number(row?.startMs) === startMs &&
            Number(row?.endMs) === endMs &&
            Number(row?.layerIndex) === layerIndex
          );
          const settingsMatch = actual ? compareIfExpected(actual?.settings, effect.sourceStep?.params?.settings) : false;
          const paletteMatch = actual ? compareIfExpected(actual?.palette, effect.sourceStep?.params?.palette) : false;
          return {
            kind: "effect-clone",
            target: `${modelName}@${layerIndex}`,
            ok: Boolean(actual) && settingsMatch && paletteMatch,
            detail: !actual
              ? `${effectName} missing`
              : settingsMatch && paletteMatch
                ? `${effectName} clone matched source payload`
                : `${effectName} clone payload mismatch`,
            settingsMatched: settingsMatch,
            paletteMatched: paletteMatch
          };
        })());
      }
      if (parentId && !plannedEffectKeys.has(effectPlanKey(parentId, layerIndex, startMs, endMs, effectName))) {
        readbackChecks.push((async () => {
          const resp = await listEffects(endpoint, {
            modelName: parentId,
            layerIndex,
            startMs,
            endMs
          });
          const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
          const broadened = effects.some((row) =>
            String(row?.effectName || "").trim() === effectName &&
            Number(row?.startMs) === startMs &&
            Number(row?.endMs) === endMs &&
            Number(row?.layerIndex) === layerIndex
          );
          return {
            kind: "submodel-precision",
            target: `${modelName}->${parentId}@${layerIndex}`,
            ok: !broadened,
            detail: broadened ? `${effectName} broadened to parent` : "parent remained unchanged"
          };
        })());
      }
      const submodel = submodelGraph[modelName];
      const parentPlanned = parentId && plannedEffectKeys.has(effectPlanKey(parentId, layerIndex, startMs, endMs, effectName));
      if (submodel?.parentId && submodel.nodeChannels.size && !parentPlanned) {
        const overlappingSiblings = Object.values(submodelGraph).filter((candidate) => {
          if (!candidate || candidate.id === modelName) return false;
          if (candidate.parentId !== submodel.parentId) return false;
          if (!candidate.nodeChannels.size) return false;
          for (const ch of submodel.nodeChannels) {
            if (candidate.nodeChannels.has(ch)) return true;
          }
          return false;
        });
        for (const sibling of overlappingSiblings) {
          if (plannedEffectKeys.has(effectPlanKey(sibling.id, layerIndex, startMs, endMs, effectName))) continue;
          readbackChecks.push((async () => {
            const resp = await listEffects(endpoint, {
              modelName: sibling.id,
              layerIndex,
              startMs,
              endMs
            });
            const effects = Array.isArray(resp?.data?.effects) ? resp.data.effects : [];
            const broadened = effects.some((row) =>
              String(row?.effectName || "").trim() === effectName &&
              Number(row?.startMs) === startMs &&
              Number(row?.endMs) === endMs &&
              Number(row?.layerIndex) === layerIndex
            );
            return {
              kind: "submodel-sibling-precision",
              target: `${modelName}->${sibling.id}@${layerIndex}`,
              ok: !broadened,
              detail: broadened ? `${effectName} broadened to overlapping sibling` : "overlapping sibling remained unchanged"
            };
        })());
      }
    }
  }
  }

  const results = await Promise.allSettled(readbackChecks);
  verification.checks = results.map((row) => {
    if (row.status === "fulfilled") return row.value;
    return {
      kind: "readback",
      target: "",
      ok: false,
      detail: String(row.reason?.message || row.reason || "readback failed")
    };
  });
  verification.expectedMutationsPresent =
    verification.checks.length > 0 && verification.checks.every((row) => Boolean(row?.ok));
  const designContext = buildReadbackDesignContext(deps?.planMetadata, deps?.sequencingDesignHandoff);
  const designAlignment = buildDesignAlignment(designContext, collectAppliedEffectTargets(commands));
  verification.designContext = {
    designSummary: designContext.designSummary,
    sectionDirectiveCount: designContext.sectionDirectiveCount,
    trainingKnowledge: designContext.trainingKnowledge
  };
  verification.designAlignment = designAlignment;
  verification.designChecks = buildDesignChecks(designAlignment);
  return verification;
}

export { timingMarksSignature };
