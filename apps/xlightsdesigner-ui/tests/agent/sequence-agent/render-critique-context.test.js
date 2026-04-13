import test from "node:test";
import assert from "node:assert/strict";

import { buildRenderCritiqueContext } from "../../../agent/sequence-agent/render-critique-context.js";

test("buildRenderCritiqueContext merges render observation with design and handoff context", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      artifactId: "obs-1",
      source: {
        startMs: 1000,
        endMs: 4000,
        samplingMode: "targeted",
        sampledModelCount: 2,
        windowCount: 2
      },
      macro: {
        activeModelNames: ["MegaTree", "Roofline"],
        activeFamilyTotals: { Tree: 3, Line: 2 },
        leadModel: "MegaTree",
        leadModelShare: 0.76,
        meanSceneSpreadRatio: 0.024,
        activeCoverageRatio: 0.18,
        coverageGapCount: 2,
        coverageGapRegions: ["topRight", "bottomRight"],
        coverageRead: "partial",
        leftRightBalanceRatio: 0.42,
        topBottomBalanceRatio: 0.08,
        maxActiveModelRatio: 0.12,
        temporalRead: "modulated",
        energyVariation: 0.11,
        activeModelVariation: 1,
        distinctLeadModelCount: 1
      }
    },
    designSceneContext: {
      artifactId: "scene-1",
      focalCandidates: ["MegaTree", "ArchSingle"],
      coverageDomains: {
        broad: ["AllModels"],
        detail: ["MegaTree/Star"]
      }
    },
    sequencingDesignHandoff: {
      artifactId: "handoff-1",
      designSummary: "MegaTree leads while roofline supports the chorus lift.",
      focusPlan: {
        primaryTargets: ["MegaTree"],
        secondaryTargets: ["Roofline"]
      },
      sectionDirectives: [
        {
          preferredVisualFamilies: ["spiral_flow", "soft_texture"]
        }
      ]
    }
  });

  assert.equal(out.artifactType, "sequence_render_critique_context_v1");
  assert.deepEqual(out.expected.primaryFocusTargetIds, ["MegaTree"]);
  assert.deepEqual(out.expected.supportTargetIds, ["Roofline"]);
  assert.deepEqual(out.expected.preferredVisualFamilies, ["spiral_flow", "soft_texture"]);
  assert.deepEqual(out.observed.activeModelNames, ["MegaTree", "Roofline"]);
  assert.equal(out.observed.leadModel, "MegaTree");
  assert.equal(out.observed.sampledStartMs, 1000);
  assert.equal(out.observed.sampledEndMs, 4000);
  assert.equal(out.observed.samplingMode, "targeted");
  assert.equal(out.observed.sampledModelCount, 2);
  assert.equal(out.observed.windowCount, 2);
  assert.equal(out.observed.activeCoverageRatio, 0.18);
  assert.equal(out.observed.coverageRead, "partial");
  assert.equal(out.observed.leftRightBalanceRead, "imbalanced");
  assert.equal(out.observed.topBottomBalanceRead, "balanced");
  assert.equal(out.comparison.leadMatchesPrimaryFocus, true);
  assert.equal(out.comparison.leadIsKnownFocalCandidate, true);
  assert.deepEqual(out.comparison.observedFocusTargets, ["MegaTree"]);
  assert.equal(out.observed.breadthRead, "moderate");
  assert.equal(out.observed.temporalRead, "modulated");
  assert.equal(out.comparison.renderCoverageTooSparse, true);
  assert.equal(out.comparison.renderHasDisplayGaps, true);
  assert.equal(out.comparison.renderIsLeftRightImbalanced, true);
  assert.deepEqual(out.comparison.adjacentWindowComparisons, []);
});

test("buildRenderCritiqueContext falls back to scene focal candidates when handoff focus is missing", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      macro: {
        activeModelNames: ["ArchSingle"],
        activeFamilyTotals: { Arch: 3 },
        leadModel: "ArchSingle",
        leadModelShare: 0.9,
        meanSceneSpreadRatio: 0.006
      }
    },
    designSceneContext: {
      focalCandidates: ["ArchSingle", "MegaTree"]
    },
    sequencingDesignHandoff: {
      designSummary: "Arch led focused section."
    }
  });

  assert.deepEqual(out.expected.primaryFocusTargetIds, ["ArchSingle", "MegaTree"]);
  assert.equal(out.comparison.leadMatchesPrimaryFocus, true);
  assert.equal(out.comparison.renderUsesTightFocus, true);
  assert.equal(out.observed.breadthRead, "tight");
});

test("buildRenderCritiqueContext compares adjacent sampled windows", () => {
  const out = buildRenderCritiqueContext({
    renderObservation: {
      source: {
        startMs: 0,
        endMs: 4000,
        samplingMode: "targeted",
        sampledModelCount: 2,
        windowCount: 2
      },
      macro: {
        activeModelNames: ["MegaTree", "Roofline"],
        activeFamilyTotals: { Tree: 2, Line: 2 },
        leadModel: "MegaTree",
        leadModelShare: 0.7,
        meanSceneSpreadRatio: 0.02,
        temporalRead: "evolving"
      },
      windows: [
        {
          label: "Verse",
          startMs: 0,
          endMs: 2000,
          activeModelNames: ["MegaTree", "Roofline"],
          leadModel: "MegaTree",
          meanSceneSpreadRatio: 0.02,
          temporalRead: "flat"
        },
        {
          label: "Chorus",
          startMs: 2000,
          endMs: 4000,
          activeModelNames: ["MegaTree", "Roofline"],
          leadModel: "MegaTree",
          meanSceneSpreadRatio: 0.02,
          temporalRead: "flat"
        }
      ]
    },
    designSceneContext: {
      focalCandidates: ["MegaTree"]
    },
    sequencingDesignHandoff: {
      designSummary: "Verse should build into the chorus.",
      focusPlan: {
        primaryTargets: ["MegaTree"]
      }
    }
  });

  assert.equal(out.comparison.adjacentWindowComparisons.length, 1);
  assert.equal(out.comparison.adjacentWindowComparisons[0].fromLabel, "Verse");
  assert.equal(out.comparison.adjacentWindowComparisons[0].toLabel, "Chorus");
  assert.equal(out.comparison.adjacentWindowComparisons[0].windowsReadSimilarly, true);
});
