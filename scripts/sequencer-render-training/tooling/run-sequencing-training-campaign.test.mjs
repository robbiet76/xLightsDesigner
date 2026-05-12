import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runSequencingTrainingCampaign } from "./run-sequencing-training-campaign.mjs";

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "xld-quality-campaign-test-"));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function campaignSpec(root, overrides = {}) {
  const specPath = path.join(root, "campaign.json");
  writeJson(specPath, {
    artifactType: "sequencing_quality_training_campaign_v1",
    artifactVersion: 1,
    campaignId: "test-campaign",
    status: "active",
    campaignPhases: [
      {
        phaseId: "phase-a",
        status: "in_progress",
        jobRefs: [
          path.join(root, "job-a.json"),
          path.join(root, "job-b.json")
        ]
      },
      {
        phaseId: "phase-b",
        status: "planned",
        jobRefs: [
          path.join(root, "job-c.json")
        ]
      }
    ],
    retentionPolicy: {
      diskGuardrail: {
        minimumFreeGiB: 0
      }
    },
    ...overrides
  });
  return specPath;
}

function jobSummary({ jobId, outRoot, latestRunRoot, baselineRoot, previousStateRef, stopReason = "major_chunk_complete_strategy_exhausted", interventionRecommended = false } = {}) {
  return {
    artifactType: "sequencing_quality_unattended_run_summary_v1",
    artifactVersion: 1,
    status: "stopped",
    stopReason,
    majorChunkStatus: stopReason.startsWith("major_chunk_complete_") ? "complete" : "incomplete",
    trainingJob: {
      jobId,
      chunkId: `${jobId}-chunk`
    },
    outRoot,
    latestRunRoot,
    videoComparisonBaselineRunRoot: baselineRoot,
    previousStateRef,
    iterationCount: 1,
    interventionRecommended,
    iterations: [{
      iteration: 1,
      selectedGoalId: `${jobId}.goal`,
      overallAestheticScore: 0.8,
      comparisonStatus: "neutral",
      consolidation: {
        selectorReadyPriorCount: 3,
        deletedPreviewFrameCount: 4
      }
    }]
  };
}

test("campaign runner chains job slices and writes campaign summary", async () => {
  const root = tempDir();
  const specPath = campaignSpec(root);
  const calls = [];
  const summary = await runSequencingTrainingCampaign({
    campaignSpecPath: specPath,
    latestRunRoot: path.join(root, "seed-loop"),
    videoComparisonBaselineRunRoot: path.join(root, "seed-video"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: path.join(root, "campaign-runs"),
    maxJobSlices: 2,
    notify: false,
    deps: {
      runJob: async (args) => {
        calls.push(args);
        const index = calls.length;
        return jobSummary({
          jobId: `job-${index}`,
          outRoot: path.join(root, `job-${index}`),
          latestRunRoot: path.join(root, `loop-${index}`),
          baselineRoot: path.join(root, `video-${index}`),
          previousStateRef: path.join(root, `controller-${index}.json`)
        });
      }
    }
  });

  assert.equal(summary.artifactType, "sequencing_quality_training_campaign_run_summary_v1");
  assert.equal(summary.status, "complete");
  assert.equal(summary.stopReason, "planned_job_slices_complete");
  assert.equal(summary.completedJobSliceCount, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].latestRunRoot, path.join(root, "seed-loop"));
  assert.equal(calls[1].latestRunRoot, path.join(root, "loop-1"));
  assert.equal(calls[1].previousStatePath, path.join(root, "controller-1.json"));
  assert.equal(summary.latestRunRoot, path.join(root, "loop-2"));
  assert.equal(summary.jobSlices[0].selectorReadyPriorCount, 3);
  assert.equal(summary.jobSlices[1].deletedPreviewFrameCount, 4);
  assert.equal(fs.existsSync(summary.summaryRef), true);
  assert.equal(JSON.parse(fs.readFileSync(summary.summaryRef, "utf8")).status, "complete");
});

test("campaign runner stops when a job slice recommends intervention", async () => {
  const root = tempDir();
  const specPath = campaignSpec(root);
  const summary = await runSequencingTrainingCampaign({
    campaignSpecPath: specPath,
    latestRunRoot: path.join(root, "seed-loop"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: path.join(root, "campaign-runs"),
    maxJobSlices: 2,
    notify: false,
    deps: {
      runJob: async () => jobSummary({
        jobId: "job-stop",
        outRoot: path.join(root, "job-stop"),
        latestRunRoot: path.join(root, "loop-stop"),
        baselineRoot: path.join(root, "loop-stop"),
        previousStateRef: path.join(root, "controller-stop.json"),
        stopReason: "max_consecutive_regressions",
        interventionRecommended: true
      })
    }
  });

  assert.equal(summary.status, "stopped");
  assert.equal(summary.stopReason, "max_consecutive_regressions");
  assert.equal(summary.interventionRecommended, true);
  assert.equal(summary.completedJobSliceCount, 1);
});

test("campaign runner applies disk guardrail before starting a slice", async () => {
  const root = tempDir();
  const specPath = campaignSpec(root, {
    retentionPolicy: {
      diskGuardrail: {
        minimumFreeGiB: 15
      }
    }
  });
  let runJobCalled = false;
  const summary = await runSequencingTrainingCampaign({
    campaignSpecPath: specPath,
    latestRunRoot: path.join(root, "seed-loop"),
    previousStatePath: path.join(root, "seed-controller.json"),
    outRoot: path.join(root, "campaign-runs"),
    maxJobSlices: 1,
    notify: false,
    deps: {
      freeGiBForPath: () => 1,
      runJob: async () => {
        runJobCalled = true;
        return {};
      }
    }
  });

  assert.equal(summary.status, "stopped");
  assert.equal(summary.stopReason, "disk_guardrail");
  assert.equal(summary.interventionRecommended, true);
  assert.equal(summary.completedJobSliceCount, 0);
  assert.equal(runJobCalled, false);
});

test("campaign runner writes error summary when a slice throws", async () => {
  const root = tempDir();
  const specPath = campaignSpec(root);
  let capturedError = null;
  await assert.rejects(
    () => runSequencingTrainingCampaign({
      campaignSpecPath: specPath,
      latestRunRoot: path.join(root, "seed-loop"),
      previousStatePath: path.join(root, "seed-controller.json"),
      outRoot: path.join(root, "campaign-runs"),
      maxJobSlices: 1,
      notify: false,
      deps: {
        runJob: async () => {
          throw new Error("slice failed");
        }
      }
    }),
    (error) => {
      capturedError = error;
      return /slice failed/.test(error.message);
    }
  );
  assert.equal(capturedError.campaignSummary.status, "error");
  assert.equal(capturedError.campaignSummary.stopReason, "campaign_error");
  assert.equal(fs.existsSync(capturedError.campaignSummary.summaryRef), true);
});
