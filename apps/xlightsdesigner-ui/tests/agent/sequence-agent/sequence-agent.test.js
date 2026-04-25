import test from "node:test";
import assert from "node:assert/strict";

import { buildSequenceAgentPlan } from "../../../agent/sequence-agent/sequence-agent.js";
import { SEQUENCE_AGENT_CONTRACT_VERSION, SEQUENCE_AGENT_ROLE } from "../../../agent/sequence-agent/sequence-agent-contracts.js";
import { buildEffectDefinitionCatalog } from "../../../agent/sequence-agent/effect-definition-catalog.js";

function sampleAnalysis() {
  return {
    trackIdentity: { title: "Track A", artist: "Artist A" },
    structure: { sections: ["Intro", "Verse 1", "Chorus 1"] },
    briefSeed: { tone: "upbeat" }
  };
}

function sampleIntent() {
  return {
    goal: "Increase chorus energy on focal props",
    mode: "revise",
    scope: {
      targetIds: ["MegaTree", "Roofline"],
      tagNames: ["focal"],
      sections: ["Chorus 1"]
    }
  };
}

function sampleCatalog() {
  return buildEffectDefinitionCatalog([
    { effectName: "Bars", params: [] },
    { effectName: "Color Wash", params: [] },
    { effectName: "Shimmer", params: [] },
    { effectName: "On", params: [] }
  ]);
}

function sampleGroups() {
  return {
    AllModels: {
      renderPolicy: {
        layout: "minimalGrid",
        defaultBufferStyle: "Default",
        category: "default"
      },
      members: {
        direct: [
          { id: "Frontline", name: "Frontline", isGroup: true },
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ],
        flattenedAll: [
          { id: "Frontline", name: "Frontline", isGroup: true },
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ]
      }
    },
    Frontline: {
      renderPolicy: {
        layout: "horizontal",
        defaultBufferStyle: "Horizontal Per Model",
        category: "per_model",
        availableBufferStyles: ["Default", "Horizontal Per Model", "Per Model Vertical Per Strand"]
      },
      members: {
        direct: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ],
        flattenedAll: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ]
      }
    },
    FrontlineDefault: {
      renderPolicy: {
        layout: "minimalGrid",
        defaultBufferStyle: "Default",
        category: "default"
      },
      members: {
        direct: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ],
        flattenedAll: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" }
        ]
      }
    },
    NestedFrontline: {
      renderPolicy: {
        layout: "Overlay - Centered",
        defaultBufferStyle: "Overlay - Centered",
        category: "overlay",
        availableBufferStyles: ["Overlay - Centered", "Overlay - Scaled", "Default"]
      },
      members: {
        direct: [
          { id: "Frontline", name: "Frontline", isGroup: true },
          { id: "WindowLeft", name: "WindowLeft" }
        ],
        flattenedAll: [
          { id: "MegaTree", name: "MegaTree" },
          { id: "Roofline", name: "Roofline" },
          { id: "WindowLeft", name: "WindowLeft" }
        ]
      }
    },
    PixelSpokes: {
      renderPolicy: {
        layout: "Per Model Vertical Per Strand",
        defaultBufferStyle: "Per Model Vertical Per Strand",
        category: "per_model_strand",
        availableBufferStyles: ["Per Model Vertical Per Strand", "Per Model Horizontal Per Strand", "Default"]
      },
      members: {
        direct: [
          { id: "Spoke1", name: "Spoke1" },
          { id: "Spoke2", name: "Spoke2" }
        ],
        flattenedAll: [
          { id: "Spoke1", name: "Spoke1" },
          { id: "Spoke2", name: "Spoke2" }
        ]
      }
    },
    StyleOnlyOverlay: {
      renderPolicy: {
        layout: "Overlay - Scaled",
        defaultBufferStyle: "Overlay - Scaled",
        category: "default",
        availableBufferStyles: ["Overlay - Centered", "Overlay - Scaled", "Default"]
      },
      members: {
        direct: [
          { id: "WindowA", name: "WindowA" },
          { id: "WindowB", name: "WindowB" }
        ],
        flattenedAll: [
          { id: "WindowA", name: "WindowA" },
          { id: "WindowB", name: "WindowB" }
        ]
      }
    }
  };
}

function sampleSubmodels() {
  return {
    "MegaTree/Star": {
      id: "MegaTree/Star",
      parentId: "MegaTree",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Default", availableBufferStyles: ["Default", "Keep XY"] },
      membership: { nodeChannels: [1, 2, 3] }
    },
    "MegaTree/TopHalf": {
      id: "MegaTree/TopHalf",
      parentId: "MegaTree",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Default", availableBufferStyles: ["Default", "Keep XY"] },
      membership: { nodeChannels: [3, 4, 5] }
    },
    "MegaTree/KeepXY": {
      id: "MegaTree/KeepXY",
      parentId: "MegaTree",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Keep XY", availableBufferStyles: ["Default", "Keep XY", "Stacked Strands"] },
      membership: { nodeChannels: [6, 7, 8] }
    },
    "MegaTree/SubBuffer": {
      id: "MegaTree/SubBuffer",
      parentId: "MegaTree",
      renderPolicy: { submodelType: "subbuffer", bufferStyle: "Default", availableBufferStyles: ["Default"] },
      membership: { nodeChannels: [9, 10, 11] }
    },
    "Roofline/Left": {
      id: "Roofline/Left",
      parentId: "Roofline",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Default", availableBufferStyles: ["Default"] },
      membership: { nodeChannels: [21, 22, 23] }
    },
    "Roofline/Right": {
      id: "Roofline/Right",
      parentId: "Roofline",
      renderPolicy: { submodelType: "ranges", bufferStyle: "Default", availableBufferStyles: ["Default"] },
      membership: { nodeChannels: [31, 32, 33] }
    }
  };
}

test("sequence_agent requires intent handoff", () => {
  assert.throws(
    () => buildSequenceAgentPlan({ analysisHandoff: sampleAnalysis(), intentHandoff: null }),
    /intent_handoff_v1 is required/i
  );
});

test("sequence_agent builds validated command plan from handoffs", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: [
      "Chorus 1 / MegaTree / increase pulse contrast and faster motion",
      "Chorus 1 / Roofline / mirror rhythm with delayed accents"
    ],
    baseRevision: "rev-55",
    effectCatalog: sampleCatalog()
  });

  assert.equal(typeof out.planId, "string");
  assert.equal(out.agentRole, SEQUENCE_AGENT_ROLE);
  assert.equal(out.contractVersion, SEQUENCE_AGENT_CONTRACT_VERSION);
  assert.equal(out.validationReady, true);
  assert.equal(out.baseRevision, "rev-55");
  assert.equal(Array.isArray(out.commands), true);
  assert.ok(out.commands.length > 0);
  assert.equal(out.commands[0].cmd, "timing.createTrack");
  assert.equal(out.commands[1].cmd, "timing.insertMarks");
  assert.equal(out.commands[0].params.trackName, "XD: Song Structure");
  assert.equal(out.metadata.mode, "revise");
  assert.equal(out.metadata.degradedMode, false);
  assert.deepEqual(out.metadata.scope.sections, ["Chorus 1"]);
  assert.equal(out.commands.some((row) => row.cmd === "effects.alignToTiming"), true);
});

test("sequence_agent plan metadata carries artistic goal, revision objective, and sequencer brief", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      goal: "Increase chorus energy on focal props",
      scope: {
        targetIds: ["MegaTree", "Roofline"],
        sections: ["Chorus 1"],
        tagNames: ["focal"]
      },
      designSummary: "MegaTree leads while roofline supports the chorus lift."
    },
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      scope: { goalLevel: "section" },
      artisticIntent: {
        leadTarget: "MegaTree",
        supportTargets: ["Roofline"],
        sectionArc: "lift",
        motionCharacter: "expanding_motion",
        densityCharacter: "moderate"
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: {
        artisticCorrection: "Clarify the chorus lift while keeping the tree dominant."
      },
      sequencerDirection: {
        executionObjective: "Increase support motion on the roofline without creating a second lead."
      },
      successChecks: ["tree remains dominant"]
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      unresolvedSignals: ["lead_mismatch"],
      previousEffectNames: ["Shimmer", "Twinkle"],
      previousTargetIds: ["MegaTree", "Roofline"]
    },
    sourceLines: ["Chorus 1 / MegaTree / increase pulse contrast and faster motion"],
    baseRevision: "rev-56",
    effectCatalog: sampleCatalog()
  });

  assert.equal(out.metadata.sequenceArtisticGoal.artifactType, "sequence_artistic_goal_v1");
  assert.equal(out.metadata.sequenceRevisionObjective.artifactType, "sequence_revision_objective_v1");
  assert.equal(out.metadata.sequencerRevisionBrief.artifactType, "sequencer_revision_brief_v1");
  assert.equal(out.metadata.intentEnvelope.artifactType, "intent_envelope_v1");
  assert.equal(out.metadata.realizationCandidates.artifactType, "realization_candidates_v1");
  assert.equal(out.metadata.candidateSelection.artifactType, "candidate_selection_v1");
  assert.equal(out.metadata.revisionDelta.artifactType, "revision_delta_v1");
  assert.equal(out.metadata.revisionRetryPressure.artifactType, "revision_retry_pressure_v1");
  assert.ok(Array.isArray(out.metadata.realizationCandidates.candidates));
  assert.ok(out.metadata.realizationCandidates.candidates.length >= 2);
  assert.ok(Array.isArray(out.metadata.candidateSelection.scoredCandidates));
  assert.ok(out.metadata.candidateSelection.scoredCandidates.length >= 2);
  assert.ok(Array.isArray(out.metadata.candidateSelection.selectedBand.candidateIds));
  assert.ok(out.metadata.candidateSelection.selectedBand.candidateIds.length >= 1);
  assert.equal(out.metadata.sequencerRevisionBrief.leadTarget, "MegaTree");
  assert.deepEqual(out.metadata.sequencerRevisionBrief.supportTargets, ["Roofline"]);
  assert.deepEqual(out.metadata.sequencerRevisionBrief.revisionRoles, ["strengthen_lead"]);
  assert.deepEqual(out.metadata.sequencerRevisionBrief.revisionTargets, []);
  assert.deepEqual(out.metadata.priorPassMemory.unresolvedSignals, ["lead_mismatch"]);
  assert.deepEqual(out.metadata.sequencerRevisionBrief.priorPassMemory.unresolvedSignals, ["lead_mismatch"]);
  assert.deepEqual(out.metadata.priorPassMemory.previousEffectNames, ["Shimmer", "Twinkle"]);
  assert.deepEqual(out.metadata.priorPassMemory.previousTargetIds, ["MegaTree", "Roofline"]);
  assert.equal(out.metadata.requestScopeMode, "section_target_refinement");
  assert.equal(out.metadata.reviewStartLevel, "section");
  assert.equal(out.metadata.sectionScopeKind, "timing_track_windows");
  assert.equal(out.metadata.parameterTrainingKnowledge.artifactType, "sequencer_derived_parameter_priors_bundle");
  assert.equal(out.metadata.sharedSettingTrainingKnowledge.artifactType, "sequencer_cross_effect_shared_settings_bundle");
  assert.equal(out.metadata.intentEnvelope.attention.profile, "weighted");
  assert.equal(out.metadata.realizationCandidates.source.intentEnvelopeRef, out.metadata.intentEnvelope.artifactId);
  assert.equal(out.metadata.candidateSelection.source.intentEnvelopeRef, out.metadata.intentEnvelope.artifactId);
  assert.equal(out.metadata.candidateSelection.source.realizationCandidatesRef, out.metadata.realizationCandidates.artifactId);
  assert.equal(out.metadata.candidateSelection.policy.mode, "deterministic_preview");
  assert.equal(out.metadata.candidateSelection.policy.phase, "plan");
  assert.equal(out.metadata.candidateChoice.selectionMode, "deterministic_preview");
  assert.equal(out.metadata.effectStrategy.selectedCandidateId, out.metadata.candidateChoice.chosenCandidateId);
  assert.deepEqual(out.metadata.revisionDelta.previous.effectNames, ["Shimmer", "Twinkle"]);
  assert.deepEqual(out.metadata.revisionDelta.previous.targetIds, ["MegaTree", "Roofline"]);
  assert.deepEqual(out.metadata.revisionRetryPressure.signals || [], []);
  assert.ok(Array.isArray(out.metadata.revisionDelta.current.effectNames));
  assert.ok(Array.isArray(out.metadata.revisionDelta.current.targetIds));
  assert.equal(out.metadata.realizationCandidates.candidates[0].revisionSignals.overallAlignment, "high");
  assert.equal(typeof out.metadata.candidateSelection.scoredCandidates[0].revisionScore, "number");
  assert.equal(typeof out.metadata.candidateSelection.primaryCandidateId, "string");
});

test("sequence_agent candidate selection switches to bounded exploration when runtime context provides a seed", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / increase pulse contrast and faster motion"],
    baseRevision: "rev-56",
    effectCatalog: sampleCatalog(),
    candidateSelectionContext: {
      phase: "review",
      seed: "review::orch-1::rev-56",
      explorationEnabled: true,
      unresolvedSignals: ["lead_mismatch"]
    }
  });

  assert.equal(out.metadata.candidateSelection.policy.mode, "bounded_exploration");
  assert.equal(out.metadata.candidateSelection.policy.phase, "review");
  assert.equal(out.metadata.candidateSelection.selectionContext.seed, "review::orch-1::rev-56");
  assert.equal(out.metadata.candidateSelectionContext.seed, "review::orch-1::rev-56");
  assert.equal(out.metadata.candidateChoice.selectionMode, "bounded_exploration");
  assert.equal(typeof out.metadata.effectStrategy.selectedCandidateId, "string");
});

test("sequence_agent adds a feedback-shaped candidate when revision feedback gives new target and motion direction", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: {
        artisticCorrection: "Shift the pass toward the spiral trees."
      },
      sequencerDirection: {
        executionObjective: "Use flowing spiral motion on SpiralTrees."
      }
    },
    revisionFeedback: {
      artifactType: "revision_feedback_v1",
      status: "revise_required",
      rejectionReasons: ["lead_mismatch"],
      nextDirection: {
        artisticCorrection: "Shift the pass toward the spiral trees.",
        executionObjective: "Use flowing spiral motion on SpiralTrees.",
        targetIds: ["SpiralTrees"]
      }
    },
    sourceLines: ["Chorus 1 / MegaTree / increase pulse contrast and faster motion"],
    baseRevision: "rev-56",
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Bars", params: [] },
      { effectName: "Color Wash", params: [] },
      { effectName: "Shimmer", params: [] },
      { effectName: "Spirals", params: [] }
    ])
  });

  const feedbackCandidate = out.metadata.realizationCandidates.candidates.find((row) => row.candidateId === "candidate-feedback");
  assert.ok(feedbackCandidate);
  assert.deepEqual(feedbackCandidate.targetStrategy.primaryTargets, ["SpiralTrees"]);
  assert.equal(feedbackCandidate.seedRecommendations[0].effectName, "Spirals");
});

test("sequence_agent feedback-shaped candidate carries progression and layering bias", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: {
        nextOwner: "shared",
        revisionRoles: ["reduce_competing_support"]
      },
      designerDirection: {
        artisticCorrection: "Keep the scene readable while making the section evolve."
      },
      sequencerDirection: {
        executionObjective: "Add development without crowding the same structure."
      }
    },
    revisionFeedback: {
      artifactType: "revision_feedback_v1",
      status: "revise_required",
      rejectionReasons: ["Rendered section development is too flat across the sampled window."],
      nextDirection: {
        executionObjective: "Add development without crowding the same structure.",
        changeBias: {
          composition: { mismatch: false, targetShape: "preserve" },
          progression: { mismatch: true, temporalVariation: "increase" },
          layering: { mismatch: true, separation: "increase", density: "reduce" }
        }
      }
    },
    sourceLines: ["Chorus 1 / MegaTree + Roofline / hold current support shape"],
    baseRevision: "rev-56",
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Bars", params: [] },
      { effectName: "Color Wash", params: [] },
      { effectName: "Shimmer", params: [] },
      { effectName: "Morph", params: [] }
    ])
  });

  const feedbackCandidate = out.metadata.realizationCandidates.candidates.find((row) => row.candidateId === "candidate-feedback");
  assert.ok(feedbackCandidate);
  assert.equal(feedbackCandidate.temporalProfile.profile, "evolving");
  assert.equal(feedbackCandidate.layeringProfile.sameStructureDensity, "low");
  assert.equal(feedbackCandidate.layeringProfile.separationStrategy, "high");
  assert.equal(feedbackCandidate.layeringProfile.cadenceStrategy, "contrasting");
});

test("sequence_agent plan metadata carries render validation evidence refs", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / build then release"],
    baseRevision: "rev-77",
    effectCatalog: sampleCatalog(),
    renderValidationEvidence: {
      renderObservationRef: "/tmp/render-observation.json",
      compositionObservationRef: "/tmp/composition-observation.json",
      layeringObservationRef: "/tmp/layering-observation.json",
      progressionObservationRef: "/tmp/progression-observation.json",
      sequenceCritiqueRef: "/tmp/sequence-critique.json",
      scopeLevel: "section_window",
      sectionNames: ["Chorus 1"],
      targetIds: ["MegaTree"]
    }
  });

  assert.deepEqual(out.metadata.renderValidationEvidence, {
    renderObservationRef: "/tmp/render-observation.json",
    compositionObservationRef: "/tmp/composition-observation.json",
    layeringObservationRef: "/tmp/layering-observation.json",
    progressionObservationRef: "/tmp/progression-observation.json",
    sequenceCritiqueRef: "/tmp/sequence-critique.json",
    scopeLevel: "section_window",
    sectionNames: ["Chorus 1"],
    targetIds: ["MegaTree"]
  });
});

test("sequence_agent exposes bounded parameter prior guidance for matched target geometry", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track P", artist: "Artist P" },
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 0, endMs: 1000, energy: "high", density: "medium" }
        ]
      }
    },
    intentHandoff: {
      goal: "Drive a strong radial spin on the focal spinner.",
      mode: "revise",
      scope: {
        targetIds: ["SpinnerHero"],
        tagNames: ["focal"],
        sections: ["Chorus 1"]
      },
      executionStrategy: {
        sectionPlans: [
          {
            section: "Chorus 1",
            energy: "high",
            density: "medium",
            intentSummary: "radial spin with stronger motion",
            targetIds: ["SpinnerHero"],
            effectHints: ["Pinwheel"]
          }
        ]
      }
    },
    displayElements: [
      { id: "SpinnerHero", name: "SpinnerHero", type: "model", displayAs: "Spinner", geometryProfile: "spinner_standard" }
    ],
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Pinwheel", params: [] },
      { effectName: "Color Wash", params: [] }
    ])
  });

  const recommendation = out.metadata.effectStrategy.seedRecommendations[0];
  assert.equal(recommendation.effectName, "Pinwheel");
  assert.equal(recommendation.parameterPriorGuidance.recommendationMode, "exact_geometry");
  assert.deepEqual(recommendation.parameterPriorGuidance.matchedGeometryProfiles, ["spinner_standard"]);
  assert.ok(recommendation.parameterPriorGuidance.priors.length > 0);
  assert.equal(recommendation.parameterPriorGuidance.priors[0].geometryProfile, "spinner_standard");
  assert.equal(recommendation.sharedSettingPriorGuidance.recommendationMode === "none" || recommendation.sharedSettingPriorGuidance.recommendationMode === "cross_effect_generic", true);
  assert.equal(Array.isArray(recommendation.sharedSettingPriorGuidance.settings), true);
});

test("sequence_agent uses sequencer revision brief to seed execution lines when explicit lines are absent", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      goal: "Increase chorus energy on focal props",
      scope: {
        targetIds: ["MegaTree", "Roofline"],
        sections: ["Chorus 1"],
        tagNames: ["focal"]
      },
      designSummary: "MegaTree leads while roofline supports the chorus lift."
    },
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      scope: { goalLevel: "section" },
      artisticIntent: {
        leadTarget: "MegaTree",
        supportTargets: ["Roofline"],
        sectionArc: "lift",
        motionCharacter: "expanding_motion",
        densityCharacter: "moderate"
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: {
        artisticCorrection: "Clarify the chorus lift while keeping the tree dominant."
      },
      sequencerDirection: {
        executionObjective: "Increase support motion on the roofline without creating a second lead."
      },
      successChecks: ["tree remains dominant"]
    },
    sourceLines: [],
    baseRevision: "rev-57",
    effectCatalog: sampleCatalog()
  });

  assert.ok(out.executionLines.length > 0);
  assert.match(out.executionLines[0], /Chorus 1/i);
  assert.match(out.executionLines[0], /MegaTree \+ Roofline/i);
  assert.match(out.executionLines[0], /apply .* effect/i);
});

test("sequence_agent biases revision effect choice from successful outcome memory", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      goal: "Increase chorus energy on focal props",
      scope: {
        targetIds: ["MegaTree", "Roofline"],
        sections: ["Chorus 1"]
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared" },
      designerDirection: { artisticCorrection: "Use the prior successful outcome." },
      sequencerDirection: { executionObjective: "Keep the successful effect family bias." }
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      effectOutcomeMemory: {
        successfulEffects: ["On"],
        successfulRevisionRoles: ["strengthen_lead"]
      }
    },
    sourceLines: [],
    baseRevision: "rev-57",
    effectCatalog: sampleCatalog()
  });

  assert.equal(out.metadata.sequencerRevisionBrief.effectOutcomeMemory.successfulEffects[0], "On");
  assert.match(out.executionLines[0], /apply On effect/i);
});

test("sequence_agent prefers role-specific effect outcome tendencies", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      goal: "Increase chorus contrast on focal props",
      scope: {
        targetIds: ["MegaTree", "Roofline"],
        sections: ["Chorus 1"]
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: { nextOwner: "shared", revisionRoles: ["increase_section_contrast"] },
      designerDirection: { artisticCorrection: "Use the prior contrast outcome." },
      sequencerDirection: { executionObjective: "Keep the successful contrast effect family bias." }
    },
    priorPassMemory: {
      artifactType: "sequencer_prior_pass_memory_v1",
      effectOutcomeMemory: {
        successfulEffects: ["On"],
        tendencies: {
          focus: { successfulEffects: ["On"], failedEffects: [] },
          section_contrast: { successfulEffects: ["Bars"], failedEffects: [] }
        }
      }
    },
    sourceLines: [],
    baseRevision: "rev-57",
    effectCatalog: sampleCatalog()
  });

  assert.equal(out.metadata.sequencerRevisionBrief.revisionRoles[0], "increase_section_contrast");
  assert.match(out.executionLines[0], /apply Bars effect/i);
});

test("sequence_agent uses render-driven revision targets to bias effect-strategy seed lines", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      goal: "Increase chorus energy on focal props",
      scope: {
        targetIds: ["MegaTree", "Roofline"],
        sections: ["Chorus 1"],
        tagNames: ["focal"]
      },
      designSummary: "MegaTree leads while roofline supports the chorus lift."
    },
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      scope: { goalLevel: "section" },
      artisticIntent: {
        leadTarget: "MegaTree",
        supportTargets: ["Roofline"]
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: {
        nextOwner: "shared",
        revisionTargets: ["WindowLeft", "MegaTree"]
      },
      designerDirection: {
        artisticCorrection: "Shift support contrast without losing the tree lead."
      },
      sequencerDirection: {
        executionObjective: "Strengthen contrast and hierarchy between the flagged rendered targets.",
        focusTargets: ["ArchSingle"]
      }
    },
    sourceLines: [],
    baseRevision: "rev-57",
    effectCatalog: sampleCatalog()
  });

  assert.match(out.executionLines[0], /ArchSingle \+ WindowLeft \+ MegaTree \+ Roofline/i);
  assert.match(out.executionLines[0], /apply .* effect/i);
});

test("sequence_agent uses revision roles to bias inferred effect families", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      goal: "Refine the chorus focal read.",
      scope: {
        targetIds: ["MegaTree", "Roofline"],
        sections: ["Chorus 1"],
        tagNames: ["focal"]
      },
      designSummary: "MegaTree leads while roofline supports the chorus."
    },
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      scope: { goalLevel: "section" },
      artisticIntent: {
        leadTarget: "MegaTree",
        supportTargets: ["Roofline"],
        sectionArc: "lift",
        motionCharacter: "steady_motion",
        densityCharacter: "moderate"
      },
      evaluationLens: {
        comparisonQuestions: ["Does the chorus read more clearly?"]
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: {
        nextOwner: "shared",
        revisionRoles: ["reduce_competing_support"]
      },
      designerDirection: {
        artisticCorrection: "Keep the chorus readable."
      },
      sequencerDirection: {
        executionObjective: "Refine the current rendered pass."
      },
      successChecks: ["chorus reads clearly"]
    },
    sourceLines: [],
    baseRevision: "rev-58",
    effectCatalog: sampleCatalog()
  });

  assert.deepEqual(out.metadata.sequencerRevisionBrief.revisionRoles, ["reduce_competing_support"]);
  assert.match(out.executionLines[0], /apply .* effect/i);
  assert.doesNotMatch(out.executionLines[0], /apply Bars effect/i);
  assert.deepEqual(out.metadata.effectStrategy.seedRecommendations[0].parameterPriorGuidance.desiredBehaviorHints, []);
});

test("sequence_agent does not let revision roles override explicit brief motion cues", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      goal: "Refine the chorus focal read.",
      scope: {
        targetIds: ["SpiralTrees"],
        sections: ["Chorus 1"],
        tagNames: ["focal"]
      },
      designSummary: "SpiralTrees carry the chorus lead."
    },
    sequenceArtisticGoal: {
      artifactType: "sequence_artistic_goal_v1",
      scope: { goalLevel: "section" },
      artisticIntent: {
        leadTarget: "SpiralTrees",
        sectionArc: "lift",
        motionCharacter: "steady_motion",
        densityCharacter: "moderate"
      }
    },
    sequenceRevisionObjective: {
      artifactType: "sequence_revision_objective_v1",
      ladderLevel: "section",
      scope: {
        nextOwner: "shared",
        revisionRoles: ["increase_section_contrast"]
      },
      designerDirection: {
        artisticCorrection: "Keep the chorus readable."
      },
      sequencerDirection: {
        executionObjective: "Use flowing spiral motion rather than a generic segmented fill."
      },
      successChecks: ["chorus reads clearly"]
    },
    sourceLines: [],
    baseRevision: "rev-58",
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Spirals", params: [] },
      { effectName: "Bars", params: [] },
      { effectName: "Shimmer", params: [] },
      { effectName: "Color Wash", params: [] }
    ])
  });

  assert.match(out.executionLines[0], /apply Spirals effect/i);
});

test("sequence_agent prefers direct spiral cue over generic shimmer fallback", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track S", artist: "Artist S" },
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 0, endMs: 1000, energy: "high", density: "medium" }
        ]
      }
    },
    intentHandoff: {
      goal: "Design a single Chorus 1 concept for SpiralTrees. Keep SpiralTrees as the lead read and use flowing spiral motion rather than a generic segmented fill.",
      mode: "revise",
      scope: {
        targetIds: ["SpiralTrees"],
        tagNames: [],
        sections: ["Chorus 1"]
      },
      executionStrategy: {
        sectionPlans: [
          {
            section: "Chorus 1",
            energy: "high",
            density: "medium",
            intentSummary: "flowing spiral motion rather than a generic segmented fill",
            targetIds: ["SpiralTrees"],
            effectHints: []
          }
        ]
      }
    },
    displayElements: [
      { id: "SpiralTrees", name: "SpiralTrees", type: "group", displayAs: "Tree", geometryProfile: "tree_360_spiral" }
    ],
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Spirals", params: [] },
      { effectName: "Shimmer", params: [] },
      { effectName: "Bars", params: [] },
      { effectName: "Color Wash", params: [] }
    ])
  });

  assert.equal(out.metadata.effectStrategy.seedRecommendations[0].effectName, "Spirals");
  assert.match(out.executionLines[0], /apply Spirals effect/i);
});

test("sequence_agent honors target effect avoidances when choosing inferred effects", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track C", artist: "Artist C" },
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 0, endMs: 1000, energy: "high", density: "medium" }
        ]
      }
    },
    intentHandoff: {
      goal: "Give the chorus a rhythmic pulse.",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      },
      executionStrategy: {
        sectionPlans: [
          {
            section: "Chorus 1",
            energy: "high",
            density: "medium",
            intentSummary: "rhythmic pulse",
            targetIds: ["MegaTree"],
            effectHints: []
          }
        ]
      }
    },
    metadataAssignments: [
      {
        targetId: "MegaTree",
        effectAvoidances: ["Bars"]
      }
    ],
    effectCatalog: sampleCatalog()
  });

  const combined = out.executionLines.join("\n");
  assert.match(combined, /Shimmer|Color Wash|On/);
  assert.doesNotMatch(combined, /\bBars\b/);
});

test("sequence_agent uses defined visual hint behavior text to steer fallback effect choice", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track B", artist: "Artist B" },
      structure: {
        sections: [
          { label: "Verse 1", startMs: 0, endMs: 1000, energy: "medium", density: "medium" }
        ]
      }
    },
    intentHandoff: {
      goal: "Keep this support prop readable.",
      mode: "revise",
      scope: {
        targetIds: ["CandyCane-01"],
        tagNames: [],
        sections: ["Verse 1"]
      },
      executionStrategy: {
        sectionPlans: [
          {
            section: "Verse 1",
            energy: "medium",
            density: "medium",
            intentSummary: "keep this support prop readable",
            targetIds: ["CandyCane-01"],
            effectHints: []
          }
        ]
      }
    },
    metadataAssignments: [
      {
        targetId: "CandyCane-01",
        visualHintDefinitions: [
          {
            name: "Beat-Sync",
            status: "defined",
            behavioralIntent: "Prefer this target when the design calls for visible pulse, hits, or rhythmic support."
          }
        ]
      }
    ],
    effectCatalog: sampleCatalog()
  });

  const combined = out.executionLines.join("\n");
  assert.match(combined, /\bBars\b/);
});

test("sequence_agent lets translation behavior outrank conflicting effect hints", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track D", artist: "Artist D" },
      structure: {
        sections: [
          { label: "Bridge", startMs: 0, endMs: 1000, energy: "medium", density: "medium" }
        ]
      }
    },
    intentHandoff: {
      goal: "Keep the bridge soft, restrained, and texture-led with a gentle handoff.",
      mode: "revise",
      scope: {
        targetIds: ["Spinners"],
        tagNames: [],
        sections: ["Bridge"]
      },
      executionStrategy: {
        translationIntent: {
          behaviorTargets: [
            {
              appliesTo: "section",
              section: "Bridge",
              behaviorSummary: "shimmer sparkling restrained gentle"
            }
          ]
        },
        sectionPlans: [
          {
            section: "Bridge",
            energy: "medium",
            density: "medium",
            intentSummary: "keep the bridge soft, restrained, and texture-led with a gentle handoff",
            targetIds: ["Spinners"],
            effectHints: ["Shockwave"]
          }
        ]
      },
      sequencingDesignHandoff: {
        sectionDirectives: [
          {
            sectionName: "Bridge",
            sectionPurpose: "bridge_reset",
            motionTarget: "restrained_motion",
            densityTarget: "moderate",
            transitionIntent: "hold",
            preferredVisualFamilies: ["soft_texture"]
          }
        ]
      }
    },
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Shimmer", params: [] },
      { effectName: "Twinkle", params: [] },
      { effectName: "Shockwave", params: [] },
      { effectName: "Color Wash", params: [] }
    ])
  });

  assert.equal(out.metadata.effectStrategy.seedRecommendations[0].effectName, "Shimmer");
  assert.match(out.executionLines[0], /apply Shimmer effect/i);
});

test("sequence_agent keeps alternate realization candidates alive before final selection", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track E", artist: "Artist E" },
      structure: {
        sections: [
          { label: "Bridge", startMs: 0, endMs: 1000, energy: "medium", density: "medium" }
        ]
      }
    },
    intentHandoff: {
      goal: "Keep the bridge soft, restrained, and texture-led.",
      mode: "revise",
      scope: {
        targetIds: ["Spinners"],
        tagNames: [],
        sections: ["Bridge"]
      },
      executionStrategy: {
        translationIntent: {
          behaviorTargets: [
            {
              appliesTo: "section",
              section: "Bridge",
              behaviorSummary: "soft texture restrained gentle sparkle"
            }
          ]
        },
        sectionPlans: [
          {
            section: "Bridge",
            energy: "medium",
            density: "medium",
            intentSummary: "keep the bridge soft, restrained, and texture-led",
            targetIds: ["Spinners"],
            effectHints: []
          }
        ]
      },
      sequencingDesignHandoff: {
        sectionDirectives: [
          {
            sectionName: "Bridge",
            sectionPurpose: "bridge_reset",
            motionTarget: "restrained_motion",
            densityTarget: "moderate",
            transitionIntent: "hold",
            preferredVisualFamilies: ["soft_texture"]
          }
        ]
      }
    },
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Twinkle", params: [] },
      { effectName: "Color Wash", params: [] }
    ])
  });

  assert.equal(out.metadata.effectStrategy.seedRecommendations[0].effectName, "Twinkle");
  assert.match(out.executionLines[0], /apply Twinkle effect/i);
});

test("sequence_agent does not demote On just because the prompt is warm", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track F", artist: "Artist F" },
      structure: {
        sections: [
          { label: "Outro", startMs: 0, endMs: 1000, energy: "low", density: "sparse" }
        ]
      }
    },
    intentHandoff: {
      goal: "Hold Snowman in a warm amber glow with minimal movement.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman"],
        tagNames: [],
        sections: ["Outro"]
      },
      executionStrategy: {
        translationIntent: {
          behaviorTargets: [
            {
              appliesTo: "section",
              section: "Outro",
              behaviorSummary: "warm amber glow steady hold minimal movement"
            }
          ]
        },
        sectionPlans: [
          {
            section: "Outro",
            energy: "low",
            density: "sparse",
            intentSummary: "hold snowman in a warm amber glow with minimal movement",
            targetIds: ["Snowman"],
            effectHints: []
          }
        ]
      },
      sequencingDesignHandoff: {
        sectionDirectives: [
          {
            sectionName: "Outro",
            sectionPurpose: "resolve",
            motionTarget: "restrained_motion",
            densityTarget: "sparse",
            transitionIntent: "hold",
            preferredVisualFamilies: ["static_fill"]
          }
        ]
      }
    },
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "On", params: [] },
      { effectName: "Color Wash", params: [] },
      { effectName: "Shimmer", params: [] }
    ])
  });

  assert.equal(out.metadata.effectStrategy.seedRecommendations[0].effectName, "On");
  assert.match(out.executionLines[0], /apply On effect in warm amber and gold tones/i);
});

test("sequence_agent clamps effect placement windows to sequence duration", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track B", artist: "Artist B" },
      structure: {
        sections: [
          { label: "Outro", startMs: 900, endMs: 1001, energy: "low", density: "sparse" }
        ]
      }
    },
    intentHandoff: {
      goal: "Hold Snowman steady in the outro.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman"],
        tagNames: [],
        sections: ["Outro"]
      },
      executionStrategy: {
        sectionPlans: [
          {
            section: "Outro",
            energy: "low",
            density: "sparse",
            intentSummary: "hold steady",
            targetIds: ["Snowman"],
            effectHints: ["Color Wash"]
          }
        ],
        effectPlacements: [
          {
            placementId: "placement-1",
            targetId: "Snowman",
            layerIndex: 0,
            effectName: "Color Wash",
            startMs: 900,
            endMs: 1001,
            timingContext: {
              trackName: "XD: Song Structure",
              anchorLabel: "Outro",
              alignmentMode: "section_span"
            }
          }
        ]
      }
    },
    baseRevision: "rev-56",
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    sequenceSettings: {
      durationMs: 1000
    }
  });

  const effectCreate = out.commands.find((row) => row.cmd === "effects.create");
  assert.equal(effectCreate.params.startMs, 900);
  assert.equal(effectCreate.params.endMs, 999);
  assert.equal(effectCreate.anchor.endMs, 999);
});

test("sequence_agent derives clamp duration from analyzed section windows when sequence settings omit it", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track C", artist: "Artist C" },
      structure: {
        sections: [
          { label: "Outro", startMs: 900, endMs: 1001, energy: "low", density: "sparse" }
        ]
      }
    },
    intentHandoff: {
      goal: "Hold Snowman steady in the outro.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman"],
        tagNames: [],
        sections: ["Outro"]
      },
      executionStrategy: {
        sectionPlans: [
          {
            section: "Outro",
            energy: "low",
            density: "sparse",
            intentSummary: "hold steady",
            targetIds: ["Snowman"],
            effectHints: ["Color Wash"]
          }
        ],
        effectPlacements: [
          {
            placementId: "placement-2",
            targetId: "Snowman",
            layerIndex: 0,
            effectName: "Color Wash",
            startMs: 900,
            endMs: 1001,
            timingContext: {
              trackName: "XD: Song Structure",
              anchorLabel: "Outro",
              alignmentMode: "section_span"
            }
          }
        ]
      }
    },
    baseRevision: "rev-57",
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    sequenceSettings: {}
  });

  const effectCreate = out.commands.find((row) => row.cmd === "effects.create");
  assert.equal(effectCreate.params.startMs, 900);
  assert.equal(effectCreate.params.endMs, 1000);
  assert.equal(effectCreate.anchor.endMs, 1000);
  assert.equal(out.metadata.sequenceSettings.durationMs, 1001);
});

test("sequence_agent uses analyzed section windows for scoped effect timing", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000 },
          { label: "Verse 1", startMs: 10000, endMs: 44000 },
          { label: "Chorus 1", startMs: 44000, endMs: 62000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Add a Color Wash effect on Snowman during Chorus 1.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Snowman / apply Color Wash effect for the requested duration using the current target timing"],
    effectCatalog: buildEffectDefinitionCatalog([{ effectName: "Color Wash", params: [] }])
  });

  const markInsert = out.commands.find((row) => row.cmd === "timing.insertMarks");
  const trackCreate = out.commands.find((row) => row.cmd === "timing.createTrack");
  const effectCreate = out.commands.find((row) => row.cmd === "effects.create");

  assert.equal(trackCreate.params.trackName, "XD: Song Structure");
  assert.deepEqual(markInsert.params.marks, [
    { startMs: 0, endMs: 10000, label: "Intro" },
    { startMs: 10000, endMs: 44000, label: "Verse 1" },
    { startMs: 44000, endMs: 61999, label: "Chorus 1" }
  ]);
  assert.equal(markInsert.params.trackName, "XD: Song Structure");
  assert.equal(effectCreate.params.startMs, 44000);
  assert.equal(effectCreate.params.endMs, 62000);
  assert.equal(effectCreate.anchor.markLabel, "Chorus 1");
});

test("sequence_agent writes all timing tracks referenced by placements into the sequence", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000 },
          { label: "Verse 1", startMs: 10000, endMs: 44000 },
          { label: "Chorus 1", startMs: 44000, endMs: 62000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Build a section-aware pass.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman", "Border-01"],
        tagNames: [],
        sections: ["Chorus 1"]
      },
      executionStrategy: {
        sectionPlans: [
          {
            designId: "design-1",
            section: "Chorus 1",
            energy: "high",
            density: "medium",
            intentSummary: "drive the chorus",
            targetIds: ["Snowman", "Border-01"],
            effectHints: []
          }
        ],
        effectPlacements: [
          {
            placementId: "placement-song-structure",
            designId: "design-1",
            targetId: "Snowman",
            layerIndex: 0,
            effectName: "Color Wash",
            startMs: 44000,
            endMs: 62000,
            timingContext: {
              trackName: "XD: Song Structure",
              anchorLabel: "Chorus 1",
              anchorStartMs: 44000,
              anchorEndMs: 62000,
              alignmentMode: "section_window"
            }
          },
          {
            placementId: "placement-beat-grid",
            designId: "design-1",
            targetId: "Border-01",
            layerIndex: 0,
            effectName: "Bars",
            startMs: 44000,
            endMs: 46000,
            timingContext: {
              trackName: "XD: Beat Grid",
              anchorLabel: "Beat 1",
              anchorStartMs: 44000,
              anchorEndMs: 46000,
              alignmentMode: "beat_window"
            }
          },
          {
            placementId: "placement-phrase-cues",
            designId: "design-1",
            targetId: "Border-01",
            layerIndex: 1,
            effectName: "Wave",
            startMs: 46000,
            endMs: 62000,
            timingContext: {
              trackName: "XD: Phrase Cues",
              anchorLabel: "Phrase A",
              anchorStartMs: 46000,
              anchorEndMs: 62000,
              alignmentMode: "phrase_window"
            }
          }
        ]
      }
    },
    sourceLines: ["General / Snowman, Border-01 / build a section-aware pass"],
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Color Wash", params: [] },
      { effectName: "Bars", params: [] },
      { effectName: "Wave", params: [] }
    ])
  });

  const createTrackCommands = out.commands.filter((row) => row.cmd === "timing.createTrack");
  const insertMarkCommands = out.commands.filter((row) => row.cmd === "timing.insertMarks");
  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");

  assert.deepEqual(
    createTrackCommands.map((row) => row.params.trackName).sort(),
    ["XD: Beat Grid", "XD: Phrase Cues", "XD: Song Structure"]
  );
  assert.deepEqual(
    insertMarkCommands.map((row) => row.params.trackName).sort(),
    ["XD: Beat Grid", "XD: Phrase Cues", "XD: Song Structure"]
  );

  const songStructureMarks = insertMarkCommands.find((row) => row.params.trackName === "XD: Song Structure");
  const beatGridMarks = insertMarkCommands.find((row) => row.params.trackName === "XD: Beat Grid");
  const phraseCueMarks = insertMarkCommands.find((row) => row.params.trackName === "XD: Phrase Cues");

  assert.deepEqual(songStructureMarks.params.marks, [
    { startMs: 0, endMs: 10000, label: "Intro" },
    { startMs: 10000, endMs: 44000, label: "Verse 1" },
    { startMs: 44000, endMs: 61999, label: "Chorus 1" }
  ]);
  assert.deepEqual(beatGridMarks.params.marks, [
    { startMs: 44000, endMs: 46000, label: "Beat 1" }
  ]);
  assert.deepEqual(phraseCueMarks.params.marks, [
    { startMs: 0, endMs: 46000, label: "" },
    { startMs: 46000, endMs: 61999, label: "Phrase A" }
  ]);

  const snowmanEffect = effectCommands.find((row) => row.params.modelName === "Snowman");
  const barsEffect = effectCommands.find((row) => row.params.effectName === "Bars");
  const waveEffect = effectCommands.find((row) => row.params.effectName === "Wave");

  assert.equal(snowmanEffect.anchor.trackName, "XD: Song Structure");
  assert.equal(barsEffect.anchor.trackName, "XD: Beat Grid");
  assert.equal(waveEffect.anchor.trackName, "XD: Phrase Cues");
  assert.ok(snowmanEffect.dependsOn.some((id) => id.includes("timing.marks.insert:xd-song-structure")));
  assert.ok(barsEffect.dependsOn.some((id) => id.includes("timing.marks.insert:xd-beat-grid")));
  assert.ok(waveEffect.dependsOn.some((id) => id.includes("timing.marks.insert:xd-phrase-cues")));
});

test("sequence_agent drops overlapping timing marks on non-structure cue tracks", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 44000, endMs: 62000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Build a cue-aware chorus pass.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman"],
        tagNames: [],
        sections: ["Chorus 1"]
      },
      executionStrategy: {
        sectionPlans: [
          {
            designId: "design-1",
            section: "Chorus 1",
            energy: "high",
            density: "medium",
            intentSummary: "drive the chorus",
            targetIds: ["Snowman"],
            effectHints: []
          }
        ],
        effectPlacements: [
          {
            placementId: "phrase-hold",
            designId: "design-1",
            targetId: "Snowman",
            layerIndex: 0,
            effectName: "Color Wash",
            startMs: 44000,
            endMs: 46000,
            timingContext: {
              trackName: "XD: Phrase Cues",
              anchorLabel: "Phrase Hold",
              anchorStartMs: 44000,
              anchorEndMs: 46000,
              alignmentMode: "phrase_window"
            }
          },
          {
            placementId: "phrase-release",
            designId: "design-1",
            targetId: "Snowman",
            layerIndex: 1,
            effectName: "Wave",
            startMs: 46000,
            endMs: 48000,
            timingContext: {
              trackName: "XD: Phrase Cues",
              anchorLabel: "Phrase Release",
              anchorStartMs: 46000,
              anchorEndMs: 48000,
              alignmentMode: "phrase_window"
            }
          },
          {
            placementId: "phrase-combined",
            designId: "design-1",
            targetId: "Snowman",
            layerIndex: 2,
            effectName: "Bars",
            startMs: 44000,
            endMs: 48000,
            timingContext: {
              trackName: "XD: Phrase Cues",
              anchorLabel: "Phrase Hold-Phrase Release",
              anchorStartMs: 44000,
              anchorEndMs: 48000,
              alignmentMode: "phrase_window"
            }
          }
        ]
      }
    },
    sourceLines: ["Chorus 1 / Snowman / build a cue-aware chorus pass"],
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Color Wash", params: [] },
      { effectName: "Wave", params: [] },
      { effectName: "Bars", params: [] }
    ])
  });

  const phraseCueMarks = out.commands.find(
    (row) => row.cmd === "timing.insertMarks" && row.params?.trackName === "XD: Phrase Cues"
  );

  assert.deepEqual(phraseCueMarks.params.marks, [
    { startMs: 0, endMs: 44000, label: "" },
    { startMs: 44000, endMs: 46000, label: "Phrase Hold" },
    { startMs: 46000, endMs: 48000, label: "Phrase Release" },
    { startMs: 48000, endMs: 61999, label: "" }
  ]);
});

test("sequence_agent writes complete cue tracks for scoped sections, not only referenced placement fragments", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 1000, endMs: 5000 },
          { label: "Chorus 1", startMs: 5000, endMs: 9000 }
        ]
      },
      timing: {
        beats: [
          { startMs: 5000, endMs: 5500, label: "1" },
          { startMs: 5500, endMs: 6000, label: "2" },
          { startMs: 6000, endMs: 6500, label: "3" },
          { startMs: 6500, endMs: 7000, label: "4" }
        ],
        bars: [
          { startMs: 5000, endMs: 7000, label: "Bar 1" },
          { startMs: 7000, endMs: 9000, label: "Bar 2" }
        ]
      },
      lyrics: {
        lines: [
          { startMs: 5000, endMs: 7000, label: "Phrase Hold" },
          { startMs: 7000, endMs: 9000, label: "Phrase Release" }
        ]
      }
    },
    intentHandoff: {
      goal: "Build a whole-sequence pass.",
      mode: "create",
      scope: {
        targetIds: ["Snowman"],
        tagNames: [],
        sections: []
      },
      executionStrategy: {
        passScope: "whole_sequence",
        primarySections: ["Verse 1", "Chorus 1"],
        effectPlacements: [
          {
            placementId: "phrase-fragment",
            designId: "design-1",
            targetId: "Snowman",
            layerIndex: 0,
            effectName: "Wave",
            startMs: 7000,
            endMs: 9000,
            timingContext: {
              trackName: "XD: Phrase Cues",
              anchorLabel: "Phrase Release",
              anchorStartMs: 7000,
              anchorEndMs: 9000,
              alignmentMode: "phrase_window"
            }
          }
        ]
      }
    },
    sourceLines: ["General / Snowman / whole-sequence pass"],
    sequenceSettings: {
      durationMs: 9000
    },
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Wave", params: [] }
    ])
  });

  const beatGridMarks = out.commands.find(
    (row) => row.cmd === "timing.insertMarks" && row.params?.trackName === "XD: Beat Grid"
  );
  const phraseCueMarks = out.commands.find(
    (row) => row.cmd === "timing.insertMarks" && row.params?.trackName === "XD: Phrase Cues"
  );

  assert.deepEqual(beatGridMarks.params.marks, [
    { startMs: 5000, endMs: 5500, label: "1" },
    { startMs: 5500, endMs: 6000, label: "2" },
    { startMs: 6000, endMs: 6500, label: "3" },
    { startMs: 6500, endMs: 7000, label: "4" }
  ]);
  assert.deepEqual(phraseCueMarks.params.marks, [
    { startMs: 0, endMs: 5000, label: "" },
    { startMs: 5000, endMs: 7000, label: "Phrase Hold" },
    { startMs: 7000, endMs: 8999, label: "Phrase Release" }
  ]);
});

test("sequence_agent allows decomposed multi-line direct requests", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000 },
          { label: "Chorus 1", startMs: 44000, endMs: 62000 },
          { label: "Chorus 2", startMs: 78000, endMs: 96000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Add a Color Wash effect on Snowman during Chorus 1 and a Shimmer effect on PorchTree during Chorus 2.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman", "PorchTree"],
        tagNames: [],
        sections: ["Chorus 1", "Chorus 2"]
      }
    },
    sourceLines: [
      "Chorus 1 / Snowman / apply Color Wash effect for the requested duration using the current target timing",
      "Chorus 2 / PorchTree / apply Shimmer effect for the requested duration using the current target timing"
    ],
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Color Wash", params: [] },
      { effectName: "Shimmer", params: [] }
    ])
  });

  assert.equal(out.validationReady, true);
  assert.equal(out.commands.some((row) => row.cmd === "effects.create" && row.params.effectName === "Color Wash"), true);
  assert.equal(out.commands.some((row) => row.cmd === "effects.create" && row.params.effectName === "Shimmer"), true);
});

test("sequence_agent enables model blending when layered group refinement needs it", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Refine a broad group bed with focal prop detail",
      mode: "revise",
      scope: {
        targetIds: ["Frontline", "MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Frontline / bars",
      "Chorus 1 / MegaTree / shimmer"
    ],
    baseRevision: "rev-57",
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "sequence.setSettings", "effects.create", "effects.alignToTiming"],
    effectCatalog: sampleCatalog(),
    sequenceSettings: { supportsModelBlending: false },
    groupIds: ["Frontline"],
    groupsById: sampleGroups()
  });

  const settingsCommand = out.commands.find((row) => row.cmd === "sequence.setSettings");
  assert.ok(settingsCommand);
  assert.equal(settingsCommand.params.supportsModelBlending, true);
});

test("sequence_agent falls back cleanly when effects.alignToTiming capability is unavailable", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse"],
    baseRevision: "rev-56",
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    effectCatalog: sampleCatalog()
  });

  assert.equal(out.validationReady, true);
  assert.equal(out.commands.some((row) => row.cmd === "effects.alignToTiming"), false);
  assert.ok(out.warnings.some((row) => /effects\.alignToTiming capability unavailable/i.test(String(row))));
});

test("sequence_agent emits reduced-confidence warning when analysis is missing", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: null,
    intentHandoff: sampleIntent(),
    sourceLines: []
  });
  assert.ok(out.warnings.some((w) => /reduced-confidence/i.test(String(w))));
  assert.equal(out.validationReady, true);
  assert.equal(out.metadata.degradedMode, true);
  assert.ok(out.executionLines.length > 0);
});

test("sequence_agent planning stages run in deterministic order", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse"]
  });
  assert.deepEqual(
    out.stageTelemetry.map((row) => row.stage),
    ["scope_resolution", "timing_asset_decision", "effect_strategy", "command_graph_synthesis"]
  );
  assert.equal(out.stageTelemetry.every((row) => row.status === "ok"), true);
});

test("sequence_agent produces deterministic stage outputs for same input", () => {
  const a = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse", "Chorus 1 / Roofline / mirror"]
  });
  const b = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse", "Chorus 1 / Roofline / mirror"]
  });
  assert.deepEqual(a.executionLines, b.executionLines);
  assert.deepEqual(a.metadata.stageOrder, b.metadata.stageOrder);
  assert.deepEqual(
    a.stageTelemetry.map((row) => ({ stage: row.stage, status: row.status })),
    b.stageTelemetry.map((row) => ({ stage: row.stage, status: row.status }))
  );
});

test("sequence_agent stage failure is classified and surfaced", () => {
  assert.throws(
    () =>
      buildSequenceAgentPlan({
        analysisHandoff: sampleAnalysis(),
        intentHandoff: sampleIntent(),
        sourceLines: [],
        stageOverrides: {
          effect_strategy: () => {
            throw new Error("forced-effect-failure");
          }
        }
      }),
    (err) => {
      assert.equal(err.stage, "effect_strategy");
      assert.equal(err.failureCategory, "strategy");
      assert.ok(Array.isArray(err.stageTelemetry));
      assert.equal(err.stageTelemetry.some((row) => row.stage === "effect_strategy" && row.status === "error"), true);
      return true;
    }
  );
});

test("sequence_agent fails closed on mixed direct sequencing clauses", () => {
  assert.throws(
    () =>
      buildSequenceAgentPlan({
        analysisHandoff: {
          trackIdentity: { title: "Track A", artist: "Artist A" },
          structure: { sections: ["Chorus 1", "Chorus 2"] },
          briefSeed: { tone: "upbeat" }
        },
        intentHandoff: {
          goal: "Add a Color Wash effect on Snowman during Chorus 1 and a Shimmer effect on PorchTree during Chorus 2.",
          mode: "revise",
          scope: {
            targetIds: ["PorchTree", "Snowman"],
            tagNames: [],
            sections: ["Chorus 1", "Chorus 2"]
          }
        },
        sourceLines: []
      }),
    (err) => {
      assert.equal(err.stage, "scope_resolution");
      assert.equal(err.failureCategory, "scope");
      assert.match(String(err.message || ""), /split into one effect\/section instruction per request/i);
      return true;
    }
  );
});

test("sequence_agent blocks plan synthesis when required capabilities are missing", () => {
  assert.throws(
    () =>
      buildSequenceAgentPlan({
        analysisHandoff: sampleAnalysis(),
        intentHandoff: sampleIntent(),
        sourceLines: ["Chorus 1 / MegaTree / pulse"],
        capabilityCommands: ["timing.createTrack"]
      }),
    (err) => {
      assert.equal(err.stage, "command_graph_synthesis");
      assert.equal(err.failureCategory, "capability");
      assert.match(String(err.message || ""), /Unsupported command capabilities/i);
      return true;
    }
  );
});

test("sequence_agent annotates layout mode and warns for 2d operation mode", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse"],
    layoutMode: "2d"
  });
  assert.equal(out.metadata.layoutMode, "2d");
  assert.ok(out.warnings.some((w) => /layout mode is 2d/i.test(String(w))));
});

test("sequence_agent keeps 3d mode without 2d warning", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / pulse"],
    layoutMode: "3d"
  });
  assert.equal(out.metadata.layoutMode, "3d");
  assert.equal(out.warnings.some((w) => /layout mode is 2d/i.test(String(w))), false);
});

test("sequence_agent maps mixed model/effect scenarios to validated templates", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: [
      "Chorus 1 / MegaTree / shimmer fade",
      "Chorus 1 / MegaTree / additive bars with brighter accents",
      "Chorus 1 / Roofline / hold steady glow"
    ],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.equal(out.validationReady, true);
  assert.equal(effectCommands.length, 3);
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.layerIndex, row.params.effectName]),
    [
      ["MegaTree", 0, "Shimmer"],
      ["MegaTree", 1, "Bars"],
      ["Roofline", 0, "On"]
    ]
  );
  assert.deepEqual(out.commands[1].dependsOn, ["timing.track.create"]);
  assert.deepEqual(effectCommands[0].dependsOn, ["timing.marks.insert"]);
});

test("sequence_agent continues XD timing writes even when prior manual ownership exists", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: sampleIntent(),
    sourceLines: ["Chorus 1 / MegaTree / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    timingOwnership: [{ sourceTrack: "XD: Sequencer Plan", manual: true, trackName: "Sequencer Plan" }]
  });

  assert.equal(out.commands.some((row) => row.cmd === "timing.createTrack"), true);
  assert.equal(out.commands.some((row) => row.cmd === "timing.insertMarks"), true);
  assert.equal(out.commands.some((row) => row.cmd === "effects.create"), true);
  assert.equal(out.warnings.some((w) => /user-owned\/manual/i.test(String(w))), false);
});

test("sequence_agent supports partial-scope apply planning", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Partial scope chorus touch-up",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / MegaTree / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  assert.equal(out.validationReady, true);
  assert.ok(out.commands.length > 0);
  assert.deepEqual(out.metadata.scope.sections, ["Chorus 1"]);
  assert.deepEqual(out.metadata.scope.targetIds, ["MegaTree"]);
});

test("sequence_agent remains timing-name agnostic when existing track names vary", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Zydeco Christmas 2014: Main Grid", "Note Onsets", "Beats"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Revise focal accents without assuming canonical timing names",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: [],
        sections: ["Zydeco Christmas 2014: Main Grid"]
      }
    },
    sourceLines: ["Zydeco Christmas 2014: Main Grid / MegaTree / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    timingOwnership: [
      { sourceTrack: "Backup", manual: false, trackName: "Backup" },
      { sourceTrack: "Note Onsets", manual: false, trackName: "Note Onsets" },
      { sourceTrack: "60000ms Metronome", manual: false, trackName: "60000ms Metronome" }
    ]
  });

  assert.equal(out.validationReady, true);
  assert.equal(out.commands.some((row) => row.cmd === "timing.createTrack"), true);
  assert.deepEqual(out.metadata.scope.sections, ["Zydeco Christmas 2014: Main Grid"]);
  assert.equal(out.warnings.some((w) => /beats track name/i.test(String(w))), false);
  assert.equal(out.warnings.some((w) => /lyrics track name/i.test(String(w))), false);
});

test("sequence_agent honors explicit section timing track names", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Build", startMs: 0, endMs: 10000 },
          { label: "Drop 2", startMs: 10000, endMs: 20000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Use the selected drop timing for this prop.",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: [],
        sections: ["Drop 2"]
      },
      executionStrategy: {
        passScope: "single_section",
        timingTrackName: "User Timing: Drops",
        sectionPlans: [
          { section: "Drop 2", targetIds: ["MegaTree"], intentSummary: "hit the drop" }
        ]
      }
    },
    sourceLines: ["Drop 2 / MegaTree / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create", "effects.alignToTiming"]
  });

  const trackCreate = out.commands.find((row) => row.cmd === "timing.createTrack");
  const markInsert = out.commands.find((row) => row.cmd === "timing.insertMarks");
  const effect = out.commands.find((row) => row.cmd === "effects.create");

  assert.equal(trackCreate.params.trackName, "User Timing: Drops");
  assert.equal(markInsert.params.trackName, "User Timing: Drops");
  assert.deepEqual(markInsert.params.marks, [
    { startMs: 0, endMs: 10000, label: "Build" },
    { startMs: 10000, endMs: 19999, label: "Drop 2" }
  ]);
  assert.equal(effect.anchor.trackName, "User Timing: Drops");
});

test("sequence_agent supports dense submodel-heavy targeting", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Chorus 1"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Drive face and hat submodels independently during chorus",
      mode: "revise",
      scope: {
        targetIds: ["Snowman Hat Beads", "Face1-Eyes", "Face2-Nose", "Face3-Mouth"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / shimmer fade"],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.equal(out.validationReady, true);
  assert.deepEqual(out.metadata.scope.targetIds, ["Snowman Hat Beads", "Face1-Eyes", "Face2-Nose", "Face3-Mouth"]);
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    ["Snowman Hat Beads", "Face1-Eyes", "Face2-Nose", "Face3-Mouth"]
  );
});

test("sequence_agent collapses same-line parent and submodel overlap to the parent target", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Apply broad parent-level coverage without duplicating child overlap",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "MegaTree/Star", "Roofline/Left"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree", "Roofline/Left"]);
});

test("sequence_agent preserves explicit parent then submodel refinement on separate lines", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Lay broad model coverage then refine a child submodel",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "MegaTree/Star"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / MegaTree / bars",
      "Chorus 1 / MegaTree/Star / shimmer fade"
    ],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["MegaTree", "Bars"],
      ["MegaTree/Star", "Shimmer"]
    ]
  );
});

test("sequence_agent preserves submodel precision when same-line submodel uses non-default buffer style", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep precision when the submodel uses a materially different local buffer style",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "MegaTree/KeepXY", "Roofline/Left"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/KeepXY", "Roofline/Left"]);
  assert.ok(
    out.warnings.some((row) => /Preserving submodel target MegaTree\/KeepXY/.test(String(row))),
    "expected submodel precision preservation warning"
  );
});

test("sequence_agent preserves submodel precision when same-line submodel uses subbuffer semantics", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep precision when the submodel uses subbuffer semantics",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "MegaTree/SubBuffer", "Roofline/Left"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/SubBuffer", "Roofline/Left"]);
  assert.ok(
    out.warnings.some((row) => /Preserving submodel target MegaTree\/SubBuffer/.test(String(row))),
    "expected submodel precision preservation warning"
  );
});

test("sequence_agent collapses same-line overlapping sibling submodels to first explicit target", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Avoid duplicate broad writes across overlapping sibling submodels",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree/Star", "MegaTree/TopHalf", "Roofline/Left"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["MegaTree/Star", "Roofline/Left"]);
});

test("sequence_agent preserves non-overlapping sibling submodels on same line", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep non-overlapping sibling submodels available as concurrent precision targets",
      mode: "revise",
      scope: {
        targetIds: ["Roofline/Left", "Roofline/Right"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    submodelsById: sampleSubmodels(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Roofline/Left", "Roofline/Right"]);
});

test("sequence_agent preserves group-first then specific-target ordering", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Chorus 1"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Lay broad coverage on the group and refine focal props below it",
      mode: "revise",
      scope: {
        targetIds: ["AllModels", "MegaTree", "Roofline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Whole Show / bars",
      "Chorus 1 / MegaTree / shimmer fade",
      "Chorus 1 / Roofline / hold steady glow"
    ],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.equal(out.validationReady, true);
  assert.deepEqual(out.metadata.scope.targetIds, ["AllModels", "MegaTree", "Roofline"]);
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["AllModels", "Bars"],
      ["MegaTree", "Shimmer"],
      ["Roofline", "On"]
    ]
  );
});

test("sequence_agent emits explicit display-element ordering plan for group-first sequencing", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Chorus 1"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Keep broad group coverage above focused props in display order",
      mode: "revise",
      scope: {
        targetIds: ["AllModels", "MegaTree", "Roofline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Whole Show / bars",
      "Chorus 1 / MegaTree / shimmer fade",
      "Chorus 1 / Roofline / hold steady glow"
    ],
    displayElements: [
      { id: "Lyrics", type: "timing" },
      { id: "Roofline", type: "model" },
      { id: "MegaTree", type: "model" },
      { id: "AllModels", type: "model" }
    ],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "sequence.setSettings", "effects.create", "sequencer.setDisplayElementOrder"]
  });

  const reorder = out.commands.find((row) => row.cmd === "sequencer.setDisplayElementOrder");
  assert.ok(reorder);
  assert.deepEqual(
    reorder.params.orderedIds,
    ["Lyrics", "XD: Song Structure", "AllModels", "MegaTree", "Roofline"]
  );
  assert.equal(out.metadata.displayElementCount, 4);
});

test("sequence_agent uses explicit xlights group ids for group-first planning", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: { sections: ["Chorus 1"] },
      briefSeed: { tone: "upbeat" }
    },
    intentHandoff: {
      goal: "Keep frontline group coverage above focal props",
      mode: "revise",
      scope: {
        targetIds: ["Frontline", "MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Whole Show / bars",
      "Chorus 1 / MegaTree / shimmer fade"
    ],
    displayElements: [
      { id: "Beats", type: "timing" },
      { id: "MegaTree", type: "model" },
      { id: "Frontline", type: "model" }
    ],
    groupIds: ["Frontline"],
    groupsById: {
      Frontline: {
        members: {
          direct: [{ id: "MegaTree", name: "MegaTree" }],
          flattenedAll: [{ id: "MegaTree", name: "MegaTree" }]
        }
      }
    },
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "sequence.setSettings", "effects.create", "sequencer.setDisplayElementOrder"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["Frontline", "Bars"],
      ["MegaTree", "Shimmer"]
    ]
  );
  assert.equal(out.metadata.groupCount, 1);
});

test("sequence_agent prefers the broadest explicit group target when nested groups are in scope", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Start with broad all-model coverage, then refine inside nested groups",
      mode: "revise",
      scope: {
        targetIds: ["Frontline", "AllModels", "MegaTree"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / Whole Show / bars",
      "Chorus 1 / MegaTree / shimmer fade"
    ],
    displayElements: [
      { id: "Beats", type: "timing" },
      { id: "MegaTree", type: "model" },
      { id: "Frontline", type: "model" },
      { id: "AllModels", type: "model" }
    ],
    groupIds: ["Frontline", "AllModels"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "sequence.setSettings", "effects.create", "sequencer.setDisplayElementOrder"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.effectName]),
    [
      ["AllModels", "Bars"],
      ["MegaTree", "Shimmer"]
    ]
  );

  const reorder = out.commands.find((row) => row.cmd === "sequencer.setDisplayElementOrder");
  assert.ok(reorder);
  assert.deepEqual(
    reorder.params.orderedIds,
    ["Beats", "XD: Song Structure", "AllModels", "Frontline", "MegaTree"]
  );
  assert.equal(out.metadata.groupGraphCount, 6);
});

test("sequence_agent prefers non-default group render targets when explicit scope is otherwise comparable", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Use the stronger group render target for broad coverage",
      mode: "revise",
      scope: {
        targetIds: ["FrontlineDefault", "Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Whole Show / bars"],
    groupIds: ["FrontlineDefault", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Frontline"]);
});

test("sequence_agent preserves explicit group targets unless per-member distribution is requested", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep the frontline group as a single render target",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Frontline"]);
});

test("sequence_agent expands direct group members when per-member distribution is explicitly requested", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute the frontline group across its member props",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars per member stagger members with brighter accents"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 500],
      ["Roofline", 500, 1000]
    ]
  );
});

test("sequence_agent preserves non-default group render targets for soft distribution phrases and warns", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep the frontline render semantics intact unless expansion is explicit",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars stagger members"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["Frontline"]);
  assert.equal(
    out.warnings.some((w) => /Preserving group render target Frontline \(Horizontal Per Model\)/i.test(String(w))),
    true
  );
});

test("sequence_agent only expands non-default group render targets with explicit member override", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute the frontline group across member props explicitly",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars per member stagger members"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 500],
      ["Roofline", 500, 1000]
    ]
  );
  assert.equal(out.warnings.some((w) => /explicit member override required/i.test(String(w))), false);
});

test("sequence_agent preserves high-risk overlay group render targets without force override and warns", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep overlay group render semantics intact unless expansion is forced",
      mode: "revise",
      scope: {
        targetIds: ["NestedFrontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / NestedFrontline / bars per member stagger members"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["NestedFrontline"]);
  assert.equal(
    out.warnings.some((w) => /Preserving high-risk group render target NestedFrontline \(Overlay - Centered\)/i.test(String(w))),
    true
  );
});

test("sequence_agent infers high-risk policy from buffer-style metadata even when category is default", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep overlay semantics inferred from buffer style intact unless expansion is forced",
      mode: "revise",
      scope: {
        targetIds: ["StyleOnlyOverlay"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / StyleOnlyOverlay / bars per member stagger members"],
    groupIds: ["StyleOnlyOverlay"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["StyleOnlyOverlay"]);
  assert.equal(
    out.warnings.some((w) => /Preserving high-risk group render target StyleOnlyOverlay \(Overlay - Scaled\)/i.test(String(w))),
    true
  );
});

test("sequence_agent only expands high-risk overlay group render targets with force override", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute across all nested members only when explicitly forced",
      mode: "revise",
      scope: {
        targetIds: ["NestedFrontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / NestedFrontline / bars force member expansion flatten members and stagger members"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 333],
      ["Roofline", 333, 666],
      ["WindowLeft", 666, 1000]
    ]
  );
  assert.equal(out.warnings.some((w) => /force member override required/i.test(String(w))), false);
});

test("sequence_agent preserves high-risk per-model-strand group render targets without force override and warns", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Keep per-model-strand render semantics intact unless expansion is forced",
      mode: "revise",
      scope: {
        targetIds: ["PixelSpokes"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / PixelSpokes / bars per member stagger members"],
    groupIds: ["PixelSpokes"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(effectCommands.map((row) => row.params.modelName), ["PixelSpokes"]);
  assert.equal(
    out.warnings.some((w) => /Preserving high-risk group render target PixelSpokes \(Per Model Vertical Per Strand\)/i.test(String(w))),
    true
  );
});

test("sequence_agent only expands high-risk per-model-strand group render targets with force override", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute across direct members only when explicitly forced",
      mode: "revise",
      scope: {
        targetIds: ["PixelSpokes"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / PixelSpokes / bars force member expansion direct members and stagger members"],
    groupIds: ["PixelSpokes"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["Spoke1", 0, 500],
      ["Spoke2", 500, 1000]
    ]
  );
  assert.equal(out.warnings.some((w) => /force member override required/i.test(String(w))), false);
});

test("sequence_agent mirrors direct group member order when explicitly requested", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Reverse the frontline member order while distributing accents",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / Frontline / bars per member mirror members and stagger members"],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["Roofline", 0, 500],
      ["MegaTree", 500, 1000]
    ]
  );
});

test("sequence_agent expands flattened nested-group members when explicitly requested", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Distribute across all nested members of the grouped frontage",
      mode: "revise",
      scope: {
        targetIds: ["NestedFrontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: ["Chorus 1 / NestedFrontline / bars flatten members and stagger members"],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 333],
      ["Roofline", 333, 666],
      ["WindowLeft", 666, 1000]
    ]
  );
});

test("sequence_agent alternates distributed member order across repeated lines", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Repeat distributed member accents without replaying identical order",
      mode: "revise",
      scope: {
        targetIds: ["Frontline"],
        tagNames: [],
        sections: ["Chorus 1", "Chorus 2"]
      }
    },
    sourceLines: [
      "Chorus 1 / Frontline / bars per member stagger members",
      "Chorus 1 / Frontline / bars per member stagger members"
    ],
    groupIds: ["Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => [row.params.modelName, row.params.startMs, row.params.endMs]),
    [
      ["MegaTree", 0, 500],
      ["Roofline", 500, 1000],
      ["Roofline", 0, 500],
      ["MegaTree", 500, 1000]
    ]
  );
});

test("sequence_agent rotates fanout member order across repeated lines", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysis(),
    intentHandoff: {
      goal: "Fan out a nested group across repeated lines without repeating member order",
      mode: "revise",
      scope: {
        targetIds: ["NestedFrontline"],
        tagNames: [],
        sections: ["Chorus 1"]
      }
    },
    sourceLines: [
      "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members",
      "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members",
      "Chorus 1 / NestedFrontline / bars fan out members flatten members and stagger members"
    ],
    groupIds: ["NestedFrontline", "Frontline"],
    groupsById: sampleGroups(),
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.deepEqual(
    effectCommands.map((row) => row.params.modelName),
    [
      "MegaTree", "Roofline", "WindowLeft",
      "Roofline", "WindowLeft", "MegaTree",
      "WindowLeft", "MegaTree", "Roofline"
    ]
  );
});

test("sequence_agent honors designer whole-sequence execution strategy over narrow scope sections", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000 },
          { label: "Verse 1", startMs: 10000, endMs: 30000 },
          { label: "Chorus 1", startMs: 30000, endMs: 50000 },
          { label: "Bridge", startMs: 50000, endMs: 70000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Rework the whole show into a warmer, more cinematic pass.",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: ["focal"],
        sections: ["Chorus 1"]
      },
      executionStrategy: {
        passScope: "whole_sequence",
        implementationMode: "whole_sequence_pass",
        routePreference: "designer_to_sequence_agent",
        shouldUseFullSongStructureTrack: true,
        sectionCount: 4,
        primarySections: ["Intro", "Verse 1", "Chorus 1", "Bridge"],
        sectionPlans: [
          { section: "Intro", intentSummary: "keep the pass restrained", targetIds: ["MegaTree"] },
          { section: "Verse 1", intentSummary: "develop warmth and motion", targetIds: ["MegaTree"] },
          { section: "Chorus 1", intentSummary: "build stronger visual payoff", targetIds: ["MegaTree"] },
          { section: "Bridge", intentSummary: "open the picture wider", targetIds: ["MegaTree"] }
        ]
      }
    },
    sourceLines: ["General / MegaTree / build stronger visual payoff with a warmer cinematic arc"],
    effectCatalog: sampleCatalog()
  });

  const trackCreate = out.commands.find((row) => row.cmd === "timing.createTrack");
  const markInsert = out.commands.find((row) => row.cmd === "timing.insertMarks");

  assert.equal(trackCreate.params.trackName, "XD: Song Structure");
  assert.deepEqual(out.metadata.scope.sections, ["Intro", "Verse 1", "Chorus 1", "Bridge"]);
  assert.equal(out.metadata.executionStrategy.passScope, "whole_sequence");
  assert.equal(out.metadata.executionStrategy.implementationMode, "whole_sequence_pass");
  assert.deepEqual(markInsert.params.marks, [
    { startMs: 0, endMs: 10000, label: "Intro" },
    { startMs: 10000, endMs: 30000, label: "Verse 1" },
    { startMs: 30000, endMs: 50000, label: "Chorus 1" },
    { startMs: 50000, endMs: 69999, label: "Bridge" }
  ]);
});

test("sequence_agent synthesizes execution lines from designer section plans when explicit lines are absent", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000 },
          { label: "Chorus 1", startMs: 30000, endMs: 50000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Build a broader cinematic pass.",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: [],
        sections: []
      },
      executionStrategy: {
        passScope: "multi_section",
        implementationMode: "section_pass",
        routePreference: "designer_to_sequence_agent",
        shouldUseFullSongStructureTrack: true,
        sectionCount: 2,
        primarySections: ["Intro", "Chorus 1"],
        sectionPlans: [
          { section: "Intro", intentSummary: "keep the pass restrained", targetIds: ["MegaTree"] },
          { section: "Chorus 1", intentSummary: "build stronger visual payoff", targetIds: ["MegaTree"] }
        ]
      }
    },
    sourceLines: [],
    effectCatalog: sampleCatalog(),
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"]
  });

  assert.equal(out.executionLines.length, 2);
  assert.equal(out.executionLines[0], "Intro / MegaTree / apply Color Wash effect for the requested duration using the current target timing");
  assert.match(out.executionLines[1], /^Chorus 1 \/ MegaTree \/ apply (Color Wash|Shimmer) effect for the requested duration using the current target timing$/);
  assert.deepEqual(out.metadata.scope.sections, ["Intro", "Chorus 1"]);
  assert.equal(out.metadata.executionStrategy.passScope, "multi_section");
  assert.equal(out.commands.some((row) => row.cmd === "effects.create"), true);
});

test("sequence_agent turns designer whole-sequence section plans into effect commands", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000 },
          { label: "Chorus 1", startMs: 44000, endMs: 62000 },
          { label: "Bridge", startMs: 90000, endMs: 108000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Rework the whole show into a warmer, more cinematic pass.",
      mode: "revise",
      scope: {
        targetIds: [],
        tagNames: [],
        sections: ["all"]
      },
      executionStrategy: {
        passScope: "whole_sequence",
        implementationMode: "whole_sequence_pass",
        shouldUseFullSongStructureTrack: true,
        primarySections: ["Intro", "Chorus 1", "Bridge"],
        sectionPlans: [
          {
            section: "Intro",
            energy: "low",
            density: "sparse",
            intentSummary: "keep the pass restrained with warm cinematic color and glow control",
            targetIds: ["AllModels", "AllModels_NoFloods"],
            effectHints: []
          },
          {
            section: "Chorus 1",
            energy: "high",
            density: "dense",
            intentSummary: "build stronger visual payoff with warm cinematic color and glow control",
            targetIds: ["AllModels", "Snowman", "PorchTree"],
            effectHints: []
          },
          {
            section: "Bridge",
            energy: "medium",
            density: "wide",
            intentSummary: "widen the picture with smoother transitions and controlled contrast lift",
            targetIds: ["AllModels", "Star"],
            effectHints: []
          }
        ]
      }
    },
    sourceLines: [],
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create", "effects.alignToTiming"],
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Color Wash", params: [] },
      { effectName: "Shimmer", params: [] },
      { effectName: "Bars", params: [] }
    ])
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.ok(effectCommands.length >= 3);
  assert.equal(effectCommands.some((row) => row.params.modelName === "AllModels" && row.params.effectName === "Color Wash"), true);
  assert.equal(effectCommands.some((row) => row.params.modelName === "Snowman"), true);
  assert.equal(effectCommands.some((row) => row.params.modelName === "Star"), true);
});

test("sequence_agent honors explicit effect placements over section-level inference", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 30000, endMs: 50000 },
          { label: "Bridge", startMs: 50000, endMs: 70000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Apply exact designer-authored placements.",
      mode: "revise",
      scope: {
        targetIds: ["MegaTree", "Roofline"],
        tagNames: [],
        sections: ["Chorus 1", "Bridge"]
      },
      executionStrategy: {
        passScope: "multi_section",
        implementationMode: "section_pass",
        routePreference: "designer_to_sequence_agent",
        shouldUseFullSongStructureTrack: true,
        primarySections: ["Chorus 1", "Bridge"],
        effectPlacements: [
          {
            placementId: "p1",
            designId: "DES-001",
            designAuthor: "designer",
            targetId: "MegaTree",
            layerIndex: 1,
            effectName: "Shimmer",
            startMs: 32000,
            endMs: 36500,
            timingContext: {
              trackName: "XD: Song Structure",
              anchorLabel: "Chorus 1",
              anchorStartMs: 30000,
              anchorEndMs: 50000,
              alignmentMode: "within_section"
            },
            settings: {
              C_SLIDER_Brightness: 125
            },
            settingsIntent: {
              intensity: "high"
            },
            layerIntent: {
              priority: "foreground",
              blendRole: "accent_overlay",
              mixAmount: "medium"
            }
          },
          {
            placementId: "p2",
            designId: "DES-002",
            designAuthor: "designer",
            targetId: "Roofline",
            layerIndex: 0,
            effectName: "Bars",
            startMs: 54000,
            endMs: 61000,
            timingContext: {
              trackName: "XD: Song Structure",
              anchorLabel: "Bridge",
              anchorStartMs: 50000,
              anchorEndMs: 70000,
              alignmentMode: "within_section"
            },
            palette: {
              C_BUTTON_Palette1: "#ffd39b"
            },
            settingsIntent: {
              motion: "rhythmic",
              direction: "forward",
              thickness: "medium"
            },
            renderIntent: {
              groupPolicy: "preserve_group_rendering",
              bufferStyle: "overlay"
            }
          }
        ]
      }
    },
    sourceLines: [],
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create"],
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Shimmer", params: [] },
      { effectName: "Bars", params: [] }
    ])
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.equal(effectCommands.length, 2);
  assert.deepEqual(
    effectCommands.map((row) => ({
      modelName: row.params.modelName,
      layerIndex: row.params.layerIndex,
      effectName: row.params.effectName,
      startMs: row.params.startMs,
      endMs: row.params.endMs
    })),
    [
      {
        modelName: "MegaTree",
        layerIndex: 1,
        effectName: "Shimmer",
        startMs: 32000,
        endMs: 36500
      },
      {
        modelName: "Roofline",
        layerIndex: 0,
        effectName: "Bars",
        startMs: 54000,
        endMs: 61000
      }
    ]
  );
  assert.equal(effectCommands[0].intent.settingsIntent.intensity, "high");
  assert.equal(effectCommands[0].designId, "DES-001");
  assert.equal(effectCommands[0].designRevision, 0);
  assert.equal(effectCommands[0].designAuthor, "designer");
  assert.equal(effectCommands[0].intent.designId, "DES-001");
  assert.equal(effectCommands[0].intent.designRevision, 0);
  assert.equal(effectCommands[0].intent.designAuthor, "designer");
  assert.equal(effectCommands[0].intent.layerIntent.priority, "foreground");
  assert.equal(effectCommands[1].designId, "DES-002");
  assert.equal(effectCommands[1].designRevision, 0);
  assert.equal(effectCommands[1].designAuthor, "designer");
  assert.equal(effectCommands[1].intent.designId, "DES-002");
  assert.equal(effectCommands[1].intent.designRevision, 0);
  assert.equal(effectCommands[1].intent.designAuthor, "designer");
  assert.equal(effectCommands[1].intent.renderIntent.groupPolicy, "preserve_group_rendering");
  assert.equal(effectCommands[0].params.settings.C_SLIDER_Brightness, 125);
  assert.equal(effectCommands[0].params.settings.T_CHOICE_LayerMethod, "Highlight");
  assert.equal(effectCommands[0].params.settings.T_SLIDER_EffectLayerMix, 60);
  assert.equal(effectCommands[1].params.settings.T_CHOICE_In_Transition_Type, "Slide Bars");
  assert.equal(effectCommands[1].params.settings.B_CHOICE_BufferStyle, "Overlay - Scaled");
  assert.equal(out.metadata.effectPlacementCount, 2);
  assert.deepEqual(out.metadata.designIds, ["DES-001", "DES-002"]);
  const markInsert = out.commands.find((row) => row.cmd === "timing.insertMarks");
  assert.deepEqual(markInsert.params.marks, [
    { label: "", startMs: 0, endMs: 30000 },
    { label: "Chorus 1", startMs: 30000, endMs: 50000 },
    { label: "Bridge", startMs: 50000, endMs: 69999 }
  ]);
});

test("sequence_agent decorates direct synthesized commands with user design metadata", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Section 1", startMs: 0, endMs: 10000 },
          { label: "Section 2", startMs: 10000, endMs: 20000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Add a Color Wash effect on Snowman during Chorus 1.",
      mode: "revise",
      scope: {
        targetIds: ["Snowman"],
        tagNames: [],
        sections: ["Section 1", "Section 2"]
      },
      executionStrategy: {
        passScope: "multi_section",
        implementationMode: "section_pass",
        routePreference: "designer_to_sequence_agent",
        shouldUseFullSongStructureTrack: true,
        primarySections: ["Section 1", "Section 2"],
        sectionPlans: [
          {
            designId: "DES-USER-001",
            designAuthor: "user",
            section: "Section 1",
            intentSummary: "User-directed sequence change.",
            targetIds: ["Snowman"],
            effectHints: ["Color Wash"]
          },
          {
            designId: "DES-USER-001",
            designAuthor: "user",
            section: "Section 2",
            intentSummary: "User-directed sequence change.",
            targetIds: ["Snowman"],
            effectHints: ["Color Wash"]
          }
        ],
        effectPlacements: []
      }
    },
    sourceLines: [
      "Section 1 / Snowman / apply Color Wash effect for the requested duration using the current target timing"
    ],
    effectCatalog: buildEffectDefinitionCatalog([{ effectName: "Color Wash", params: [] }])
  });

  const effectCommands = out.commands.filter((row) => row.cmd === "effects.create");
  assert.ok(effectCommands.length >= 1);
  for (const command of effectCommands) {
    assert.equal(command.designId, "DES-USER-001");
    assert.equal(command.designRevision, 0);
    assert.equal(command.designAuthor, "user");
    assert.equal(command.intent.designId, "DES-USER-001");
    assert.equal(command.intent.designRevision, 0);
    assert.equal(command.intent.designAuthor, "user");
  }
});

test("sequence_agent prefers synthesized effect lines over non-executable designer prose lines", () => {
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Section 1", startMs: 0, endMs: 10000 },
          { label: "Section 2", startMs: 10000, endMs: 20000 }
        ]
      }
    },
    intentHandoff: {
      goal: "Create a broad cinematic warm pass.",
      mode: "revise",
      scope: { targetIds: [], tagNames: [], sections: ["all"] },
      executionStrategy: {
        passScope: "whole_sequence",
        implementationMode: "whole_sequence_pass",
        shouldUseFullSongStructureTrack: true,
        primarySections: ["Section 1", "Section 2"],
        sectionPlans: [
          {
            section: "Section 1",
            energy: "low",
            density: "sparse",
            intentSummary: "keep the pass restrained with warm cinematic color and glow control",
            targetIds: ["AllModels"],
            effectHints: []
          },
          {
            section: "Section 2",
            energy: "high",
            density: "dense",
            intentSummary: "build stronger visual payoff with warm cinematic color and glow control",
            targetIds: ["Snowman"],
            effectHints: []
          }
        ]
      }
    },
    sourceLines: [
      "Section 1 / General / keep the pass restrained with warm cinematic color and glow control",
      "Section 2 / General / build stronger visual payoff with warm cinematic color and glow control"
    ],
    capabilityCommands: ["timing.createTrack", "timing.insertMarks", "effects.create", "effects.alignToTiming"],
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Color Wash", params: [] },
      { effectName: "Shimmer", params: [] }
    ])
  });

  assert.equal(out.executionLines.length, 2);
  assert.equal(out.executionLines[0], "Section 1 / AllModels / apply Color Wash effect in warm amber and gold tones for the requested duration using the current target timing");
  assert.match(out.executionLines[1], /^Section 2 \/ Snowman \/ apply (Color Wash|Shimmer) effect in warm amber and gold tones for the requested duration using the current target timing$/);
  assert.equal(out.commands.some((row) => row.cmd === "effects.create" && row.params.modelName === "AllModels"), true);
  assert.equal(out.commands.some((row) => row.cmd === "effects.create" && row.params.modelName === "Snowman"), true);
});
