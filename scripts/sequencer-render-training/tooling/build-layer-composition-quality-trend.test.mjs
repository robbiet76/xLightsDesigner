import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildLayerCompositionQualityTrend } from "./build-layer-composition-quality-trend.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeRun(root, { runId, quality = 0.8, eligible = true, generatedAt = "2026-05-04T00:00:00.000Z" } = {}) {
  writeJson(path.join(root, "training-plan.json"), {
    runId,
    experiments: [{
      experimentId: "experiment",
      family: "submodel_structure",
      passes: [{
        passId: "pass",
        changeType: "sibling_submodel_layer_added",
        placements: [{
          targetScope: "submodel",
          modelType: "custom",
          geometryProfile: "custom_submodel_structural"
        }]
      }]
    }]
  });
  const passDir = path.join(root, "passes", "experiment__pass");
  const reviewPath = path.join(passDir, "render-review.json");
  const qualityPath = path.join(passDir, "render-review-quality-summary.json");
  writeJson(reviewPath, {
    artifactType: "render_review_v1",
    section: {
      id: "section-01",
      label: "section-01",
      startMs: 0,
      endMs: 1000
    },
    intent: {
      effectName: eligible ? "Bars" : "",
      musicRole: { energy: "build" },
      creativeObjective: {
        mood: "warm_build",
        pace: "slow_build",
        emphasis: "late_section_accent",
        style: "smooth_wash",
        negativeSpace: "preserve_opening_space",
        dimensions: ["mood", "pace", "emphasis", "style", "negative_space"],
        reviewMethods: ["deterministic_metrics"]
      },
      paletteIntent: { palette: "mono_white" },
      targetHierarchy: eligible ? { leadTargets: ["Arches"] } : {},
      renderPlan: eligible
        ? { plannedEffectCount: 1, plannedTargetCount: 1 }
        : { plannedEffectCount: 0, plannedTargetCount: 0 }
    },
    qualityScores: {
      overallQuality: quality,
      visualReadability: quality - 0.01,
      intentMatch: quality - 0.02,
      motionCoherence: quality - 0.03,
      colorDiscipline: quality - 0.04,
      musicalFit: quality - 0.05,
      transitionQuality: quality - 0.06
    },
    deterministicMetrics: {
      activeCoverageMean: 0.02,
      activeNodeRatioPeak: 0.1,
      activeTargetNodeRatioPeak: 0.6,
      temporalMotionMean: 0.05,
      temporalColorDeltaMean: 0.02,
      temporalBrightnessDeltaMean: 0.02,
      temporalActiveDeltaMean: 0.02,
      blankRisk: 0
    },
    evidence: {
      videoPath: path.join(root, "preview-window.mp4"),
      frameDirectory: path.join(root, "frames")
    },
    critique: { decision: "accept" },
    evidenceQualification: eligible
      ? { eligible: true, status: "quality_evidence", reasons: [], plannedEffectCount: 1, plannedTargetCount: 1 }
      : { eligible: false, status: "render_health_observation", reasons: ["no_planned_effects"], plannedEffectCount: 0, plannedTargetCount: 0 }
  });
  writeJson(qualityPath, {
    artifactType: "layer_composition_render_review_quality_v1",
    renderReviewRef: reviewPath,
    previewMediaRef: path.join(root, "preview-window.mp4"),
    contactSheetRef: path.join(root, "contact-sheet.jpg"),
    passWindow: { label: "section-01", startMs: 0, endMs: 1000 },
    decision: "accept",
    overallQuality: quality,
    evidenceEligible: eligible,
    measurementStatus: eligible ? "quality_evidence" : "render_health_observation"
  });
  writeJson(path.join(root, "pass-runner-summary.json"), {
    artifactType: "layer_composition_pass_runner_summary_v1",
    generatedAt,
    results: [
      {
        experimentId: "experiment",
        passId: "pass",
        renderReviewDecision: "accept",
        renderReviewOverallQuality: quality,
        renderReviewQualityRef: qualityPath,
        renderReviewEvidenceEligible: eligible,
        renderReviewMeasurementStatus: eligible ? "quality_evidence" : "render_health_observation"
      }
    ]
  });
}

test("quality trend summarizes a single run as a baseline", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-trend-"));
  writeRun(root, { runId: "run-a", quality: 0.81 });

  const artifact = buildLayerCompositionQualityTrend({ runRoots: [root] });

  assert.equal(artifact.artifactType, "layer_composition_quality_trend_v1");
  assert.equal(artifact.summary.evidenceRecordCount, 1);
  assert.equal(artifact.summary.qualityTrendStatus, "single_run_baseline");
  assert.equal(artifact.groups[0].latestOverallQuality, 0.81);
  assert.equal(artifact.groups[0].family, "submodel_structure");
  assert.deepEqual(artifact.groups[0].targetScopes, ["submodel"]);
  assert.deepEqual(artifact.groups[0].modelTypes, ["custom"]);
  assert.deepEqual(artifact.groups[0].reviewScopes, ["section_video", "whole_sequence_window", "full_display_contact_sheet"]);
  assert.equal(artifact.groups[0].qualityDimensions.includes("motion_coherence"), true);
  assert.equal(artifact.groups[0].qualityDimensions.includes("palette_readability"), true);
  assert.deepEqual(artifact.groups[0].timingSources, ["section"]);
  assert.equal(artifact.groups[0].musicQualityDimensions.includes("energy_progression"), true);
  assert.equal(artifact.groups[0].musicQualityDimensions.includes("timing_alignment"), true);
  assert.equal(artifact.groups[0].musicQualityDimensions.includes("repetition_with_variation"), true);
  assert.equal(artifact.groups[0].intentDimensions.includes("mood"), true);
  assert.equal(artifact.groups[0].intentDimensions.includes("palette"), true);
  assert.equal(artifact.groups[0].intentDimensions.includes("negative_space"), true);
  assert.equal(artifact.groups[0].reviewMethods.includes("deterministic_metrics"), true);
  assert.equal(artifact.groups[0].reviewMethods.includes("vision_review"), true);
});

test("quality trend compares matching quality evidence across runs", () => {
  const first = fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-trend-a-"));
  const second = fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-trend-b-"));
  const out = path.join(second, "quality-trend.json");
  writeRun(first, { runId: "run-a", quality: 0.78, generatedAt: "2026-05-04T00:00:00.000Z" });
  writeRun(second, { runId: "run-b", quality: 0.84, generatedAt: "2026-05-04T01:00:00.000Z" });

  const artifact = buildLayerCompositionQualityTrend({ runRoots: [first, second], outPath: out });

  assert.equal(fs.existsSync(out), true);
  assert.equal(artifact.summary.comparableGroupCount, 1);
  assert.equal(artifact.summary.qualityTrendStatus, "improving");
  assert.equal(artifact.summary.latestQualityDeltaFromPrevious, 0.06);
  assert.equal(artifact.groups[0].trendStatus, "improving");
  assert.equal(artifact.groups[0].overallDeltaFromFirst, 0.06);
});

test("quality trend keeps observation-only records out of quality evidence", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-trend-observation-"));
  writeRun(root, { runId: "run-a", quality: 0.9, eligible: false });

  const artifact = buildLayerCompositionQualityTrend({ runRoots: [root] });

  assert.equal(artifact.summary.evidenceRecordCount, 0);
  assert.equal(artifact.summary.observationRecordCount, 1);
  assert.equal(artifact.summary.qualityGroupCount, 0);
  assert.equal(artifact.observationRecords[0].qualificationReasons.includes("no_planned_effects"), true);
});
