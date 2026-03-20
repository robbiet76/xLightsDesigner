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

const VISUAL_FAMILY_EFFECT_MAP = {
  spiral_flow: ["Spirals"],
  helical_spiral_flow: ["Spirals"],
  segmented_motion: ["Bars", "Marquee"],
  directional_motion: ["Bars", "Marquee", "SingleStrand", "Spirals"],
  bounce_motion: ["SingleStrand"],
  radial_rotation: ["Pinwheel", "Shockwave"],
  diffuse_expand: ["Shockwave"],
  soft_texture: ["Twinkle", "Shimmer"],
  crisp_texture: ["Twinkle", "Shockwave"],
  static_fill: ["Color Wash", "On"],
  fill: ["Color Wash", "On", "Bars", "Marquee", "Shockwave"]
};

function parseSubmodelParentId(target = "") {
  const name = String(target || "").trim();
  const idx = name.indexOf("/");
  if (idx <= 0) return "";
  return name.slice(0, idx);
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

function normalizeSubmodelGraph(submodelsById = {}) {
  const out = {};
  if (!submodelsById || typeof submodelsById !== "object" || Array.isArray(submodelsById)) return out;
  for (const [key, value] of Object.entries(submodelsById)) {
    const id = String(key || value?.id || "").trim();
    if (!id) continue;
    out[id] = {
      id,
      parentId: String(value?.parentId || "").trim(),
      nodeChannels: new Set(
        Array.isArray(value?.membership?.nodeChannels)
          ? value.membership.nodeChannels.map((v) => Number(v)).filter((v) => Number.isFinite(v))
          : []
      )
    };
  }
  return out;
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
  return arr(commands)
    .filter((step) => str(step?.cmd) === "effects.create")
    .map((step) => ({
      targetId: str(step?.params?.modelName),
      effectName: str(step?.params?.effectName)
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
  const preferredEffectHints = Array.from(new Set(
    preferredVisualFamilies.flatMap((row) => VISUAL_FAMILY_EFFECT_MAP[row] || [])
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
    preferredEffectHints,
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
  if (Array.isArray(designAlignment.preferredEffectHints) && designAlignment.preferredEffectHints.length) {
    const matched = designAlignment.preferredEffectHints.filter((effectName) =>
      arr(designAlignment.observedEffectNames).includes(effectName)
    );
    checks.push({
      kind: "design-visual-family",
      target: designAlignment.preferredVisualFamilies.join(", "),
      ok: matched.length > 0,
      detail: matched.length
        ? `matched ${matched.join(", ")}`
        : `no observed effects matched preferred families (${designAlignment.preferredEffectHints.join(", ")})`
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
  const plannedEffectKeys = new Set(
    commands
      .filter((step) => String(step?.cmd || "").trim() === "effects.create")
      .map((step) => effectPlanKey(
        step?.params?.modelName,
        step?.params?.layerIndex,
        step?.params?.startMs,
        step?.params?.endMs,
        step?.params?.effectName
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
          detail: ok ? "mark signature matched" : "mark signature mismatch"
        };
      })());
    }
    if (cmd === "sequencer.setDisplayElementOrder" && Array.isArray(params.orderedIds) && params.orderedIds.length && getDisplayElementOrder) {
      readbackChecks.push((async () => {
        const expectedOrder = params.orderedIds.map((row) => String(row || "").trim()).filter(Boolean);
        const resp = await getDisplayElementOrder(endpoint);
        const elements = Array.isArray(resp?.data?.elements) ? resp.data.elements : [];
        const actualOrder = elements.map((row) => String(row?.id || row?.name || "").trim()).filter(Boolean);
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
    if (cmd === "effects.create" && String(params.modelName || "").trim() && listEffects) {
      const modelName = String(params.modelName || "").trim();
      const parentId = parseSubmodelParentId(modelName);
      const layerIndex = Number(params.layerIndex);
      const startMs = Number(params.startMs);
      const endMs = Number(params.endMs);
      const effectName = String(params.effectName || "").trim();
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
