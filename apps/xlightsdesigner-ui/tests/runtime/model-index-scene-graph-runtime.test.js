import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSubmodelsByIdFromModelIndexTargetRecords,
  mergeModelIndexSubmodelsIntoSceneGraph,
  normalizeModelIndexArtifactSubmodels
} from "../../runtime/model-index-scene-graph-runtime.js";

const modelIndexArtifact = {
  artifactType: "target_metadata_index_v1",
  records: [
    {
      targetId: "Face/@Mouth",
      targetKind: "submodel",
      identity: {
        displayName: "Face / @Mouth",
        canonicalType: "submodel",
        fingerprint: "tmf1:mouth",
        fingerprintVersion: "target-metadata-fingerprint-v1",
        parentId: "Face",
        parentName: "Face"
      },
      structure: {
        nodeCount: 8,
        submodelMetadata: {
          name: "@Mouth",
          parentId: "Face",
          type: "ranges",
          siblingCount: 2,
          siblingIds: ["Face/@Eye"],
          nodeCoverage: { nodeCount: 8, parentNodeCount: 143, ratio: 0.0559 },
          structureHints: ["feature_mouth"]
        }
      }
    }
  ]
};

test("buildSubmodelsByIdFromModelIndexTargetRecords projects canonical submodel identity", () => {
  const records = normalizeModelIndexArtifactSubmodels(modelIndexArtifact);

  assert.equal(records["Face/@Mouth"].parentId, "Face");
  assert.equal(records["Face/@Mouth"].identity.fingerprint, "tmf1:mouth");
  assert.equal(records["Face/@Mouth"].nodeCoverage.nodeCount, 8);
  assert.deepEqual(records["Face/@Mouth"].structureHints, ["feature_mouth"]);
});

test("mergeModelIndexSubmodelsIntoSceneGraph preserves live membership while replacing identity", () => {
  const modelIndexRecords = [
    {
      targetId: "Face/@Mouth",
      targetKind: "submodel",
      identity: {
        displayName: "Face / @Mouth",
        fingerprint: "tmf1:mouth",
        fingerprintVersion: "target-metadata-fingerprint-v1",
        parentId: "Face"
      },
      structure: {
        submodelMetadata: {
          name: "@Mouth",
          parentId: "Face",
          nodeCoverage: { nodeCount: 8, parentNodeCount: 143, ratio: 0.0559 }
        }
      }
    }
  ];
  const sceneGraph = mergeModelIndexSubmodelsIntoSceneGraph({
    submodelsById: {
      "Face/@Mouth": {
        id: "Face/@Mouth",
        parentId: "",
        membership: { nodeChannels: [1, 2, 3] },
        renderPolicy: { bufferStyle: "Default" }
      }
    },
    stats: { submodelCount: 1 }
  }, modelIndexRecords);

  assert.equal(sceneGraph.submodelsById["Face/@Mouth"].parentId, "Face");
  assert.deepEqual(sceneGraph.submodelsById["Face/@Mouth"].membership.nodeChannels, [1, 2, 3]);
  assert.equal(sceneGraph.submodelsById["Face/@Mouth"].renderPolicy.bufferStyle, "Default");
  assert.equal(sceneGraph.submodelsById["Face/@Mouth"].identity.fingerprint, "tmf1:mouth");
});

test("buildSubmodelsByIdFromModelIndexTargetRecords ignores non-submodel records", () => {
  assert.deepEqual(buildSubmodelsByIdFromModelIndexTargetRecords([
    { targetId: "Tree", targetKind: "model", identity: { fingerprint: "tmf1:tree" } }
  ]), {});
});
