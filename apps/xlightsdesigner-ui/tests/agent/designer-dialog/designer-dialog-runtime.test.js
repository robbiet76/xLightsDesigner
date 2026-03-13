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
  assert.equal(result.proposalBundle.traceability.directorProfileSignals.summary, "Prefers strong focal moments without clutter.");
  assert.equal(result.proposalBundle.traceability.designSceneSignals.layoutMode, "2d");
  assert.deepEqual(result.proposalBundle.traceability.designSceneSignals.detailCoverageDomains, ["MegaTree/Star"]);
  assert.equal(result.proposalBundle.traceability.musicDesignSignals.sectionArc[0].label, "Chorus");
  assert.equal(result.proposalBundle.traceability.musicDesignSignals.revealMoments[0], "Chorus");
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
