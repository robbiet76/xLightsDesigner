import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildProductionScorerCalibrationDiagnostics } from "./build-production-scorer-calibration-diagnostics.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test("production scorer diagnostics flags saturated and compressed score dimensions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-scorer-diagnostics-"));
  const baselinePath = path.join(root, "baseline.json");
  const outPath = path.join(root, "diagnostics.json");
  writeJson(baselinePath, {
    artifactType: "production_video_calibration_baseline_v1",
    summary: { acceptedReferenceCount: 3 },
    scoreRanges: {
      visualReadability: { count: 3, min: 1, mean: 1, max: 1 },
      colorDiscipline: { count: 3, min: 0.1, mean: 0.12, max: 0.14 },
      overallQuality: { count: 3, min: 0.84, mean: 0.87, max: 0.9 }
    },
    metricRanges: {
      temporalMotionMean: { count: 3, min: 0.052, mean: 0.0525, max: 0.053 }
    },
    references: [
      {
        sequenceId: "LowColor",
        overallQuality: 0.84,
        scores: { colorDiscipline: 0.1, overallQuality: 0.84 },
        metrics: { activeColorClassMean: 1, temporalColorDeltaMean: 0.002 },
        features: { meanSampledFrameActiveUniqueColorCount: 200, meanSampledFrameActiveColorClassCount: 7 }
      },
      {
        sequenceId: "HighColor",
        overallQuality: 0.9,
        scores: { colorDiscipline: 0.14, overallQuality: 0.9 },
        metrics: { activeColorClassMean: 0.8, temporalColorDeltaMean: 0.001 },
        features: { meanSampledFrameActiveUniqueColorCount: 60, meanSampledFrameActiveColorClassCount: 4 }
      }
    ]
  });

  const artifact = buildProductionScorerCalibrationDiagnostics({ baselinePath, outPath });

  assert.equal(artifact.artifactType, "production_scorer_calibration_diagnostics_v1");
  assert.equal(artifact.status, "scorer_calibration_needed");
  assert.equal(artifact.policy.doNotOptimizeGenerationDirectlyAgainstCurrentScores, true);
  assert.equal(artifact.summary.highSeverityScoreFindingCount, 2);
  assert.equal(artifact.scoreFindings.some((row) => row.dimension === "visualReadability" && row.status === "saturated_high"), true);
  assert.equal(artifact.scoreFindings.some((row) => row.dimension === "colorDiscipline" && row.status === "compressed_low"), true);
  assert.equal(artifact.metricFindings.some((row) => row.metric === "temporalMotionMean"), true);
  assert.deepEqual(artifact.dimensionExamples.lowestColorDiscipline.map((row) => row.sequenceId), ["LowColor", "HighColor"]);
  assert.equal(fs.existsSync(outPath), true);
});
