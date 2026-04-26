import test from "node:test";
import assert from "node:assert/strict";

import {
  DESIGNER_DIALOG_ROLE,
  DESIGNER_DIALOG_CONTRACT_VERSION,
  validateDesignerDialogInput,
  validateCreativeBrief,
  validateProposalBundle,
  validateDesignerDialogResult,
  buildCreativeBriefContract,
  buildIntentHandoffFromDesignerState,
  validateDesignerDialogContractGate
} from "../../../agent/designer-dialog/designer-dialog-contracts.js";
import { buildVisualDesignAssetPack } from "../../../agent/designer-dialog/visual-design-assets.js";

function sampleInput(overrides = {}) {
  return {
    agentRole: DESIGNER_DIALOG_ROLE,
    contractVersion: DESIGNER_DIALOG_CONTRACT_VERSION,
    requestId: "req-1",
    context: {
      sequenceRevision: "rev-1",
      route: "design",
      selection: {
        sectionNames: ["Chorus 1"],
        targetIds: ["MegaTree"],
        tagNames: ["focal"]
      }
    },
    promptText: "Make chorus bigger and cleaner",
    ...overrides
  };
}

function sampleBrief(overrides = {}) {
  return {
    artifactId: "creative_brief_v1-12345678",
    createdAt: new Date().toISOString(),
    briefType: "creative_brief_v1",
    briefVersion: DESIGNER_DIALOG_CONTRACT_VERSION,
    summary: "Punchy chorus with clean focal contrast.",
    goalsSummary: "Increase chorus impact.",
    inspirationSummary: "Modern crisp holiday pop.",
    sections: ["Intro", "Verse", "Chorus"],
    moodEnergyArc: "Start readable, escalate at chorus, resolve cleanly.",
    narrativeCues: "Support lyric emphasis in chorus.",
    visualCues: "Cool white sparkle accents with strong focal contrast.",
    hypotheses: ["Use focal-target contrast.", "Preserve readable supporting layers."],
    notes: ""
  };
}

function sampleProposal(overrides = {}) {
  return {
    artifactId: "proposal_bundle_v1-12345678",
    createdAt: new Date().toISOString(),
    bundleType: "proposal_bundle_v1",
    bundleVersion: DESIGNER_DIALOG_CONTRACT_VERSION,
    proposalId: "proposal-1",
    summary: "Increase chorus impact on focal props.",
    baseRevision: "rev-1",
    scope: {
      sections: ["Chorus 1"],
      targetIds: ["MegaTree"],
      tagNames: ["focal"]
    },
    constraints: {
      changeTolerance: "medium",
      preserveTimingTracks: true,
      allowGlobalRewrite: false
    },
    lifecycle: {
      status: "fresh",
      stale: false,
      baseRevision: "rev-1",
      currentRevision: "rev-1",
      rebasedFrom: null,
      staleReason: "",
      updatedAt: new Date().toISOString()
    },
    proposalLines: ["Chorus 1 / MegaTree / increase pulse contrast and cleaner accents."],
    guidedQuestions: [],
    assumptions: [],
    riskNotes: [],
    impact: {
      estimatedImpact: 12
    },
    ...overrides
  };
}

function sampleResult(overrides = {}) {
  return {
    agentRole: DESIGNER_DIALOG_ROLE,
    contractVersion: DESIGNER_DIALOG_CONTRACT_VERSION,
    requestId: "req-1",
    status: "ok",
    failureReason: null,
    creativeBrief: sampleBrief(),
    proposalBundle: sampleProposal(),
    handoff: buildIntentHandoffFromDesignerState({
      requestId: "req-1",
      normalizedIntent: {
        goal: "Make chorus bigger and cleaner",
        sections: ["Chorus 1"],
        targetIds: ["MegaTree"],
        tags: ["focal"],
        tempoIntent: "increase",
        preserveTimingTracks: true
      },
      intentText: "Make chorus bigger and cleaner",
      creativeBrief: {
        mood: "punchy",
        paletteIntent: "cool white"
      },
      resolvedTargetIds: ["MegaTree"],
      executionStrategy: {
        sectionPlans: [
          {
            section: "Chorus 1",
            energy: "high",
            density: "dense",
            intentSummary: "Make chorus bigger and cleaner",
            targetIds: ["MegaTree"]
          }
        ]
      },
      elevatedRiskConfirmed: false
    }),
    warnings: [],
    summary: "Designer proposal prepared.",
    ...overrides
  };
}

test("designer dialog input contract accepts canonical payload", () => {
  const errors = validateDesignerDialogInput(sampleInput());
  assert.deepEqual(errors, []);
});

test("creative brief contract accepts canonical payload", () => {
  const errors = validateCreativeBrief(sampleBrief());
  assert.deepEqual(errors, []);
});

test("proposal bundle contract accepts canonical payload", () => {
  const errors = validateProposalBundle(sampleProposal());
  assert.deepEqual(errors, []);
});

test("proposal bundle contract accepts optional execution plan", () => {
  const errors = validateProposalBundle(sampleProposal({
    executionPlan: {
      passScope: "whole_sequence",
      implementationMode: "whole_sequence_pass",
      routePreference: "designer_to_sequence_agent",
      sectionCount: 3,
      primarySections: ["Intro", "Verse 1", "Chorus 1"]
    }
  }));
  assert.deepEqual(errors, []);
});

test("proposal bundle contract accepts placement-first execution plan metadata", () => {
  const errors = validateProposalBundle(sampleProposal({
    executionPlan: {
      passScope: "whole_sequence",
      implementationMode: "whole_sequence_pass",
      routePreference: "designer_to_sequence_agent",
      sectionCount: 2,
      primarySections: ["Chorus 1", "Bridge"],
      effectPlacements: [
        {
          placementId: "p1",
          designId: "DES-001",
          targetId: "MegaTree",
          layerIndex: 1,
          effectName: "Shimmer",
          startMs: 30000,
          endMs: 36000,
          timingContext: {
            trackName: "XD: Song Structure",
            anchorLabel: "Chorus 1",
            anchorStartMs: 30000,
            anchorEndMs: 50000,
            alignmentMode: "within_section"
          },
          settingsIntent: {
            intensity: "medium_high",
            speed: "medium"
          },
          paletteIntent: {
            colors: ["warm gold"]
          },
          layerIntent: {
            priority: "foreground"
          },
          renderIntent: {
            groupPolicy: "preserve_group_rendering"
          }
        }
      ]
    }
  }));
  assert.deepEqual(errors, []);
});

test("designer dialog result contract accepts canonical payload", () => {
  const errors = validateDesignerDialogResult(sampleResult());
  assert.deepEqual(errors, []);
});

test("designer dialog input contract rejects missing required fields", () => {
  const errors = validateDesignerDialogInput(sampleInput({ requestId: "", context: {} }));
  assert.ok(errors.some((e) => /requestId is required/i.test(e)));
  assert.ok(errors.some((e) => /context.sequenceRevision is required/i.test(e)));
  assert.ok(errors.some((e) => /context.selection is required/i.test(e)));
});

test("buildCreativeBriefContract normalizes helper output into canonical contract", () => {
  const brief = buildCreativeBriefContract({
    summary: "test",
    goalsSummary: "goals",
    inspirationSummary: "inspiration",
    sections: ["Verse", "Chorus"],
    moodEnergyArc: "rise",
    narrativeCues: "story",
    visualCues: "cool white",
    hypotheses: ["hypothesis"]
  });
  assert.equal(brief.briefType, "creative_brief_v1");
  assert.equal(brief.briefVersion, "1.0");
  assert.equal(typeof brief.artifactId, "string");
  assert.equal(typeof brief.createdAt, "string");
  assert.deepEqual(validateCreativeBrief(brief), []);
});

test("designer contracts accept optional visual inspiration and asset refs", () => {
  const visualPack = buildVisualDesignAssetPack({
    sequenceId: "seq-1",
    themeSummary: "icy choral tension",
    inspirationPrompt: "Create an icy choral mood collage.",
    palette: [{ name: "ice blue", hex: "#8fd8ff", role: "cool base" }],
    motifs: ["ice shimmer"],
    displayAsset: { relativePath: "inspiration-board.png" }
  });
  const brief = buildCreativeBriefContract({
    summary: "test",
    goalsSummary: "goals",
    inspirationSummary: "inspiration",
    sections: ["Verse", "Chorus"],
    moodEnergyArc: "rise",
    narrativeCues: "story",
    visualCues: "cool white",
    hypotheses: ["hypothesis"],
    visualDesignAssetPack: visualPack
  });
  const proposal = sampleProposal({
    visualAssets: {
      assetPackId: visualPack.artifactId,
      summary: "Icy choral visual pack.",
      sequenceAssetCount: visualPack.sequenceAssets.length
    }
  });

  assert.deepEqual(validateCreativeBrief(brief), []);
  assert.deepEqual(validateProposalBundle(proposal), []);
  assert.equal(brief.visualInspiration.artifactId, visualPack.artifactId);
  assert.equal(proposal.visualAssets.assetPackId, visualPack.artifactId);
});

test("buildIntentHandoffFromDesignerState produces valid intent_handoff_v1", () => {
  const visualPack = buildVisualDesignAssetPack({
    sequenceId: "seq-1",
    themeSummary: "cinematic gold lift",
    inspirationPrompt: "Create a cinematic gold lift board.",
    palette: [{ name: "warm gold", hex: "#ffd36a", role: "impact highlight" }],
    motifs: ["gold fanfare"],
    displayAsset: { relativePath: "inspiration-board.png" },
    sequenceAssets: [
      {
        assetId: "asset-001",
        kind: "image",
        relativePath: "images/gold-fanfare.webp",
        mimeType: "image/webp",
        intendedUse: "picture_effect_texture"
      }
    ]
  });
  const handoff = buildIntentHandoffFromDesignerState({
    requestId: "req-1",
    normalizedIntent: {
      goal: "Polish chorus",
      sections: ["Chorus 1"],
      targetIds: ["MegaTree"],
      tags: ["focal"],
      tempoIntent: "hold",
      preserveTimingTracks: true
    },
    intentText: "Polish chorus",
    creativeBrief: {
      mood: "cinematic",
      paletteIntent: "warm gold",
      visualInspiration: {
        artifactId: visualPack.artifactId,
        palette: visualPack.creativeIntent.palette,
        motifs: visualPack.creativeIntent.motifs
      }
    },
    elevatedRiskConfirmed: false,
    resolvedTargetIds: ["MegaTree"],
    executionStrategy: {
      passScope: "whole_sequence",
      implementationMode: "whole_sequence_pass",
      routePreference: "designer_to_sequence_agent",
      shouldUseFullSongStructureTrack: true,
      sectionCount: 4,
      primarySections: ["Intro", "Verse 1", "Chorus 1", "Bridge"],
      sectionPlans: [
        {
          section: "Chorus 1",
          energy: "high",
          density: "dense",
          intentSummary: "Polish chorus",
          targetIds: ["MegaTree"]
        }
      ]
    },
    visualDesignAssetPack: visualPack
  });

  const gate = validateDesignerDialogContractGate("result", sampleResult({ handoff }));
  assert.equal(gate.ok, true);
  assert.equal(handoff.executionStrategy.passScope, "whole_sequence");
  assert.equal(handoff.sequencingDesignHandoff.visualAssetPackRef, visualPack.artifactId);
  assert.deepEqual(handoff.sequencingDesignHandoff.paletteRoles, visualPack.creativeIntent.palette);
  assert.equal("imageData" in handoff.sequencingDesignHandoff, false);
});

test("designer dialog contract gate reports unknown kind", () => {
  const gate = validateDesignerDialogContractGate("unknown", {});
  assert.equal(gate.ok, false);
  assert.ok(gate.report.errors.some((e) => /Unknown designer_dialog contract kind/i.test(e)));
});
