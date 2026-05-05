import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildVideoAestheticScore } from "./build-video-aesthetic-score.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeWindow(root, {
  passId,
  startMs,
  endMs,
  quality,
  motion = 0.12,
  color = 0.7,
  colorDiscipline = 0.8,
  coverage = 0.04,
  eligible = true
} = {}) {
  const passDir = path.join(root, "passes", `experiment__${passId}`);
  const qualityDir = path.join(passDir, "render-review-quality");
  const reviewPath = path.join(qualityDir, "render-review.json");
  const qualityPath = path.join(qualityDir, "render-review-quality-summary.json");
  const observationPath = path.join(passDir, "render-observation.json");
  writeJson(reviewPath, {
    artifactType: "render_review_v1",
    section: { id: passId, startMs, endMs },
    deterministicMetrics: {
      activeCoverageMean: coverage,
      colorDiversityMean: color,
      temporalMotionMean: motion,
      clutterRisk: 0.05
    },
    qualityScores: {
      overallQuality: quality,
      visualReadability: 0.78,
      intentMatch: 0.76,
      compositionBalance: 0.74,
      colorDiscipline,
      motionCoherence: 0.82,
      transitionQuality: 0.79,
      clutterControl: 0.95
    }
  });
  writeJson(qualityPath, {
    artifactType: "layer_composition_render_review_quality_v1",
    passId,
    passWindow: { startMs, endMs },
    renderReviewRef: reviewPath,
    decision: eligible ? "accept" : "revise",
    overallQuality: quality,
    evidenceEligible: eligible,
    measurementStatus: eligible ? "quality_evidence" : "render_health_observation"
  });
  writeJson(observationPath, {
    macro: {
      leadModelShare: 0.9,
      meanSceneSpreadRatio: 0.18,
      maxActiveModelRatio: 0.12
    }
  });
  return {
    passId,
    startMs,
    endMs,
    decision: eligible ? "accept" : "revise",
    evidenceEligible: eligible,
    measurementStatus: eligible ? "quality_evidence" : "render_health_observation",
    overallQuality: quality,
    renderObservationRef: observationPath,
    renderReviewRef: reviewPath,
    renderReviewQualityRef: qualityPath
  };
}

function writeProgression(root) {
  const progressionPath = path.join(root, "full-sequence-progression-observation.json");
  writeJson(progressionPath, {
    artifactType: "progression_observation_v1",
    scope: { windowCount: 2 },
    handoff: {
      scores: {
        handoffClarity: 0.72,
        continuityAdequacy: 0.68,
        transitionAbruptness: 0.22,
        arrivalReadability: 0.7
      }
    },
    development: {
      scores: {
        developmentStrength: 0.7,
        variationAdequacy: 0.74,
        stagnationRisk: 0.24
      }
    },
    repetition: {
      scores: {
        stalenessRisk: 0.2,
        motionReuseLevel: 0.25
      }
    },
    energyArc: {
      scores: {
        arcCoherence: 0.77,
        energyShapeClarity: 0.73
      }
    }
  });
  return progressionPath;
}

test("video aesthetic score summarizes full-sequence windows", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-aesthetic-"));
  const opening = writeWindow(root, { passId: "opening", startMs: 0, endMs: 2000, quality: 0.81, motion: 0.08 });
  const lift = writeWindow(root, { passId: "lift", startMs: 2000, endMs: 4000, quality: 0.84, motion: 0.16, color: 0.9 });
  const progressionPath = writeProgression(root);
  const fullPath = path.join(root, "full-sequence-review-loop.json");
  writeJson(fullPath, {
    artifactType: "full_sequence_review_loop_v1",
    status: "ready",
    windowCount: 2,
    evidenceEligibleWindowCount: 2,
    progressionObservationRef: progressionPath,
    windows: [opening, lift]
  });

  const artifact = buildVideoAestheticScore({ runRoot: root });

  assert.equal(artifact.artifactType, "video_aesthetic_score_v1");
  assert.equal(artifact.status, "ready");
  assert.equal(artifact.scoredWindowCount, 2);
  assert.equal(artifact.scores.sectionQualityMean, 0.825);
  assert.equal(artifact.scores.overallAestheticScore > 0.7, true);
  assert.equal(artifact.qualityDimensions.includes("display_evolution"), true);
  assert.equal(artifact.qualityDimensions.includes("temporal_continuity"), true);
  assert.equal(artifact.qualityDimensions.includes("local_evidence_readability"), true);
  assert.equal(artifact.promotion.evidenceEligible, true);
  assert.equal(fs.existsSync(path.join(root, "video-aesthetic-score.json")), true);
});

test("video aesthetic score blocks when full-sequence review has too few windows", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-aesthetic-one-"));
  const opening = writeWindow(root, { passId: "opening", startMs: 0, endMs: 2000, quality: 0.81 });
  const fullPath = path.join(root, "full-sequence-review-loop.json");
  writeJson(fullPath, {
    artifactType: "full_sequence_review_loop_v1",
    status: "insufficient_windows",
    windowCount: 1,
    windows: [opening]
  });

  const artifact = buildVideoAestheticScore({ runRoot: root });

  assert.equal(artifact.status, "insufficient_video_windows");
  assert.equal(artifact.promotion.evidenceEligible, false);
  assert.ok(artifact.promotion.blockers.includes("insufficient_scored_windows"));
});

test("video aesthetic score prefers controller-selected candidate windows over dependencies", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-aesthetic-selected-"));
  const dependency = writeWindow(root, {
    passId: "display_motion_variety",
    startMs: 0,
    endMs: 2000,
    quality: 0.55,
    motion: 0.02,
    color: 1
  });
  const candidate = writeWindow(root, {
    passId: "display_focal_consistency_repair",
    startMs: 2000,
    endMs: 4000,
    quality: 0.88,
    motion: 0.12,
    color: 0.35
  });
  const progressionPath = writeProgression(root);
  writeJson(path.join(root, "training-plan.json"), {
    artifactType: "layer_composition_training_plan_v1",
    experiments: [{
      passes: [
        { passId: "display_motion_variety", controllerSelection: { reason: "comparison_dependency" } },
        { passId: "display_focal_consistency_repair", controllerSelection: { selectedByController: true } }
      ]
    }]
  });
  writeJson(path.join(root, "full-sequence-review-loop.json"), {
    artifactType: "full_sequence_review_loop_v1",
    status: "ready",
    windowCount: 2,
    evidenceEligibleWindowCount: 2,
    progressionObservationRef: progressionPath,
    windows: [dependency, candidate]
  });

  const artifact = buildVideoAestheticScore({ runRoot: root });

  assert.equal(artifact.scoreBasis, "controller_selected_window_metrics_and_progression_observation");
  assert.equal(artifact.status, "ready");
  assert.equal(artifact.scoredWindowCount, 1);
  assert.equal(artifact.controllerSelectedWindowCount, 1);
  assert.equal(artifact.minimumScoredWindows, 1);
  assert.deepEqual(artifact.windows.map((window) => window.passId), ["display_focal_consistency_repair"]);
  assert.equal(artifact.scores.sectionQualityMean, 0.88);
});

test("video aesthetic score uses layer intent metadata for local evidence readability", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-aesthetic-local-"));
  const dependency = writeWindow(root, {
    passId: "display_rgb_color_discipline_repair",
    startMs: 0,
    endMs: 2000,
    quality: 0.72,
    motion: 0.08,
    color: 0.3,
    coverage: 0.04
  });
  const candidate = writeWindow(root, {
    passId: "display_safe_local_evidence_repair",
    startMs: 2000,
    endMs: 4000,
    quality: 0.82,
    motion: 0.12,
    color: 0.45,
    coverage: 0.05
  });
  const progressionPath = writeProgression(root);
  writeJson(path.join(root, "training-plan.json"), {
    artifactType: "layer_composition_training_plan_v1",
    experiments: [{
      passes: [
        { passId: "display_rgb_color_discipline_repair", controllerSelection: { reason: "comparison_dependency" } },
        {
          passId: "display_safe_local_evidence_repair",
          controllerSelection: { selectedByController: true },
          placements: [
            {
              layerIntent: {
                localEvidenceRole: "linear_node_order_readability",
                colorPurpose: "structure_motion_support"
              }
            },
            {
              layerIntent: {
                localEvidenceRole: "radial_structure_readability",
                colorPurpose: "warm_focal_accent"
              }
            }
          ]
        }
      ]
    }]
  });
  writeJson(path.join(root, "full-sequence-review-loop.json"), {
    artifactType: "full_sequence_review_loop_v1",
    status: "ready",
    windowCount: 2,
    evidenceEligibleWindowCount: 2,
    progressionObservationRef: progressionPath,
    windows: [dependency, candidate]
  });

  const artifact = buildVideoAestheticScore({ runRoot: root });

  assert.equal(artifact.scoreBasis, "controller_selected_window_metrics_and_progression_observation");
  assert.equal(artifact.scoringSignals.localEvidenceWindowCount, 1);
  assert.deepEqual(
    artifact.scoringSignals.localEvidenceRoles,
    ["linear_node_order_readability", "radial_structure_readability"]
  );
  assert.deepEqual(
    artifact.windows[0].localEvidenceRoles,
    ["linear_node_order_readability", "radial_structure_readability"]
  );
  assert.equal(artifact.scores.localEvidenceReadability > 0.75, true);
  assert.equal(artifact.scores.temporalContinuity, 0.5);
});

test("video aesthetic score treats explicit palette roles as disciplined multicolor intent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-video-aesthetic-palette-roles-"));
  const candidate = writeWindow(root, {
    passId: "display_palette_depth_contrast_motion_repair",
    startMs: 0,
    endMs: 4000,
    quality: 0.74,
    motion: 0.13,
    color: 1,
    colorDiscipline: 0.1,
    coverage: 0.05
  });
  const progressionPath = writeProgression(root);
  writeJson(path.join(root, "training-plan.json"), {
    artifactType: "layer_composition_training_plan_v1",
    experiments: [{
      passes: [{
        passId: "display_palette_depth_contrast_motion_repair",
        controllerSelection: { selectedByController: true },
        placements: [
          { layerIntent: { colorPurpose: "background_structure" } },
          { layerIntent: { colorPurpose: "structure_motion_support" } },
          { layerIntent: { colorPurpose: "focal_accent" } }
        ]
      }]
    }]
  });
  writeJson(path.join(root, "full-sequence-review-loop.json"), {
    artifactType: "full_sequence_review_loop_v1",
    status: "ready",
    windowCount: 1,
    evidenceEligibleWindowCount: 1,
    progressionObservationRef: progressionPath,
    windows: [candidate]
  });

  const artifact = buildVideoAestheticScore({ runRoot: root });

  assert.equal(artifact.scoreBasis, "controller_selected_window_metrics_and_progression_observation");
  assert.equal(artifact.scoringSignals.renderColorDiscipline, 0.1);
  assert.equal(artifact.scoringSignals.paletteRoleDiscipline > 0.8, true);
  assert.equal(artifact.scores.colorDiscipline > 0.8, true);
});
