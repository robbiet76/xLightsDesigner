import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveRevisionFeedbackFromPlanMetadata,
  resolveRevisionFeedbackFromSnapshots,
  resolveRevisionRetryPressureFromPlanMetadata,
  resolveRevisionRetryPressureFromSnapshots
} from "../../runtime/compact-plan-metadata.js";

test("compact plan metadata resolver preserves expanded revision artifacts", () => {
  const retry = { artifactType: "revision_retry_pressure_v1", artifactId: "retry-expanded", signals: ["expanded"] };
  const feedback = { artifactType: "revision_feedback_v1", artifactId: "feedback-expanded", status: "stable" };
  const metadata = {
    revisionRetryPressure: retry,
    revisionFeedback: feedback,
    generativeSummary: {
      retry: { signals: ["compact"] },
      feedback: { status: "revise_required" }
    }
  };

  assert.equal(resolveRevisionRetryPressureFromPlanMetadata(metadata), retry);
  assert.equal(resolveRevisionFeedbackFromPlanMetadata(metadata), feedback);
});

test("compact plan metadata resolver synthesizes retry pressure from generative summary", () => {
  const resolved = resolveRevisionRetryPressureFromPlanMetadata({
    generativeSummary: {
      refs: {
        candidateSelectionRef: "candidate-selection-1",
        revisionDeltaRef: "revision-delta-1"
      },
      retry: {
        signals: ["low_change_retry"],
        oscillatingCandidateIds: ["candidate-base"]
      }
    }
  });

  assert.equal(resolved.artifactType, "revision_retry_pressure_v1");
  assert.equal(resolved.source.candidateSelectionRef, "candidate-selection-1");
  assert.deepEqual(resolved.signals, ["low_change_retry"]);
  assert.deepEqual(resolved.oscillation.candidateIds, ["candidate-base"]);
  assert.equal(typeof resolved.artifactId, "string");
});

test("compact plan metadata resolver synthesizes feedback from generative summary", () => {
  const resolved = resolveRevisionFeedbackFromPlanMetadata({
    generativeSummary: {
      refs: {
        sequenceArtisticGoalRef: "goal-1",
        sequenceRevisionObjectiveRef: "objective-1",
        revisionRetryPressureRef: "retry-1"
      },
      retry: {
        signals: ["low_change_retry"],
        oscillatingCandidateIds: ["candidate-base"]
      },
      feedback: {
        status: "revise_required",
        rejectionReasons: ["lead_mismatch"],
        executionObjective: "Restore the lead focus.",
        artisticCorrection: "Make the lead readable."
      }
    }
  });

  assert.equal(resolved.artifactType, "revision_feedback_v1");
  assert.equal(resolved.status, "revise_required");
  assert.equal(resolved.source.sequenceArtisticGoalRef, "goal-1");
  assert.deepEqual(resolved.rejectionReasons, ["lead_mismatch"]);
  assert.deepEqual(resolved.retryPressure.signals, ["low_change_retry"]);
  assert.equal(resolved.nextDirection.executionObjective, "Restore the lead focus.");
  assert.equal(typeof resolved.artifactId, "string");
});

test("compact plan metadata snapshot resolver returns first available compact revision state", () => {
  const first = { planHandoff: { metadata: {} } };
  const second = {
    planHandoff: {
      metadata: {
        generativeSummary: {
          retry: { signals: ["second_retry"] },
          feedback: { status: "revise_required" }
        }
      }
    }
  };

  assert.deepEqual(resolveRevisionRetryPressureFromSnapshots(first, second).signals, ["second_retry"]);
  assert.equal(resolveRevisionFeedbackFromSnapshots(first, second).status, "revise_required");
});
