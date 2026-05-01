import test from "node:test";
import assert from "node:assert/strict";

import { buildNormalizedTargetMetadataRecords } from "../../runtime/target-metadata-runtime.js";

function customModelSource() {
  return [
    ["", 1, ""],
    [2, "", 3],
    ["", 4, ""]
  ].map((row) => row.join(",")).join(";");
}

test("target metadata records include stable fingerprints for models groups and submodels", () => {
  const records = buildNormalizedTargetMetadataRecords({
    sceneGraph: {
      modelsById: {
        CustomFace: {
          id: "CustomFace",
          name: "CustomFace",
          displayAs: "Custom",
          attributes: { CustomModel: customModelSource(), PixelCount: "4" }
        }
      },
      groupsById: {
        Faces: {
          id: "Faces",
          name: "Faces",
          members: { flattened: [{ id: "CustomFace", name: "CustomFace" }] }
        }
      },
      submodelsById: {
        "CustomFace/@Eye": {
          id: "CustomFace/@Eye",
          name: "@Eye",
          parentId: "CustomFace",
          type: "ranges",
          line0: "2-3",
          membership: { nodeCount: 2 }
        }
      }
    }
  });

  const byId = new Map(records.map((row) => [row.targetId, row]));
  for (const targetId of ["CustomFace", "Faces", "CustomFace/@Eye"]) {
    assert.match(byId.get(targetId)?.identity?.fingerprint || "", /^tmf1:[0-9a-f]{8}$/);
    assert.equal(byId.get(targetId)?.identity?.fingerprintVersion, "target-metadata-fingerprint-v1");
  }
  assert.equal(byId.get("CustomFace")?.structure?.customStructure?.submodels?.count, 1);
});

test("target metadata custom fingerprints change when custom submodel construction changes", () => {
  const base = buildNormalizedTargetMetadataRecords({
    sceneGraph: {
      modelsById: {
        CustomFace: {
          id: "CustomFace",
          name: "CustomFace",
          displayAs: "Custom",
          attributes: { CustomModel: customModelSource() }
        }
      },
      submodelsById: {
        "CustomFace/@Eye": { id: "CustomFace/@Eye", name: "@Eye", parentId: "CustomFace", type: "ranges", line0: "2-3" }
      }
    }
  });
  const changed = buildNormalizedTargetMetadataRecords({
    sceneGraph: {
      modelsById: {
        CustomFace: {
          id: "CustomFace",
          name: "CustomFace",
          displayAs: "Custom",
          attributes: { CustomModel: customModelSource() }
        }
      },
      submodelsById: {
        "CustomFace/@Eye": { id: "CustomFace/@Eye", name: "@Eye", parentId: "CustomFace", type: "ranges", line0: "2-3" },
        "CustomFace/@Mouth": { id: "CustomFace/@Mouth", name: "@Mouth", parentId: "CustomFace", type: "ranges", line0: "4" }
      }
    }
  });

  assert.notEqual(base.find((row) => row.targetId === "CustomFace")?.identity?.fingerprint, changed.find((row) => row.targetId === "CustomFace")?.identity?.fingerprint);
});
