import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreativeBriefArtifact,
  buildProposalBundleArtifact,
  executeDesignerDialogFlow
} from "../../../agent/designer-dialog/designer-dialog-runtime.js";

const models = [
  { id: "MegaTree", name: "MegaTree", type: "Model" },
  { id: "Roofline", name: "Roofline", type: "Model" }
];

const submodels = [
  { id: "MegaTree/Star", name: "Star", parentId: "MegaTree" }
];

const metadataAssignments = [
  { targetId: "MegaTree", tags: ["focal"] },
  { targetId: "Roofline", tags: ["support"] }
];

test("buildCreativeBriefArtifact returns canonical brief with traceability", () => {
  const result = buildCreativeBriefArtifact({
    requestId: "req-1",
    goals: "Build a nostalgic chorus payoff.",
    inspiration: "Feels like driving through a warm neighborhood at Christmas.",
    notes: "Keep the first verse more restrained.",
    references: [{ name: "street-photo", path: "/tmp/street.jpg", kind: "image" }],
    audioAnalysis: {
      trackName: "Song A",
      structure: ["Intro", "Verse", "Chorus"],
      summaryLines: ["Tempo: 132 BPM"]
    },
    songContextSummary: "A reflective holiday pop song.",
    latestIntent: "Make chorus feel nostalgic and bigger",
    directorProfile: {
      summary: "Prefers crisp focal contrast with controlled motion.",
      preferences: {
        focusPreference: "hero-prop-first",
        motionPreference: "smooth"
      }
    },
    designSceneContext: {
      metadata: { layoutMode: "2d" },
      focalCandidates: ["MegaTree", "Roofline"],
      coverageDomains: {
        broad: ["AllModels", "MegaTree"],
        detail: ["MegaTree/Star"]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Chorus", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Chorus"],
        holdMoments: ["Intro"],
        lyricFocusMoments: ["Verse"]
      }
    }
  });

  assert.equal(result.gate.ok, true);
  assert.equal(result.brief.briefType, "creative_brief_v1");
  assert.equal(result.brief.traceability.requestId, "req-1");
  assert.ok(Array.isArray(result.brief.traceability.references));
  assert.ok(result.brief.hypotheses.length >= 2);
  assert.equal(result.brief.traceability.directorProfileSignals.summary, "Prefers crisp focal contrast with controlled motion.");
  assert.equal(result.brief.traceability.designSceneSignals.layoutMode, "2d");
  assert.deepEqual(result.brief.traceability.designSceneSignals.detailCoverageDomains, ["MegaTree/Star"]);
  assert.equal(result.brief.traceability.musicDesignSignals.sectionArc[1].label, "Chorus");
  assert.equal(result.brief.traceability.musicDesignSignals.sectionArc[1].energy, "high");
  assert.ok(result.brief.visualCues.includes("MegaTree"));
  assert.ok(result.brief.narrativeCues.includes("Chorus"));
  assert.ok(result.brief.moodEnergyArc.includes("Chorus: high"));
  assert.ok(result.brief.hypotheses.some((line) => /broad coverage first/i.test(line)));
});

test("buildProposalBundleArtifact returns canonical proposal with scope and impact", () => {
  const brief = buildCreativeBriefArtifact({
    requestId: "req-2",
    goals: "Increase chorus impact.",
    latestIntent: "Make chorus more cinematic"
  }).brief;

  const result = buildProposalBundleArtifact({
    requestId: "req-2",
    sequenceRevision: "rev-9",
    promptText: "Make chorus more cinematic",
    creativeBrief: brief,
    selectedSections: ["Chorus"],
    selectedTagNames: ["focal"],
    selectedTargetIds: ["MegaTree"],
    models,
    submodels,
    metadataAssignments,
    directorProfile: {
      summary: "Prefers strong focal moments without clutter.",
      preferences: {
        focusPreference: "hero-prop-first"
      }
    },
    designSceneContext: {
      metadata: { layoutMode: "2d" },
      focalCandidates: ["MegaTree"],
      coverageDomains: {
        broad: ["AllModels"],
        detail: ["MegaTree/Star"]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Chorus", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Chorus"],
        holdMoments: [],
        lyricFocusMoments: []
      }
    }
  });

  assert.equal(result.inputGate.ok, true);
  assert.equal(result.proposalGate.ok, true);
  assert.equal(result.proposalBundle.bundleType, "proposal_bundle_v1");
  assert.equal(result.proposalBundle.baseRevision, "rev-9");
  assert.deepEqual(result.proposalBundle.scope.targetIds, ["MegaTree"]);
  assert.equal(result.proposalBundle.lifecycle.status, "fresh");
  assert.ok(result.proposalBundle.proposalLines.length > 0);
  assert.ok(Array.isArray(result.proposalBundle.assumptions));
  assert.ok(typeof result.proposalBundle.impact.estimatedImpact === "number");
  assert.equal(result.proposalBundle.executionPlan.passScope, "single_section");
  assert.equal(result.proposalBundle.executionPlan.implementationMode, "section_pass");
  assert.deepEqual(result.proposalBundle.executionPlan.primarySections, ["Chorus"]);
  assert.equal(result.proposalBundle.traceability.directorProfileSignals.summary, "Prefers strong focal moments without clutter.");
  assert.equal(result.proposalBundle.traceability.designSceneSignals.layoutMode, "2d");
  assert.deepEqual(result.proposalBundle.traceability.designSceneSignals.detailCoverageDomains, ["MegaTree/Star"]);
  assert.equal(result.proposalBundle.traceability.musicDesignSignals.sectionArc[0].label, "Chorus");
  assert.equal(result.proposalBundle.traceability.musicDesignSignals.revealMoments[0], "Chorus");
  assert.ok(result.proposalBundle.proposalLines.some((line) => /AllModels|General \/ General|build stronger visual payoff/i.test(line)));
  assert.ok(result.proposalBundle.proposalLines.some((line) => /MegaTree|focal clarity|visual anchor/i.test(line)));
});

test("executeDesignerDialogFlow returns canonical result with brief, proposal, and handoff", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-3",
    sequenceRevision: "rev-3",
    promptText: "Make the chorus feel bigger and cleaner",
    selectedSections: ["Chorus"],
    selectedTagNames: ["focal"],
    selectedTargetIds: ["MegaTree"],
    goals: "Increase impact without clutter.",
    inspiration: "Bright, clean holiday pop.",
    models,
    submodels,
    metadataAssignments
  });

  assert.equal(result.agentRole, "designer_dialog");
  assert.ok(["ok", "partial"].includes(result.status));
  assert.equal(result.creativeBrief.briefType, "creative_brief_v1");
  assert.equal(result.proposalBundle.bundleType, "proposal_bundle_v1");
  assert.equal(result.handoff.goal, "Make the chorus feel bigger and cleaner");
  assert.equal(result.handoff.executionStrategy.passScope, "single_section");
  assert.equal(result.handoff.executionStrategy.implementationMode, "section_pass");
});

test("executeDesignerDialogFlow proceeds on broad usable prompts with explicit assumptions", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-4",
    sequenceRevision: "rev-4",
    promptText: "Make it feel warmer and more nostalgic",
    goals: "Increase emotional warmth.",
    directorPreferences: {
      motionPreference: "smooth",
      focusPreference: "hero-prop-first"
    },
    models,
    submodels,
    metadataAssignments
  });

  assert.ok(result.creativeBrief.hypotheses.some((line) => /smooth motion preference|hero-prop-first/i.test(line)));
  assert.ok(result.proposalBundle.proposalLines.length > 0);
});

test("designer runtime marks whole-sequence passes explicitly for broad rewrites", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-5",
    sequenceRevision: "rev-5",
    promptText: "Rework the whole show into a warmer, more cinematic pass.",
    goals: "Create a full-song cinematic holiday treatment.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro" },
          { label: "Verse 1" },
          { label: "Chorus 1" },
          { label: "Bridge" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Bridge", energy: "high", density: "wide" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: ["Intro"],
        lyricFocusMoments: []
      }
    }
  });

  assert.ok(["ok", "partial"].includes(result.status));
  assert.equal(result.proposalBundle.executionPlan.passScope, "whole_sequence");
  assert.equal(result.proposalBundle.executionPlan.implementationMode, "whole_sequence_pass");
  assert.ok(result.proposalBundle.executionPlan.sectionPlans.length >= 4);
  assert.equal(result.handoff.executionStrategy.passScope, "whole_sequence");
  assert.equal(result.handoff.executionStrategy.shouldUseFullSongStructureTrack, true);
});

test("designer runtime builds actionable whole-sequence section plans instead of prompt-text repeats", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-6",
    sequenceRevision: "rev-6",
    promptText: "Rework the whole show into a warmer, more cinematic pass.",
    goals: "Create a full-song cinematic holiday treatment.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro" },
          { label: "Verse 1" },
          { label: "Chorus 1" },
          { label: "Bridge" },
          { label: "Outro" }
        ]
      }
    },
    designSceneContext: {
      focalCandidates: ["Snowman", "PorchTree"],
      coverageDomains: {
        broad: ["AllModels", "AllModels_NoFloods"],
        detail: ["Border-01/Segments", "Snowman/Face2-Head"]
      },
      metadata: { layoutMode: "2d" }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Bridge", energy: "medium", density: "wide" },
        { label: "Outro", energy: "low", density: "sparse" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: ["Intro"],
        lyricFocusMoments: []
      }
    }
  });

  const sectionPlans = result.proposalBundle.executionPlan.sectionPlans;
  assert.equal(sectionPlans.length, 5);
  assert.match(sectionPlans[0].intentSummary, /restrained|slower fades|readable atmosphere/i);
  assert.match(sectionPlans[2].intentSummary, /stronger visual payoff|layered shimmer|focal emphasis/i);
  assert.notEqual(sectionPlans[0].intentSummary, result.handoff.goal);
  assert.ok(sectionPlans[0].targetIds.slice(0, 2).every((targetId) => !/(^|\/)(allmodels|allmodels_)/i.test(targetId)));
  assert.ok(sectionPlans[0].targetIds.includes("Snowman"));
  assert.ok(sectionPlans[0].targetIds.length >= 2);
  assert.equal(sectionPlans[0].designId, "DES-001");
  assert.equal(sectionPlans[0].designRevision, 0);
  assert.equal(sectionPlans[2].designId, "DES-003");
  assert.equal(sectionPlans[2].designRevision, 0);
  assert.ok(sectionPlans[2].targetIds.includes("Snowman"));
  assert.ok(sectionPlans[2].targetIds.includes("PorchTree"));
  assert.deepEqual(sectionPlans[0].effectHints, ["Color Wash", "Candle"]);
  assert.deepEqual(sectionPlans[2].effectHints, ["Bars", "Meteors"]);
  assert.deepEqual(sectionPlans[3].effectHints.sort(), ["Morph", "Spirals"]);
  assert.ok(sectionPlans[3].targetIds.some((row) => /Border-01\/Segments|Snowman\/Face2-Head/i.test(row)));
});

test("designer runtime emits exact effect placements when analyzed section timings are available", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-7",
    sequenceRevision: "rev-7",
    promptText: "Rework the whole show into a warmer, more cinematic pass.",
    goals: "Create a full-song cinematic holiday treatment.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000, energy: "low", density: "sparse" },
          { label: "Chorus 1", startMs: 30000, endMs: 50000, energy: "high", density: "dense" },
          { label: "Bridge", startMs: 50000, endMs: 70000, energy: "medium", density: "wide" }
        ]
      }
    },
    designSceneContext: {
      focalCandidates: ["Snowman", "PorchTree"],
      coverageDomains: {
        broad: ["AllModels", "AllModels_NoFloods"],
        detail: ["Border-01/Segments", "Snowman/Face2-Head"]
      },
      metadata: { layoutMode: "2d" }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Bridge", energy: "medium", density: "wide" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: ["Intro"],
        lyricFocusMoments: []
      }
    }
  });

  const placements = result.proposalBundle.executionPlan.effectPlacements;
  assert.ok(Array.isArray(placements));
  assert.ok(placements.length >= 6);
  const introPrimary = placements.find((row) => row.sourceSectionLabel === "Intro" && row.layerIndex === 0);
  const chorusOverlay = placements.find((row) => row.sourceSectionLabel === "Chorus 1" && row.layerIndex === 1);
  assert.equal(introPrimary.designId, "DES-001");
  assert.equal(introPrimary.designRevision, 0);
  assert.equal(chorusOverlay.designId, "DES-002");
  assert.equal(chorusOverlay.designRevision, 0);
  assert.equal(introPrimary.startMs, 0);
  assert.ok(introPrimary.endMs <= 10000);
  assert.ok(["section_span", "section_slice"].includes(introPrimary.timingContext.alignmentMode));
  assert.ok(chorusOverlay.timingContext.anchorStartMs >= 30000);
  assert.ok(chorusOverlay.timingContext.anchorEndMs <= 50000);
  assert.ok(chorusOverlay.startMs >= 30000);
  assert.ok(chorusOverlay.endMs <= 50000);
  assert.ok(chorusOverlay.layerIntent);
  assert.ok(chorusOverlay.renderIntent);
  assert.ok(chorusOverlay.settingsIntent);
  assert.ok(chorusOverlay.paletteIntent);
  assert.deepEqual(result.handoff.executionStrategy.effectPlacements, placements);
});

test("designer runtime aligns placements to beat, chord, and phrase cue windows when requested", () => {
  const musicDesignContext = {
    sectionArc: [
      { label: "Verse 1", energy: "medium", density: "moderate" },
      { label: "Chorus 1", energy: "high", density: "dense" },
      { label: "Bridge", energy: "medium", density: "moderate" }
    ],
    designCues: {
      cueWindowsBySection: {
        "Verse 1": {
          chord: [
            { label: "Chord A", trackName: "XD: Chord Changes", startMs: 22000, endMs: 30000 }
          ]
        },
        "Chorus 1": {
          beat: [
            { label: "Beat Pulse 1", trackName: "XD: Beat Grid", startMs: 56000, endMs: 61000 }
          ]
        },
        Bridge: {
          phrase: [
            { label: "Phrase Hold", trackName: "XD: Phrase Cues", startMs: 96000, endMs: 104000 }
          ]
        }
      }
    }
  };

  const beatResult = executeDesignerDialogFlow({
    requestId: "req-8a",
    sequenceRevision: "rev-8a",
    promptText: "Use beat-driven accents in Chorus 1 so the pulse lands on the beat grid.",
    goals: "Accent the beat grid in Chorus 1.",
    selectedSections: ["Chorus 1"],
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 54000, endMs: 90000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext
  });
  const beatPlacement = beatResult.proposalBundle.executionPlan.effectPlacements[0];
  assert.equal(beatPlacement.timingContext.trackName, "XD: Beat Grid");
  assert.equal(beatPlacement.timingContext.alignmentMode, "beat_window");

  const chordResult = executeDesignerDialogFlow({
    requestId: "req-8b",
    sequenceRevision: "rev-8b",
    promptText: "Follow the chord changes in Verse 1 with cleaner harmonic pivots.",
    goals: "Follow chord changes in Verse 1.",
    selectedSections: ["Verse 1"],
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 18000, endMs: 54000, energy: "medium", density: "moderate" }
        ]
      }
    },
    musicDesignContext
  });
  const chordPlacement = chordResult.proposalBundle.executionPlan.effectPlacements[0];
  assert.equal(chordPlacement.timingContext.trackName, "XD: Chord Changes");
  assert.equal(chordPlacement.timingContext.alignmentMode, "chord_window");

  const phraseResult = executeDesignerDialogFlow({
    requestId: "req-8c",
    sequenceRevision: "rev-8c",
    promptText: "Shape the Bridge transition by holding the breath before the phrase release.",
    goals: "Use phrase cues in Bridge.",
    selectedSections: ["Bridge"],
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Bridge", startMs: 90000, endMs: 120000, energy: "medium", density: "moderate" }
        ]
      }
    },
    musicDesignContext
  });
  const phrasePlacement = phraseResult.proposalBundle.executionPlan.effectPlacements[0];
  assert.equal(phrasePlacement.timingContext.trackName, "XD: Phrase Cues");
  assert.equal(phrasePlacement.timingContext.alignmentMode, "phrase_window");

  const preChorusLiftResult = executeDesignerDialogFlow({
    requestId: "req-8d",
    sequenceRevision: "rev-8d",
    promptText: "Shape the Pre-Chorus like a lift that holds tension before Chorus 1 opens up.",
    goals: "Use phrase cues in the Pre-Chorus lift.",
    selectedSections: ["Pre-Chorus"],
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Pre-Chorus", startMs: 43000, endMs: 53500, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 53500, endMs: 70000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Pre-Chorus", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: ["Pre-Chorus"],
        lyricFocusMoments: [],
        cueWindowsBySection: {
          "Pre-Chorus": {
            phrase: [
              { label: "Lift Build", trackName: "XD: Phrase Cues", startMs: 43000, endMs: 50000 },
              { label: "Lift Release", trackName: "XD: Phrase Cues", startMs: 50000, endMs: 53500 }
            ]
          }
        }
      }
    }
  });
  const preChorusTracks = Array.from(new Set(preChorusLiftResult.proposalBundle.executionPlan.effectPlacements.map((row) => row.timingContext.trackName)));
  const preChorusAlignmentModes = Array.from(new Set(preChorusLiftResult.proposalBundle.executionPlan.effectPlacements.map((row) => row.timingContext.alignmentMode)));
  const preChorusSections = Array.from(new Set(preChorusLiftResult.proposalBundle.executionPlan.effectPlacements.map((row) => row.sourceSectionLabel)));
  assert.deepEqual(preChorusTracks, ["XD: Phrase Cues"]);
  assert.deepEqual(preChorusAlignmentModes, ["phrase_window"]);
  assert.deepEqual(preChorusSections, ["Pre-Chorus"]);
});

test("designer runtime does not fabricate phrase windows from beat cues when phrase cues are missing", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-8e",
    sequenceRevision: "rev-8e",
    promptText: "In the Bridge, hold the breath before the phrase release and shape the lift with subtler within-phrase timing instead of filling the whole section evenly.",
    goals: "In the Bridge, hold the breath before the phrase release and shape the lift with subtler within-phrase timing instead of filling the whole section evenly.",
    selectedSections: ["Bridge"],
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Bridge", startMs: 201410, endMs: 219250, energy: "medium", density: "moderate" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Bridge", energy: "medium", density: "moderate" }
      ],
      designCues: {
        cueWindowsBySection: {
          Bridge: {
            beat: [
              { label: "1", trackName: "XD: Beat Grid", startMs: 201851, endMs: 202385 },
              { label: "2", trackName: "XD: Beat Grid", startMs: 202385, endMs: 202919 },
              { label: "1", trackName: "XD: Beat Grid", startMs: 202919, endMs: 203453 },
              { label: "2", trackName: "XD: Beat Grid", startMs: 203453, endMs: 203987 },
              { label: "1", trackName: "XD: Beat Grid", startMs: 203987, endMs: 204521 },
              { label: "2", trackName: "XD: Beat Grid", startMs: 204521, endMs: 205055 }
            ]
          }
        }
      }
    }
  });

  const placements = result.proposalBundle.executionPlan.effectPlacements;
  const trackNames = Array.from(new Set(placements.map((row) => row.timingContext.trackName)));
  const alignmentModes = Array.from(new Set(placements.map((row) => row.timingContext.alignmentMode)));
  assert.ok(!trackNames.includes("XD: Phrase Cues"));
  assert.ok(!alignmentModes.includes("phrase_window"));
});

test("designer runtime keeps whole-sequence passes section-scoped even when the goal mentions beat sync", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-8f",
    sequenceRevision: "rev-8f",
    promptText: "Create a full-song sequence with stronger beat sync and bigger contrast across the whole song.",
    goals: "Create a full-song sequence with stronger beat sync and bigger contrast across the whole song.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000, energy: "low", density: "sparse" },
          { label: "Chorus 1", startMs: 30000, endMs: 50000, energy: "high", density: "dense" },
          { label: "Bridge", startMs: 50000, endMs: 70000, energy: "medium", density: "wide" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Bridge", energy: "medium", density: "wide" }
      ],
      designCues: {
        cueWindowsBySection: {
          "Chorus 1": {
            beat: [
              { label: "Beat 1", trackName: "XD: Beat Grid", startMs: 30000, endMs: 30500 },
              { label: "Beat 2", trackName: "XD: Beat Grid", startMs: 30500, endMs: 31000 }
            ]
          }
        }
      }
    }
  });

  const placements = result.proposalBundle.executionPlan.effectPlacements;
  assert.ok(placements.length > 0);
  assert.ok(placements.every((row) => row.timingContext.alignmentMode !== "beat_window"));
  assert.ok(placements.some((row) => row.timingContext.alignmentMode === "section_span"));
  assert.deepEqual(result.handoff.scope.tagNames, []);
});

test("designer runtime subdivides whole-sequence placements within sections for denser timing-anchored coverage", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-8g",
    sequenceRevision: "rev-8g",
    promptText: "Create a full-song sequence with stronger contrast and fuller coverage across the whole song.",
    goals: "Create a full-song sequence with stronger contrast and fuller coverage across the whole song.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 10000, endMs: 30000, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 30000, endMs: 50000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ],
      designCues: {
        cueWindowsBySection: {
          "Verse 1": {
            phrase: [
              { label: "Phrase 1", trackName: "XD: Phrase Cues", startMs: 10000, endMs: 18000 },
              { label: "Phrase 2", trackName: "XD: Phrase Cues", startMs: 18000, endMs: 30000 }
            ]
          },
          "Chorus 1": {
            beat: [
              { label: "1", trackName: "XD: Beat Grid", startMs: 30000, endMs: 35000 },
              { label: "2", trackName: "XD: Beat Grid", startMs: 35000, endMs: 40000 },
              { label: "3", trackName: "XD: Beat Grid", startMs: 40000, endMs: 45000 },
              { label: "4", trackName: "XD: Beat Grid", startMs: 45000, endMs: 50000 }
            ]
          }
        }
      }
    }
  });

  const placements = result.proposalBundle.executionPlan.effectPlacements;
  const versePlacements = placements.filter((row) => row.sourceSectionLabel === "Verse 1");
  const chorusPlacements = placements.filter((row) => row.sourceSectionLabel === "Chorus 1");
  assert.ok(versePlacements.length > 0);
  assert.ok(chorusPlacements.length > 0);
  assert.ok(new Set(versePlacements.map((row) => `${row.startMs}-${row.endMs}`)).size >= 2);
  assert.ok(new Set(chorusPlacements.map((row) => `${row.startMs}-${row.endMs}`)).size >= 3);
  assert.ok(chorusPlacements.some((row) => /beat_group|section_slice/.test(row.timingContext.alignmentMode)));
});

test("designer runtime broad whole-sequence passes now use multiple supported effect families", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-8",
    sequenceRevision: "rev-8",
    promptText: "Rework the whole show into a warmer, more cinematic pass.",
    goals: "Create a full-song cinematic holiday treatment.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000, energy: "low", density: "sparse" },
          { label: "Verse 1", startMs: 10000, endMs: 25000, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 25000, endMs: 45000, energy: "high", density: "dense" },
          { label: "Bridge", startMs: 45000, endMs: 65000, energy: "medium", density: "wide" },
          { label: "Outro", startMs: 65000, endMs: 80000, energy: "low", density: "sparse" }
        ]
      }
    },
    designSceneContext: {
      focalCandidates: ["Snowman", "PorchTree"],
      coverageDomains: {
        broad: ["AllModels", "AllModels_NoFloods"],
        detail: ["Border-01/Segments", "Snowman/Face2-Head"]
      },
      metadata: { layoutMode: "2d" }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Bridge", energy: "medium", density: "wide" },
        { label: "Outro", energy: "low", density: "sparse" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: ["Intro"],
        lyricFocusMoments: []
      }
    }
  });

  const effectNames = Array.from(new Set(result.proposalBundle.executionPlan.effectPlacements.map((row) => row.effectName)));
  assert.ok(effectNames.includes("Candle"));
  assert.ok(effectNames.some((row) => ["Pinwheel", "Meteors", "Bars"].includes(row)));
  assert.ok(effectNames.includes("Morph"));
  assert.ok(effectNames.length >= 5);
});

test("designer runtime whole-sequence passes prefer concrete targets over aggregate domains when concrete coverage exists", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-concrete-whole-sequence",
    sequenceRevision: "rev-concrete-whole-sequence",
    promptText: "Rework the whole show into a fuller cinematic pass with stronger contrast across sections.",
    goals: "Create a full-song cinematic holiday treatment with stronger contrast across sections.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000, energy: "low", density: "sparse" },
          { label: "Verse 1", startMs: 10000, endMs: 25000, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 25000, endMs: 45000, energy: "high", density: "dense" }
        ]
      }
    },
    designSceneContext: {
      focalCandidates: ["Snowman", "PorchTree", "Train"],
      coverageDomains: {
        broad: ["AllModels", "FrontHouse", "FrontProps"],
        detail: ["Border-01/Segments", "Spinner-01", "Snowflake_Large-01"]
      },
      metadata: { layoutMode: "2d" }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ]
    }
  });

  const sectionPlans = result.proposalBundle.executionPlan.sectionPlans;
  assert.ok(sectionPlans.every((row) => row.targetIds.length >= 4));
  assert.ok(sectionPlans.every((row) => row.targetIds.filter((id) => /(^|\/)(allmodels|fronthouse|frontprops)/i.test(id)).length <= 1));
});

test("designer runtime keeps chorus family resemblance cues coherent while allowing final chorus build", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-role-chorus",
    sequenceRevision: "rev-role-chorus",
    promptText: "Give the choruses a recognizable common visual language so Chorus 1, Chorus 2, and the Final Chorus feel related, then let each chorus build in size and payoff with the Final Chorus clearly landing biggest.",
    goals: "Give the choruses a recognizable common visual language so Chorus 1, Chorus 2, and the Final Chorus feel related, then let each chorus build in size and payoff with the Final Chorus clearly landing biggest.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 0, endMs: 20000, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 20000, endMs: 40000, energy: "high", density: "dense" },
          { label: "Verse 2", startMs: 40000, endMs: 60000, energy: "medium", density: "moderate" },
          { label: "Chorus 2", startMs: 60000, endMs: 80000, energy: "high", density: "dense" },
          { label: "Bridge", startMs: 80000, endMs: 100000, energy: "medium", density: "wide" },
          { label: "Final Chorus", startMs: 100000, endMs: 125000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Verse 2", energy: "medium", density: "moderate" },
        { label: "Chorus 2", energy: "high", density: "dense" },
        { label: "Bridge", energy: "medium", density: "wide" },
        { label: "Final Chorus", energy: "high", density: "dense" }
      ]
    }
  });

  const plans = result.proposalBundle.executionPlan.sectionPlans.filter((row) => /chorus/i.test(row.section));
  const chorus1 = plans.find((row) => row.section === "Chorus 1");
  const chorus2 = plans.find((row) => row.section === "Chorus 2");
  const finalChorus = plans.find((row) => row.section === "Final Chorus");
  assert.ok(Array.isArray(chorus1.effectHints) && chorus1.effectHints.length > 0);
  assert.ok(Array.isArray(chorus2.effectHints) && chorus2.effectHints.length > 0);
  assert.ok(Array.isArray(finalChorus.effectHints) && finalChorus.effectHints.length > 0);
});

test("designer runtime can intentionally break verse family identity when prompt asks for unrelated verses", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-role-verse",
    sequenceRevision: "rev-role-verse",
    promptText: "Make each verse feel unrelated to the other sections with no need for Verse 1 and Verse 2 to share a supporting identity.",
    goals: "Make each verse feel unrelated to the other sections with no need for Verse 1 and Verse 2 to share a supporting identity.",
    models,
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 0, endMs: 20000, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 20000, endMs: 40000, energy: "high", density: "dense" },
          { label: "Verse 2", startMs: 40000, endMs: 60000, energy: "medium", density: "moderate" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Verse 2", energy: "medium", density: "moderate" }
      ]
    }
  });

  const plans = result.proposalBundle.executionPlan.sectionPlans.filter((row) => /verse/i.test(row.section));
  assert.ok(Array.isArray(plans[0].effectHints) && plans[0].effectHints.length > 0);
  assert.ok(Array.isArray(plans[1].effectHints) && plans[1].effectHints.length > 0);
  assert.notDeepEqual(plans[0].effectHints, plans[1].effectHints);
});

test("designer runtime does not treat inferred focal language as explicit metadata scope in broad passes", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-8d",
    sequenceRevision: "rev-8d",
    promptText: "Rework the whole show into a warmer, more cinematic pass with clear section contrast, stronger focal moments, and more varied effects across the song.",
    goals: "Create a full-song cinematic holiday treatment with stronger focal moments.",
    models: [
      { id: "Snowman", name: "Snowman", type: "Model" },
      { id: "Star", name: "Star", type: "Model" },
      { id: "Border-01", name: "Border-01", type: "Model" },
      { id: "PorchTree", name: "PorchTree", type: "Model" },
      { id: "Wreathes", name: "Wreathes", type: "Model" }
    ],
    submodels,
    metadataAssignments: [
      { targetId: "Snowman", tags: ["focal"] },
      { targetId: "Star", tags: ["focal"] },
      { targetId: "Border-01", tags: ["support"] },
      { targetId: "PorchTree", tags: ["support"] },
      { targetId: "Wreathes", tags: ["support"] }
    ],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000, energy: "low", density: "sparse" },
          { label: "Verse 1", startMs: 10000, endMs: 25000, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 25000, endMs: 45000, energy: "high", density: "dense" },
          { label: "Bridge", startMs: 45000, endMs: 65000, energy: "medium", density: "wide" },
          { label: "Outro", startMs: 65000, endMs: 80000, energy: "low", density: "sparse" }
        ]
      }
    },
    designSceneContext: {
      focalCandidates: ["Snowman", "Star"],
      coverageDomains: {
        broad: ["Border-01", "PorchTree", "Wreathes"],
        detail: ["Snowman", "Star"]
      },
      metadata: { layoutMode: "2d" }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Bridge", energy: "medium", density: "wide" },
        { label: "Outro", energy: "low", density: "sparse" }
      ]
    }
  });

  const placementTargets = Array.from(new Set(result.proposalBundle.executionPlan.effectPlacements.map((row) => row.targetId)));
  assert.ok(placementTargets.includes("Snowman"));
  assert.ok(placementTargets.length >= 2);
});

test("designer runtime keeps broad whole-song goal-match targets out of handoff scope", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-8e",
    sequenceRevision: "rev-8e",
    promptText: "Design the full song with a restrained glowing base, smoother texture transitions, and selective sparkle only on the bigger lifts so the render feels polished instead of busy.",
    goals: "Design the full song with a restrained glowing base, smoother texture transitions, and selective sparkle only on the bigger lifts so the render feels polished instead of busy.",
    models: [
      { id: "Train", name: "Train", type: "Model" },
      { id: "Border-01", name: "Border-01", type: "Model" },
      { id: "CandyCane-01", name: "CandyCane-01", type: "Model" },
      { id: "FrontHouse", name: "FrontHouse", type: "Model" }
    ],
    submodels,
    metadataAssignments,
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Intro", startMs: 0, endMs: 10000, energy: "low", density: "sparse" },
          { label: "Verse 1", startMs: 10000, endMs: 30000, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 30000, endMs: 50000, energy: "high", density: "dense" },
          { label: "Bridge", startMs: 50000, endMs: 70000, energy: "medium", density: "moderate" },
          { label: "Outro", startMs: 70000, endMs: 80000, energy: "low", density: "sparse" }
        ]
      }
    },
    designSceneContext: {
      focalCandidates: ["Train"],
      coverageDomains: {
        broad: ["AllModels", "AllModels_NoFloods"],
        detail: ["Border-01/Segments", "Train/Body"]
      },
      metadata: { layoutMode: "2d" }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Intro", energy: "low", density: "sparse" },
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Bridge", energy: "medium", density: "moderate" },
        { label: "Outro", energy: "low", density: "sparse" }
      ],
      designCues: {
        revealMoments: ["Verse 1->Chorus 1"],
        holdMoments: ["Intro", "Outro"],
        lyricFocusMoments: []
      }
    }
  });

  assert.deepEqual(result.proposalBundle.scope.targetIds, []);
  assert.deepEqual(result.handoff.scope.targetIds, []);
  assert.equal(result.proposalBundle.executionPlan.passScope, "whole_sequence");
});

test("designer runtime constrains tag-driven execution plans to resolved metadata targets when prompt has no explicit target ids", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-9",
    sequenceRevision: "rev-9",
    promptText: "Use the lyric props for verse emphasis.",
    goals: "Use the lyric props for verse emphasis.",
    selectedSections: ["Verse 1"],
    models: [
      { id: "Snowman", name: "Snowman", type: "Model" },
      { id: "Border-01", name: "Border-01", type: "Model" },
      { id: "Border-02", name: "Border-02", type: "Model" }
    ],
    submodels: [],
    metadataAssignments: [
      { targetId: "Snowman", tags: ["lyric"] },
      { targetId: "Border-01", tags: ["support"] },
      { targetId: "Border-02", tags: ["support"] }
    ],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 18000, endMs: 54000, energy: "medium", density: "moderate" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Verse 1", energy: "medium", density: "moderate" }
      ],
      designCues: {
        revealMoments: [],
        holdMoments: [],
        lyricFocusMoments: ["Verse 1"]
      }
    }
  });

  const placementTargets = Array.from(new Set(result.proposalBundle.executionPlan.effectPlacements.map((row) => row.targetId)));
  assert.deepEqual(placementTargets, ["Snowman"]);
  assert.deepEqual(result.handoff.scope.targetIds, ["Snowman"]);
});

test("designer runtime preserves spatial layout selection when prompts mention foreground and background", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-10",
    sequenceRevision: "rev-10",
    promptText: "Keep the foreground calmer while the background opens up in Chorus 1.",
    goals: "Keep the foreground calmer while the background opens up in Chorus 1.",
    selectedSections: ["Chorus 1"],
    models: [
      { id: "Border-01", name: "Border-01", type: "Model" },
      { id: "Snowman", name: "Snowman", type: "Model" },
      { id: "Wreathes", name: "Wreathes", type: "Model" }
    ],
    submodels: [],
    metadataAssignments: [
      { targetId: "Wreathes", tags: ["background"] }
    ],
    designSceneContext: {
      spatialZones: {
        foreground: ["Border-01"],
        midground: ["Snowman"],
        background: ["Wreathes"],
        left: ["Border-01"],
        center: ["Snowman"],
        right: ["Wreathes"]
      },
      focalCandidates: ["Snowman"],
      coverageDomains: {
        broad: ["AllModels_NoFloods"],
        detail: ["Snowman"]
      },
      metadata: { layoutMode: "2d" }
    },
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 54000, endMs: 90000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Chorus 1", energy: "high", density: "dense" }
      ],
      designCues: {
        revealMoments: ["Chorus 1"],
        holdMoments: [],
        lyricFocusMoments: []
      }
    }
  });

  const placementTargets = Array.from(new Set(result.proposalBundle.executionPlan.effectPlacements.map((row) => row.targetId))).sort();
  assert.ok(placementTargets.includes("Border-01"));
  assert.ok(placementTargets.includes("Wreathes"));
});

test("designer runtime layers the lead target before support targets for lighting-language concepts", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-12",
    sequenceRevision: "rev-12",
    promptText: "Treat Snowman like the key light focus and let the border props act more like gentle fill in Chorus 1.",
    goals: "Treat Snowman like the key light focus and let the border props act more like gentle fill in Chorus 1.",
    selectedSections: ["Chorus 1"],
    models: [
      { id: "Snowman", name: "Snowman", type: "Model" },
      { id: "Border-01", name: "Border-01", type: "Model" },
      { id: "Border-02", name: "Border-02", type: "Model" }
    ],
    submodels: [],
    metadataAssignments: [
      { targetId: "Snowman", tags: ["focal", "character"] },
      { targetId: "Border-01", tags: ["support", "perimeter"] },
      { targetId: "Border-02", tags: ["support", "perimeter"] }
    ],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 54000, endMs: 90000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Chorus 1", energy: "high", density: "dense" }
      ]
    }
  });

  const placements = result.proposalBundle.executionPlan.effectPlacements;
  const snowmanLayers = Array.from(new Set(placements.filter((row) => row.targetId === "Snowman").map((row) => row.layerIndex))).sort();
  const borderLayers = Array.from(new Set(placements.filter((row) => row.targetId === "Border-01").map((row) => row.layerIndex))).sort();
  assert.deepEqual(snowmanLayers, [0, 1]);
  assert.deepEqual(borderLayers, [0]);
  assert.ok(placements.filter((row) => row.targetId === "Border-01").every((row) => /focused|partial/i.test(String(row?.settingsIntent?.coverage || ""))));
  assert.ok(placements.filter((row) => row.targetId === "Border-01").every((row) => row.layerIntent?.blendRole === "support_fill"));
  assert.ok(placements.filter((row) => row.targetId === "Border-01").every((row) => row.layerIntent?.mixAmount === "low"));
  assert.ok(placements.some((row) => row.targetId === "Snowman" && row.layerIntent?.mixAmount === "high"));
  assert.ok(placements.filter((row) => row.targetId === "Border-01").every((row) => row.renderIntent?.groupPolicy === "preserve_group_rendering"));
  assert.ok(placements.filter((row) => row.targetId === "Border-01").every((row) => row.renderIntent?.bufferStyle === "inherit"));
});

test("designer runtime keeps support targets lighter for single-section focal concepts", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-13",
    sequenceRevision: "rev-13",
    promptText: "Design a single Chorus 1 concept with Snowman leading and Star supporting softly.",
    goals: "Design a single Chorus 1 concept with Snowman leading and Star supporting softly.",
    selectedSections: ["Chorus 1"],
    selectedTargetIds: ["Snowman", "Star"],
    models: [
      { id: "Snowman", name: "Snowman", type: "Model" },
      { id: "Star", name: "Star", type: "Model" }
    ],
    submodels: [],
    metadataAssignments: [],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 54000, endMs: 90000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Chorus 1", energy: "high", density: "dense" }
      ]
    }
  });

  const placements = result.proposalBundle.executionPlan.effectPlacements;
  assert.equal(placements.filter((row) => row.targetId === "Snowman").length, 2);
  assert.equal(placements.filter((row) => row.targetId === "Star").length, 1);
});

test("designer runtime keeps multi-section revise requests inside one conceptual group", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-14",
    sequenceRevision: "rev-14",
    promptText: "Revise the perimeter support concept so it contributes less visual weight and more framing.",
    goals: "Revise the perimeter support concept so it contributes less visual weight and more framing.",
    selectedSections: ["Verse 1", "Chorus 1"],
    models: [
      { id: "Snowman", name: "Snowman", type: "Model" },
      { id: "Star", name: "Star", type: "Model" },
      { id: "Border-02", name: "Border-02", type: "Model" },
      { id: "Border-03", name: "Border-03", type: "Model" }
    ],
    submodels,
    metadataAssignments: [],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 18000, endMs: 54000, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 54000, endMs: 90000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" }
      ]
    }
  });

  const sectionPlans = result.proposalBundle.executionPlan.sectionPlans;
  const placements = result.proposalBundle.executionPlan.effectPlacements;
  const conceptIds = Array.from(new Set(sectionPlans.map((row) => row.designId)));
  const placementConceptIds = Array.from(new Set(placements.map((row) => row.designId)));
  assert.deepEqual(conceptIds, ["DES-001"]);
  assert.deepEqual(placementConceptIds, ["DES-001"]);
  assert.deepEqual(Array.from(new Set(sectionPlans.map((row) => row.section))).sort(), ["Chorus 1", "Verse 1"]);
});

test("designer runtime ignores negated effect cues and preserves explicit marquee/shockwave/singlestrand/on requests", () => {
  const shared = {
    requestId: "req-15",
    sequenceRevision: "rev-15",
    models: [
      { id: "Border_Segments", name: "Border_Segments", type: "Model" },
      { id: "Star", name: "Star", type: "Model" },
      { id: "CandyCanes", name: "CandyCanes", type: "Model" },
      { id: "Snowman", name: "Snowman", type: "Model" }
    ],
    submodels: [],
    metadataAssignments: [],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Chorus 2", startMs: 170783, endMs: 185899, energy: "high", density: "dense" },
          { label: "Verse 2", startMs: 119815, endMs: 170783, energy: "medium", density: "moderate" },
          { label: "Outro", startMs: 217780, endMs: 237829, energy: "low", density: "sparse" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Chorus 2", energy: "high", density: "dense" },
        { label: "Verse 2", energy: "medium", density: "moderate" },
        { label: "Outro", energy: "low", density: "sparse" }
      ]
    }
  };

  const marquee = executeDesignerDialogFlow({
    ...shared,
    promptText: "For Chorus 2, use Border_Segments as a marching marquee-band read with obvious segmented chase structure rather than broad wash or sparkle.",
    goals: "For Chorus 2, use Border_Segments as a marching marquee-band read with obvious segmented chase structure rather than broad wash or sparkle.",
    selectedSections: ["Chorus 2"],
    selectedTargetIds: ["Border_Segments"]
  });
  assert.deepEqual(
    marquee.proposalBundle.executionPlan.sectionPlans.map((row) => row.effectHints),
    [["Marquee"]]
  );

  const shockwave = executeDesignerDialogFlow({
    ...shared,
    promptText: "For Chorus 2, use Star as a centered shockwave ring burst with radial expansion. Do not turn it into a soft twinkle texture or pinwheel spin.",
    goals: "For Chorus 2, use Star as a centered shockwave ring burst with radial expansion. Do not turn it into a soft twinkle texture or pinwheel spin.",
    selectedSections: ["Chorus 2"],
    selectedTargetIds: ["Star"]
  });
  assert.deepEqual(
    shockwave.proposalBundle.executionPlan.sectionPlans.map((row) => row.effectHints),
    [["Shockwave"]]
  );

  const strand = executeDesignerDialogFlow({
    ...shared,
    promptText: "In Verse 2, make CandyCanes read as a directional traveling strand with chase motion, not a broad wash or radial treatment.",
    goals: "In Verse 2, make CandyCanes read as a directional traveling strand with chase motion, not a broad wash or radial treatment.",
    selectedSections: ["Verse 2"],
    selectedTargetIds: ["CandyCanes"]
  });
  assert.deepEqual(
    strand.proposalBundle.executionPlan.sectionPlans.map((row) => row.effectHints),
    [["SingleStrand", "Bars"]]
  );

  const onHold = executeDesignerDialogFlow({
    ...shared,
    promptText: "For the Outro, keep Snowman on a solid steady hold with minimal movement. Use an On effect rather than sparkle, bars, or ring motion.",
    goals: "For the Outro, keep Snowman on a solid steady hold with minimal movement. Use an On effect rather than sparkle, bars, or ring motion.",
    selectedSections: ["Outro"],
    selectedTargetIds: ["Snowman"]
  });
  assert.deepEqual(
    onHold.proposalBundle.executionPlan.sectionPlans.map((row) => row.effectHints),
    [["Color Wash"]]
  );
});

test("designer runtime scopes multi-section effect hints to their matching section clauses", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-16",
    sequenceRevision: "rev-16",
    promptText: "Keep Spinners restrained and texture-led in the Bridge with a softer twinkle feel, then shift to a clear radial spin on Star in the Final Chorus. The Final Chorus should read as the stronger visual payoff.",
    goals: "Keep Spinners restrained and texture-led in the Bridge with a softer twinkle feel, then shift to a clear radial spin on Star in the Final Chorus. The Final Chorus should read as the stronger visual payoff.",
    selectedSections: ["Bridge", "Final Chorus"],
    selectedTargetIds: ["Spinners", "Star"],
    models: [
      { id: "Spinners", name: "Spinners", type: "Model" },
      { id: "Star", name: "Star", type: "Model" }
    ],
    submodels: [],
    metadataAssignments: [],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Bridge", startMs: 150000, endMs: 170000, energy: "medium", density: "moderate" },
          { label: "Final Chorus", startMs: 170000, endMs: 205000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Bridge", energy: "medium", density: "moderate" },
        { label: "Final Chorus", energy: "high", density: "dense" }
      ]
    }
  });

  const sectionPlans = result.proposalBundle.executionPlan.sectionPlans;
  const bridgePlan = sectionPlans.find((row) => row.section === "Bridge");
  const finalChorusPlan = sectionPlans.find((row) => row.section === "Final Chorus");

  assert.ok(bridgePlan);
  assert.ok(finalChorusPlan);
  assert.ok(bridgePlan.effectHints.includes("Twinkle") || bridgePlan.effectHints.includes("Shimmer"));
  assert.ok(!bridgePlan.effectHints.includes("Pinwheel"));
  assert.ok(finalChorusPlan.effectHints.includes("Pinwheel"));
  assert.ok(!finalChorusPlan.effectHints.includes("Twinkle"));
});

test("designer runtime preserves explicit segmented bars and radial spin cues in multi-section prompts", () => {
  const barsResult = executeDesignerDialogFlow({
    requestId: "req-17",
    sequenceRevision: "rev-17",
    promptText: "Use Border_Segments as a clean segmented bars read in Verse 1, then escalate them into an obvious marquee-band chase in Chorus 2. Keep the chorus visibly more assertive than the verse.",
    goals: "Use Border_Segments as a clean segmented bars read in Verse 1, then escalate them into an obvious marquee-band chase in Chorus 2. Keep the chorus visibly more assertive than the verse.",
    selectedSections: ["Verse 1", "Chorus 2"],
    selectedTargetIds: ["Border_Segments"],
    models: [{ id: "Border_Segments", name: "Border_Segments", type: "Model" }],
    submodels: [],
    metadataAssignments: [],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 10000, endMs: 40000, energy: "medium", density: "moderate" },
          { label: "Chorus 2", startMs: 40000, endMs: 70000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 2", energy: "high", density: "dense" }
      ]
    }
  });
  const barsPlans = barsResult.proposalBundle.executionPlan.sectionPlans;
  assert.deepEqual(
    barsPlans.map((row) => row.effectHints),
    [["Bars", "Marquee"], ["Marquee", "Bars"]]
  );

  const radialResult = executeDesignerDialogFlow({
    requestId: "req-18",
    sequenceRevision: "rev-18",
    promptText: "Keep Spinners restrained and texture-led in the Bridge with a softer twinkle feel, then shift to a clear radial spin on Star in the Final Chorus. The Final Chorus should read as the stronger visual payoff.",
    goals: "Keep Spinners restrained and texture-led in the Bridge with a softer twinkle feel, then shift to a clear radial spin on Star in the Final Chorus. The Final Chorus should read as the stronger visual payoff.",
    selectedSections: ["Bridge", "Final Chorus"],
    selectedTargetIds: ["Spinners", "Star"],
    models: [
      { id: "Spinners", name: "Spinners", type: "Model" },
      { id: "Star", name: "Star", type: "Model" }
    ],
    submodels: [],
    metadataAssignments: [],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Bridge", startMs: 150000, endMs: 170000, energy: "medium", density: "moderate" },
          { label: "Final Chorus", startMs: 170000, endMs: 205000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Bridge", energy: "medium", density: "moderate" },
        { label: "Final Chorus", energy: "high", density: "dense" }
      ]
    }
  });
  const radialPlans = radialResult.proposalBundle.executionPlan.sectionPlans;
  assert.deepEqual(radialPlans[1].effectHints, ["Pinwheel"]);

  const starTransition = executeDesignerDialogFlow({
    requestId: "req-19",
    sequenceRevision: "rev-19",
    promptText: "Use Star as a centered shockwave ring in the Bridge, then switch it to a clear pinwheel-style radial spin in the Final Chorus. Make the Final Chorus read as the stronger resolved payoff rather than repeating the same radial family.",
    goals: "Use Star as a centered shockwave ring in the Bridge, then switch it to a clear pinwheel-style radial spin in the Final Chorus. Make the Final Chorus read as the stronger resolved payoff rather than repeating the same radial family.",
    selectedSections: ["Bridge", "Final Chorus"],
    selectedTargetIds: ["Star"],
    models: [{ id: "Star", name: "Star", type: "Model" }],
    submodels: [],
    metadataAssignments: [],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Bridge", startMs: 150000, endMs: 170000, energy: "medium", density: "moderate" },
          { label: "Final Chorus", startMs: 170000, endMs: 205000, energy: "high", density: "dense" }
        ]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Bridge", energy: "medium", density: "moderate" },
        { label: "Final Chorus", energy: "high", density: "dense" }
      ]
    }
  });
  assert.deepEqual(
    starTransition.proposalBundle.executionPlan.sectionPlans.map((row) => row.effectHints),
    [["Shockwave"], ["Pinwheel"]]
  );
});

test("designer runtime prefers explicit spiral motion cues on tree chorus requests with live scene context", () => {
  const result = executeDesignerDialogFlow({
    requestId: "req-20",
    sequenceRevision: "rev-20",
    promptText: "Design a single Chorus 1 concept for SpiralTrees. Keep SpiralTrees as the lead read and use flowing spiral motion rather than a generic segmented fill. Do not rewrite the whole show.",
    goals: "Design a single Chorus 1 concept for SpiralTrees. Keep SpiralTrees as the lead read and use flowing spiral motion rather than a generic segmented fill. Do not rewrite the whole show.",
    selectedSections: ["Chorus 1"],
    selectedTargetIds: ["SpiralTrees"],
    models: [
      { id: "SpiralTrees", name: "SpiralTrees", type: "Model" },
      { id: "Border", name: "Border", type: "Model" },
      { id: "Star", name: "Star", type: "Model" }
    ],
    submodels: [],
    metadataAssignments: [],
    analysisHandoff: {
      structure: {
        sections: [
          { label: "Verse 1", startMs: 16080, endMs: 55440, energy: "medium", density: "moderate" },
          { label: "Chorus 1", startMs: 55440, endMs: 90840, energy: "high", density: "dense" },
          { label: "Verse 2", startMs: 90840, endMs: 126240, energy: "medium", density: "moderate" }
        ]
      }
    },
    designSceneContext: {
      metadata: { layoutMode: "2d" },
      focalCandidates: [],
      coverageDomains: {
        broad: ["AllModels", "AllModels_NoFloods"],
        detail: ["Border/Segments", "Star/Rays"]
      }
    },
    musicDesignContext: {
      sectionArc: [
        { label: "Verse 1", energy: "medium", density: "moderate" },
        { label: "Chorus 1", energy: "high", density: "dense" },
        { label: "Verse 2", energy: "medium", density: "moderate" }
      ]
    }
  });

  assert.deepEqual(
    result.proposalBundle.executionPlan.sectionPlans.map((row) => row.effectHints),
    [["Spirals", "Wave"]]
  );
});
