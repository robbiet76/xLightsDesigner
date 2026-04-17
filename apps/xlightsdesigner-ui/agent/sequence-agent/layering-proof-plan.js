function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function num(value, fallback = 0) {
  const out = Number(value);
  return Number.isFinite(out) ? out : fallback;
}

function boundsForPlacements(placements = []) {
  return {
    startMs: Math.min(...placements.map((row) => num(row?.startMs, Number.POSITIVE_INFINITY))),
    endMs: Math.max(...placements.map((row) => num(row?.endMs, Number.NEGATIVE_INFINITY))),
  };
}

function proofRequirementsForTaxonomy(taxonomy = "") {
  switch (str(taxonomy)) {
    case "same_target_layer_stack":
      return {
        scopeLevel: "same_target_window",
        renderPasses: [
          "composite_window",
          "isolated_element_windows"
        ],
        requiredObservations: [
          "stacked composite read",
          "per-element realization read"
        ],
        critiqueEnabled: true,
      };
    case "same_target_transition":
      return {
        scopeLevel: "same_target_transition",
        renderPasses: [
          "handoff_window",
          "isolated_element_windows"
        ],
        requiredObservations: [
          "handoff continuity read",
          "per-element realization read"
        ],
        critiqueEnabled: true,
      };
    case "parent_submodel_overlap":
      return {
        scopeLevel: "parent_submodel_window",
        renderPasses: [
          "composite_window",
          "isolated_element_windows",
          "ownership_window"
        ],
        requiredObservations: [
          "parent and submodel composite read",
          "per-element realization read",
          "overlap ownership read"
        ],
        critiqueEnabled: true,
      };
    default:
      return {
        scopeLevel: "unsupported",
        renderPasses: [],
        requiredObservations: [],
        critiqueEnabled: false,
      };
  }
}

export function buildLayeringProofPlan({ groupSet = null } = {}) {
  const groups = arr(groupSet?.groups);
  const unresolved = arr(groupSet?.unresolved);

  const proofs = groups.map((group) => {
    const placements = arr(group?.placements);
    const timeWindow = boundsForPlacements(placements);
    const requirements = proofRequirementsForTaxonomy(group?.taxonomy);
    return {
      artifactType: "layering_proof_requirement_v1",
      proofId: `proof:${str(group?.groupId)}`,
      groupId: str(group?.groupId),
      taxonomy: str(group?.taxonomy),
      scope: {
        scopeLevel: requirements.scopeLevel,
        targetId: str(group?.targetId),
        parentTargetId: str(group?.parentTargetId),
        overlapType: str(group?.overlapType),
        timeWindow,
      },
      placementRefs: placements.map((row) => ({
        placementId: str(row?.placementId),
        targetId: str(row?.targetId),
        layerIndex: Number.isInteger(Number(row?.layerIndex)) ? Number(row.layerIndex) : 0,
        effectName: str(row?.effectName),
        startMs: num(row?.startMs),
        endMs: num(row?.endMs),
      })),
      renderPasses: requirements.renderPasses,
      requiredObservations: requirements.requiredObservations,
      critiqueEnabled: requirements.critiqueEnabled,
    };
  });

  const blocked = unresolved.map((group) => ({
    artifactType: "layering_proof_requirement_v1",
    proofId: `proof:${str(group?.groupId)}`,
    groupId: str(group?.groupId),
    taxonomy: str(group?.taxonomy),
    critiqueEnabled: false,
    blocked: true,
    unresolvedReason: str(group?.unresolvedReason),
    placementRefs: arr(group?.placements).map((row) => ({
      placementId: str(row?.placementId),
      targetId: str(row?.targetId),
    })),
  }));

  return {
    artifactType: "layering_proof_plan_v1",
    artifactVersion: 1,
    proofs,
    blocked,
  };
}

