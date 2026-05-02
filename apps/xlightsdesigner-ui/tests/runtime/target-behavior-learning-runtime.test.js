import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTargetBehaviorLearningRecord,
  buildTargetBehaviorLearningRecordsForApply,
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

test("target behavior learning records can be derived from applied effect commands", () => {
  const records = buildTargetBehaviorLearningRecordsForApply({
    commands: [
      { id: "effect-1", cmd: "effects.create", params: { modelName: "CustomFace/@Mouth", effectName: "On" } },
      { id: "timing-1", cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure" } }
    ],
    targetRecords: [
      {
        targetId: "CustomFace/@Mouth",
        targetKind: "submodel",
        identity: {
          fingerprint: "tmf1:mouth001",
          fingerprintVersion: "target-metadata-fingerprint-v1",
          displayName: "CustomFace / @Mouth",
          parentId: "CustomFace"
        },
        structure: {
          submodelMetadata: {
            parentId: "CustomFace",
            structureHints: ["feature_mouth"]
          }
        }
      }
    ],
    renderObservation: {
      artifactId: "render-1",
      macro: { coverageRead: "partial", temporalRead: "flat", activeCoverageRatio: 0.1 }
    },
    renderValidationEvidence: {
      renderObservationRef: "render-1",
      submodelEvidence: [
        {
          targetId: "CustomFace/@Mouth",
          siblingCount: 4,
          nodeCoverage: { nodeCount: 12, parentNodeCount: 200, ratio: 0.06 },
          structureHints: ["feature_mouth"]
        }
      ]
    },
    renderCritiqueContext: {
      observed: { coverageRead: "partial", temporalRead: "flat", activeCoverageRatio: 0.1 },
      quality: { band: "acceptable", issues: [] }
    },
    observedAt: "2026-05-01T12:00:00Z"
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].targetFingerprint, "tmf1:mouth001");
  assert.equal(records[0].effectName, "On");
  assert.equal(records[0].probeScope, "submodel");
  assert.equal(records[0].outcome.readability, "good");
  assert.equal(records[0].submodelContext.nodeCoverage.nodeCount, 12);
});
