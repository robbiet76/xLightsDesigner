import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTargetBehaviorLearningRecord,
  upsertTargetBehaviorLearningRecord
} from "../../runtime/target-behavior-learning-runtime.js";

test("target behavior learning records are keyed by target fingerprint and effect scope", () => {
  const record = buildTargetBehaviorLearningRecord({
    targetRecord: {
      targetId: "Singing Face/@Mouth1",
      targetKind: "submodel",
      identity: {
        displayName: "Singing Face / @Mouth1",
        fingerprint: "tmf1:mouth123",
        fingerprintVersion: "target-metadata-fingerprint-v1",
        parentId: "Singing Face"
      },
      structure: {
        submodelMetadata: {
          structureHints: ["feature_mouth"]
        }
      }
    },
    effectName: "On",
    effectFamily: "fill",
    probeScope: "submodel",
    submodelEvidence: {
      siblingCount: 10,
      overlappingSiblingIds: ["Singing Face/@Mouth2"],
      nodeCoverage: { nodeCount: 8, parentNodeCount: 143, ratio: 0.0559 },
      structureHints: ["feature_mouth"]
    },
    renderObservation: {
      artifactId: "render-observation-1",
      macro: {
        coverageRead: "partial",
        temporalRead: "flat",
        activeCoverageRatio: 0.12
      }
    },
    outcome: {
      readability: "good",
      notes: ["Mouth reads cleanly."]
    },
    observedAt: "2026-05-01T12:00:00Z"
  });

  assert.equal(record.artifactType, "target_behavior_learning_record_v1");
  assert.match(record.recordId, /^tbl1:[0-9a-f]{8}$/);
  assert.equal(record.targetFingerprint, "tmf1:mouth123");
  assert.equal(record.probeScope, "submodel");
  assert.equal(record.outcome.coverageRead, "partial");
  assert.equal(record.outcome.readability, "good");
  assert.deepEqual(record.structureHints, ["feature_mouth"]);
});

test("target behavior learning document upserts compact aggregates", () => {
  const record = buildTargetBehaviorLearningRecord({
    targetIdentity: {
      targetId: "Spinner/Spoke 1",
      targetKind: "submodel",
      targetFingerprint: "tmf1:spoke001",
      fingerprintVersion: "target-metadata-fingerprint-v1",
      displayName: "Spinner / Spoke 1",
      parentId: "Spinner"
    },
    effectName: "Bars",
    effectFamily: "bars",
    probeScope: "submodel",
    outcome: { readability: "poor", coverageRead: "sparse" },
    observedAt: "2026-05-01T12:00:00Z"
  });

  const first = upsertTargetBehaviorLearningRecord(null, record, { now: "2026-05-01T12:00:00Z" });
  const second = upsertTargetBehaviorLearningRecord(first, {
    ...record,
    outcome: { ...record.outcome, readability: "good" },
    observedAt: "2026-05-01T12:05:00Z"
  }, { now: "2026-05-01T12:05:00Z" });

  assert.equal(second.artifactType, "project_target_behavior_learning_v1");
  assert.equal(second.records.length, 1);
  assert.equal(second.records[0].stats.sampleCount, 2);
  assert.equal(second.records[0].stats.negativeCount, 1);
  assert.equal(second.records[0].stats.positiveCount, 1);
  assert.equal(second.records[0].stats.lastObservedAt, "2026-05-01T12:05:00Z");
});
