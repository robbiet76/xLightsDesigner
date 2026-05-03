import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTargetBehaviorLearningRecord,
  buildTargetBehaviorLearningRecordsForApply,
  normalizeModelIndexTargetRecords,
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

test("target behavior learning key stays stable when submodel metadata becomes richer", () => {
  const base = buildTargetBehaviorLearningRecord({
    targetRecord: {
      targetId: "CustomFace/@Mouth",
      targetKind: "submodel",
      identity: {
        fingerprint: "tmf1:mouth001",
        fingerprintVersion: "target-metadata-fingerprint-v1",
        displayName: "CustomFace / @Mouth"
      },
      structure: {}
    },
    effectName: "On",
    observedAt: "2026-05-01T12:00:00Z"
  });
  const enriched = buildTargetBehaviorLearningRecord({
    targetRecord: {
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
          structureHints: ["feature_mouth"],
          nodeCoverage: { nodeCount: 12, parentNodeCount: 200, ratio: 0.06 }
        }
      }
    },
    effectName: "On",
    observedAt: "2026-05-01T12:05:00Z"
  });

  assert.equal(enriched.recordId, base.recordId);
  assert.equal(enriched.parentId, "CustomFace");
  assert.equal(enriched.submodelContext.nodeCoverage.nodeCount, 12);
  assert.deepEqual(enriched.structureHints, ["feature_mouth"]);
});

test("target behavior learning upsert consolidates legacy duplicate records by semantic identity", () => {
  const incoming = buildTargetBehaviorLearningRecord({
    targetRecord: {
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
          nodeCoverage: { nodeCount: 12, parentNodeCount: 200, ratio: 0.06 }
        }
      }
    },
    effectName: "On",
    outcome: { readability: "poor" },
    observedAt: "2026-05-01T12:10:00Z"
  });
  const document = upsertTargetBehaviorLearningRecord({
    artifactType: "project_target_behavior_learning_v1",
    artifactVersion: "1.0",
    records: [
      {
        recordId: "tbl1:legacy-empty",
        targetId: "CustomFace/@Mouth",
        targetKind: "submodel",
        targetFingerprint: "tmf1:mouth001",
        effectName: "On",
        effectFamily: "On",
        probeScope: "submodel",
        stats: { sampleCount: 1, positiveCount: 0, negativeCount: 1 }
      },
      {
        recordId: "tbl1:legacy-rich",
        targetId: "CustomFace/@Mouth",
        targetKind: "submodel",
        targetFingerprint: "tmf1:mouth001",
        effectName: "On",
        effectFamily: "On",
        probeScope: "submodel",
        stats: { sampleCount: 2, positiveCount: 1, negativeCount: 1 }
      }
    ]
  }, incoming, { now: "2026-05-01T12:10:00Z" });

  assert.equal(document.records.length, 1);
  assert.equal(document.records[0].recordId, incoming.recordId);
  assert.equal(document.records[0].parentId, "CustomFace");
  assert.equal(document.records[0].stats.sampleCount, 4);
  assert.equal(document.records[0].stats.positiveCount, 1);
  assert.equal(document.records[0].stats.negativeCount, 3);
});

test("target behavior learning records can be derived from applied effect commands", () => {
  const records = buildTargetBehaviorLearningRecordsForApply({
    commands: [
      { id: "effect-1", cmd: "effects.create", params: { modelName: "CustomFace/@Mouth", effectName: "On" } },
      { id: "timing-1", cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure" } }
    ],
    targetRecords: [
      {
        targetId: "CustomFace",
        targetKind: "model",
        identity: {
          displayName: "Custom Face",
          rawType: "Custom",
          canonicalType: "custom",
          fingerprint: "tmf1:custom-face",
          fingerprintVersion: "target-metadata-fingerprint-v1"
        },
        structure: {
          customStructure: {
            profile: "custom_face_like",
            traits: ["custom_face_like", "face_submodels"],
            confidence: 0.75,
            nodeCount: 143,
            submodels: { count: 8 },
            construction: {
              source: "layout.getModelNodes",
              dimensions: { width: 16, height: 12, layers: 1 }
            }
          }
        }
      },
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
  assert.equal(records[0].parentContext.targetFingerprint, "tmf1:custom-face");
  assert.equal(records[0].parentContext.customStructure.profile, "custom_face_like");
  assert.deepEqual(records[0].parentContext.customStructure.traits, ["custom_face_like", "face_submodels"]);
  assert.equal(records[0].parentContext.customStructure.submodelCount, 8);
});

test("model index target normalization preserves submodel identity parent fields", () => {
  const records = normalizeModelIndexTargetRecords({
    artifactType: "target_metadata_index_v1",
    records: [
      {
        targetId: "CustomFace/@Mouth",
        targetKind: "submodel",
        identity: {
          displayName: "CustomFace / @Mouth",
          canonicalType: "submodel",
          fingerprint: "tmf1:mouth001",
          fingerprintVersion: "target-metadata-fingerprint-v1",
          parentId: "CustomFace",
          parentName: "CustomFace"
        },
        structure: {
          submodelMetadata: {
            parentId: "CustomFace",
            structureHints: ["feature_mouth"]
          }
        }
      }
    ]
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].identity.parentId, "CustomFace");
  assert.equal(records[0].identity.parentName, "CustomFace");
  assert.equal(records[0].identity.fingerprint, "tmf1:mouth001");
});
