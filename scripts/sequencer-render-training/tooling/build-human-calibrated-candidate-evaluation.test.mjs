import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildHumanCalibratedCandidateEvaluation } from "./build-human-calibrated-candidate-evaluation.mjs";

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function humanReview(sequenceId, choices) {
  return {
    sequenceId,
    status: "reviewed",
    recommendation: "approve",
    metricChoices: choices
  };
}

test("buildHumanCalibratedCandidateEvaluation compares generated candidates to human target bands", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-human-calibrated-candidate-"));
  const humanPath = path.join(root, "human.json");
  const alignmentPath = path.join(root, "alignment.json");
  const candidatePath = path.join(root, "candidate", "video-aesthetic-score.json");
  const outPath = path.join(root, "candidate-evaluation.json");

  writeJson(humanPath, {
    artifactType: "production_human_review_calibration_v1",
    status: "approved",
    reviews: [
      humanReview("Strong", {
        energyArc: "excellent_dynamic_arc",
        sectionContrast: "excellent_section_identity",
        paletteEvolution: "excellent_color_story",
        focalHandoff: "excellent_focus_direction",
        targetHierarchy: "excellent_layer_hierarchy",
        overallFit: "excellent_reference"
      }),
      humanReview("Good", {
        energyArc: "good_with_minor_flat_spots",
        sectionContrast: "good_some_repetition",
        paletteEvolution: "good_palette_minor_noise",
        focalHandoff: "good_focus_some_static",
        targetHierarchy: "good_hierarchy_minor_competition",
        overallFit: "good_reference"
      })
    ]
  });

  writeJson(alignmentPath, {
    artifactType: "production_human_scorer_alignment_v1",
    policy: { generatedTrainingMayUseHumanTargets: true },
    metricAlignments: [
      { metric: "energyArc", status: "aligned" },
      { metric: "sectionContrast", status: "partially_aligned" },
      { metric: "paletteEvolution", status: "partially_aligned" },
      { metric: "focalHandoff", status: "weak_alignment" },
      { metric: "targetHierarchy", status: "weak_alignment" },
      { metric: "overallFit", status: "weak_alignment" }
    ]
  });

  writeJson(candidatePath, {
    artifactType: "video_aesthetic_score_v1",
    status: "ready",
    metricScope: "section_render",
    contextMetricScope: "full_sequence_render",
    candidateId: "generated-001",
    scores: {
      displayEvolution: 0.9,
      narrativeShape: 0.92,
      pacingVariety: 0.82,
      transitionFlow: 0.8,
      palettePurposeCoverage: 0.86,
      colorDiscipline: 0.78,
      focalHandoffStability: 0.62,
      focalClarity: 0.7,
      visualBalance: 0.68,
      localEvidenceReadability: 0.72,
      overallAestheticScore: 0.84
    }
  });

  const artifact = buildHumanCalibratedCandidateEvaluation({
    humanCalibrationPath: humanPath,
    alignmentPath,
    candidatePaths: [candidatePath],
    outPath
  });

  assert.equal(artifact.artifactType, "human_calibrated_candidate_evaluation_v1");
  assert.equal(artifact.status, "ready");
  assert.equal(artifact.summary.candidateCount, 1);
  assert.equal(artifact.summary.optimizationMetricEvaluations, 1);
  assert.equal(artifact.summary.guardrailMetricEvaluations, 2);
  assert.equal(artifact.summary.diagnosticMetricEvaluations, 3);
  assert.equal(artifact.candidateEvaluations[0].candidateId, "generated-001");
  assert.equal(artifact.candidateEvaluations[0].metricScope, "section_render");
  assert.equal(artifact.candidateEvaluations[0].contextMetricScope, "full_sequence_render");
  assert.deepEqual(artifact.candidateEvaluations[0].blockers, []);
  assert.equal(artifact.candidateEvaluations[0].metricEvaluations.find((row) => row.metric === "energyArc").evaluationUse, "optimization_support");
  assert.equal(artifact.candidateEvaluations[0].metricEvaluations.find((row) => row.metric === "focalHandoff").evaluationUse, "diagnostic_only");
  assert.equal(fs.existsSync(outPath), true);
});

test("buildHumanCalibratedCandidateEvaluation blocks unapproved calibration and section-scope candidates", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-human-calibrated-candidate-blocked-"));
  const humanPath = path.join(root, "human.json");
  const alignmentPath = path.join(root, "alignment.json");
  const candidatePath = path.join(root, "candidate", "video-aesthetic-score.json");

  writeJson(humanPath, {
    artifactType: "production_human_review_calibration_v1",
    status: "human_review_pending",
    reviews: []
  });
  writeJson(alignmentPath, {
    artifactType: "production_human_scorer_alignment_v1",
    policy: { generatedTrainingMayUseHumanTargets: false },
    metricAlignments: [{ metric: "energyArc", status: "aligned" }]
  });
  writeJson(candidatePath, {
    artifactType: "video_aesthetic_score_v1",
    metricScope: "section_render",
    scores: { displayEvolution: 0.9 }
  });

  const artifact = buildHumanCalibratedCandidateEvaluation({
    humanCalibrationPath: humanPath,
    alignmentPath,
    candidatePaths: [candidatePath]
  });

  assert.equal(artifact.status, "blocked");
  assert.equal(artifact.candidateEvaluations[0].status, "blocked");
  assert.deepEqual(artifact.candidateEvaluations[0].blockers, [
    "human_calibration_not_approved",
    "candidate_not_full_sequence_scope"
  ]);
});
