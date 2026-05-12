import test from "node:test";
import assert from "node:assert/strict";

import { promoteLayerCompositionPriors } from "./promote-layer-composition-priors.mjs";

function prior(overrides = {}) {
  return {
    priorId: "layer_composition:group_model_interplay:mono_white:foundation_group_only",
    confidence: "smoke_observed",
    selectorReady: false,
    promotionState: "staged",
    qualityEvidence: {
      recordId: "layer_quality:group-model-interplay-mono_white:foundation_group_only:bars:arches",
      durableCandidate: true,
      sampleCount: 2,
      trendStatus: "stable",
      latestOverallQuality: 0.85,
      meanOverallQuality: 0.84,
      promotionBlockers: []
    },
    safeguards: ["Do not reuse as a fixed sequencing recipe."],
    ...overrides
  };
}

test("promotion makes durable quality-backed priors selector-ready", () => {
  const artifact = promoteLayerCompositionPriors({
    priors: {
      artifactType: "layer_composition_priors_v1",
      sourceRunId: "run-1",
      priors: [prior()]
    }
  });

  assert.equal(artifact.selectorReadyCount, 1);
  assert.equal(artifact.blockedPromotionCount, 0);
  assert.equal(artifact.promotionState, "reviewed_with_selector_ready_priors");
  assert.deepEqual(artifact.promotionSummary.selectorReadyPriorIds, [
    "layer_composition:group_model_interplay:mono_white:foundation_group_only"
  ]);
  const promoted = artifact.priors[0];
  assert.equal(promoted.selectorReady, true);
  assert.equal(promoted.promotionState, "selector_ready");
  assert.equal(promoted.confidence, "quality_backed");
  assert.equal(promoted.promotionReview.selectorReady, true);
  assert.deepEqual(promoted.promotionReview.blockers, []);
  assert.equal(promoted.promotionReview.checks.every((check) => check.ok), true);
  assert.equal(promoted.safeguards.some((row) => row.includes("compatible family")), true);
  assert.equal(promoted.safeguards.some((row) => row.includes("project-local target behavior evidence")), true);
  assert.equal(artifact.promotionPolicy.targetApplicability, "compatible_structure_and_metadata_only");
  assert.equal(artifact.promotionPolicy.projectLocalOverrideArtifact, "display/target-behavior.json");
});

test("promotion blocks priors without durable repeated quality evidence", () => {
  const artifact = promoteLayerCompositionPriors({
    priors: {
      artifactType: "layer_composition_priors_v1",
      priors: [prior({
        priorId: "layer_composition:group_model_interplay:mono_white:model_only",
        qualityEvidence: {
          recordId: "layer_quality:group-model-interplay-mono_white:model_only:bars:arches",
          durableCandidate: false,
          sampleCount: 1,
          trendStatus: "single_run_baseline",
          latestOverallQuality: 0.85,
          meanOverallQuality: 0.85,
          promotionBlockers: ["insufficient_repeated_quality_evidence"]
        }
      })]
    }
  });

  assert.equal(artifact.selectorReadyCount, 0);
  assert.equal(artifact.blockedPromotionCount, 1);
  assert.equal(artifact.promotionState, "reviewed_no_selector_ready_priors");
  const blocked = artifact.priors[0];
  assert.equal(blocked.selectorReady, false);
  assert.equal(blocked.promotionState, "staged");
  assert.equal(blocked.confidence, "smoke_observed");
  assert.deepEqual(blocked.promotionReview.blockers, [
    "has_durable_quality_evidence",
    "sample_count",
    "trend_status",
    "quality_record_has_no_blockers"
  ]);
});

test("promotion respects stricter quality threshold", () => {
  const artifact = promoteLayerCompositionPriors({
    minQuality: 0.9,
    priors: {
      artifactType: "layer_composition_priors_v1",
      priors: [prior()]
    }
  });

  assert.equal(artifact.selectorReadyCount, 0);
  assert.equal(artifact.priors[0].promotionReview.blockers.includes("latest_quality"), true);
  assert.equal(artifact.priors[0].promotionReview.blockers.includes("mean_quality"), true);
});

test("promotion blocks creative revision priors when paired comparison blocks the revision", () => {
  const artifact = promoteLayerCompositionPriors({
    creativeIntentRevisionComparison: {
      artifactType: "creative_intent_revision_comparison_v1",
      status: "ready",
      comparisons: [{
        baselinePassId: "intent_first_draft",
        revisedPassId: "intent_focus_simplification_revision",
        comparisonStatus: "blocked",
        promotionEligible: false,
        blockers: ["intent_match_regressed", "visual_readability_regressed"]
      }, {
        baselinePassId: "intent_first_draft",
        revisedPassId: "intent_focal_handoff_revision",
        comparisonStatus: "improved",
        promotionEligible: true,
        blockers: []
      }]
    },
    priors: {
      artifactType: "layer_composition_priors_v1",
      priors: [
        prior({
          priorId: "layer_composition:creative_intent_revision_comparison:mono_white:intent_focus_simplification_revision",
          scope: {
            family: "creative_intent_revision_comparison",
            passId: "intent_focus_simplification_revision"
          }
        }),
        prior({
          priorId: "layer_composition:creative_intent_revision_comparison:mono_white:intent_focal_handoff_revision",
          scope: {
            family: "creative_intent_revision_comparison",
            passId: "intent_focal_handoff_revision"
          }
        })
      ]
    }
  });

  assert.equal(artifact.selectorReadyCount, 1);
  assert.deepEqual(artifact.promotionSummary.selectorReadyPriorIds, [
    "layer_composition:creative_intent_revision_comparison:mono_white:intent_focal_handoff_revision"
  ]);
  assert.equal(artifact.priors[0].selectorReady, false);
  assert.equal(
    artifact.priors[0].promotionReview.blockers.includes("creative_revision_comparison_promotion_eligible"),
    true
  );
  assert.equal(artifact.priors[1].selectorReady, true);
});
