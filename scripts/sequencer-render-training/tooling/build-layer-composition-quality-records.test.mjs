import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildLayerCompositionQualityRecords } from "./build-layer-composition-quality-records.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function trendGroup(overrides = {}) {
  return {
    key: "experiment::foundation_group_only::Bars::Arches",
    experimentId: "experiment",
    passId: "foundation_group_only",
    family: "submodel_structure",
    targetScopes: ["submodel"],
    modelTypes: ["custom"],
    geometryProfiles: ["custom_submodel_structural"],
    changeType: "sibling_submodel_layer_added",
    effectName: "Bars",
    leadTargets: ["Arches"],
    sampleCount: 2,
    firstOverallQuality: 0.82,
    previousOverallQuality: 0.82,
    latestOverallQuality: 0.86,
    overallDeltaFromFirst: 0.04,
    overallDeltaFromPrevious: 0.04,
    trendStatus: "improving",
    latestDecision: "accept",
    latestRenderReviewRef: "/tmp/latest-render-review.json",
    latestQualityRef: "/tmp/latest-quality.json",
    samples: [
      {
        runId: "run-a",
        runRoot: "/tmp/run-a",
        overallQuality: 0.82,
        visualReadability: 0.81,
        intentMatch: 0.8,
        motionCoherence: 0.79,
        activeNodeRatioPeak: 0.1,
        activeTargetNodeRatioPeak: 0.4,
        temporalMotionMean: 0.04
      },
      {
        runId: "run-b",
        runRoot: "/tmp/run-b",
        overallQuality: 0.86,
        visualReadability: 0.85,
        intentMatch: 0.84,
        motionCoherence: 0.83,
        activeNodeRatioPeak: 0.12,
        activeTargetNodeRatioPeak: 0.5,
        temporalMotionMean: 0.06
      }
    ],
    ...overrides
  };
}

test("quality records promote repeated accepted stable or improving evidence", () => {
  const artifact = buildLayerCompositionQualityRecords({
    qualityTrend: {
      runRoots: ["/tmp/run-a", "/tmp/run-b"],
      groups: [trendGroup()]
    }
  });

  assert.equal(artifact.artifactType, "layer_composition_quality_records_v1");
  assert.equal(artifact.recordCount, 1);
  assert.equal(artifact.durableCandidateCount, 1);
  const record = artifact.records[0];
  assert.equal(record.artifactType, "layer_composition_quality_record_v1");
  assert.equal(record.promotion.durableCandidate, true);
  assert.equal(record.sampleCount, 2);
  assert.deepEqual(record.targetScopes, ["submodel"]);
  assert.deepEqual(record.modelTypes, ["custom"]);
  assert.equal(record.quality.meanOverallQuality, 0.84);
  assert.equal(record.observedMetrics.meanActiveTargetNodeRatioPeak, 0.45);
  assert.equal(record.evidence.samples.length, 2);
});

test("quality records block single-run baseline evidence", () => {
  const artifact = buildLayerCompositionQualityRecords({
    qualityTrend: {
      groups: [trendGroup({
        sampleCount: 1,
        previousOverallQuality: null,
        trendStatus: "single_run_baseline",
        samples: [trendGroup().samples[0]]
      })]
    }
  });

  assert.equal(artifact.durableCandidateCount, 0);
  assert.equal(artifact.records[0].promotion.durableCandidate, false);
  assert.equal(artifact.records[0].promotion.blockers.includes("insufficient_repeated_quality_evidence"), true);
  assert.equal(artifact.records[0].promotion.blockers.includes("quality_trend_not_stable_or_improving"), true);
});

test("quality records block low or non-accepted evidence", () => {
  const artifact = buildLayerCompositionQualityRecords({
    qualityTrend: {
      groups: [
        trendGroup({ latestOverallQuality: 0.61 }),
        trendGroup({ key: "b", latestDecision: "revise" })
      ]
    }
  });

  assert.equal(artifact.durableCandidateCount, 0);
  assert.equal(artifact.records[0].promotion.blockers.includes("latest_quality_below_threshold"), true);
  assert.equal(artifact.records[1].promotion.blockers.includes("latest_review_not_accepted"), true);
});

test("quality records can be built from a trend file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-records-"));
  const trendPath = path.join(root, "quality-trend.json");
  const outPath = path.join(root, "quality-records.json");
  writeJson(trendPath, { runRoots: ["/tmp/run-a"], groups: [trendGroup()] });

  const artifact = buildLayerCompositionQualityRecords({ qualityTrendPath: trendPath, outPath });

  assert.equal(fs.existsSync(outPath), true);
  assert.equal(artifact.sourceQualityTrendRef, trendPath);
  assert.equal(artifact.durableCandidateCount, 1);
});
