import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  analyzeCustomModelStructure,
  mapClassificationToTrainedModelProfiles
} from "../../runtime/custom-model-structure.js";
import { buildNormalizedTargetMetadataRecords } from "../../runtime/target-metadata-runtime.js";
import {
  parseXLightsRgbEffectsCustomModelSceneGraph,
  parseXmlAttributes
} from "../../runtime/custom-model-xml.js";
import { classifyModelDisplayType } from "../../agent/sequence-agent/model-type-catalog.js";

function grid(rows) {
  return rows.map((row) => row.join(",")).join(";");
}

test("analyzeCustomModelStructure promotes dense custom grids as matrix-like", () => {
  let node = 1;
  const source = grid(Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => node++)
  ));

  const out = analyzeCustomModelStructure({ CustomModel: source });

  assert.equal(out.profile, "custom_matrix_like");
  assert.equal(out.construction.dimensions.width, 8);
  assert.equal(out.construction.dimensions.height, 8);
});

test("analyzeCustomModelStructure promotes elongated custom grids as linear-like", () => {
  const source = grid([
    [1, "", ""],
    [2, "", ""],
    [3, "", ""],
    [4, "", ""],
    [5, "", ""],
    [6, "", ""]
  ]);

  const out = analyzeCustomModelStructure({ CustomModel: source });
  const profiles = mapClassificationToTrainedModelProfiles(classifyModelDisplayType("Custom"), out);

  assert.equal(out.profile, "custom_linear_like");
  assert.ok(out.traits.includes("continuous_node_path"));
  assert.deepEqual(profiles.sort(), []);
});

test("analyzeCustomModelStructure promotes sparse radial custom grids cautiously", () => {
  const source = grid([
    ["", "", "", 1, "", "", ""],
    ["", 2, "", "", "", 3, ""],
    ["", "", "", "", "", "", ""],
    [4, "", "", "", "", "", 5],
    ["", "", "", "", "", "", ""],
    ["", 6, "", "", "", 7, ""],
    ["", "", "", 8, "", "", ""]
  ]);

  const out = analyzeCustomModelStructure({ CustomModel: source });
  const profiles = mapClassificationToTrainedModelProfiles(classifyModelDisplayType("Custom"), out);

  assert.equal(out.profile, "custom_radial_like");
  assert.ok(out.traits.includes("radial_like"));
  assert.deepEqual(profiles.sort(), []);
});

test("analyzeCustomModelStructure derives construction from API model nodes", () => {
  const out = analyzeCustomModelStructure({
    customNodeLayout: {
      nodes: [
        { nodeId: 1, coords: [{ buffer: { x: 1, y: 0 } }] },
        { nodeId: 2, coords: [{ buffer: { x: 1, y: 1 } }] },
        { nodeId: 3, coords: [{ buffer: { x: 1, y: 2 } }] },
        { nodeId: 4, coords: [{ buffer: { x: 1, y: 3 } }] },
        { nodeId: 5, coords: [{ buffer: { x: 1, y: 4 } }] }
      ]
    }
  });

  assert.equal(out.profile, "custom_linear_like");
  assert.equal(out.construction.source, "layout.getModelNodes");
  assert.ok(out.traits.includes("api_node_layout"));
  assert.equal(out.nodeOrder.nodeCount, 5);
  assert.equal(out.construction.nodeMap.nodeCount, 5);
  assert.equal(out.construction.nodeMap.coordinateSourceCounts.buffer, 5);
  assert.deepEqual(out.construction.nodeMap.firstNodes[0], {
    node: 1,
    row: 0,
    col: 0,
    layer: 0,
    coordinateSource: "buffer"
  });
});

test("analyzeCustomModelStructure prefers API node layout when CustomModel grid is also present", () => {
  const out = analyzeCustomModelStructure({
    CustomModel: grid([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
      [9, 10, 11, 12],
      [13, 14, 15, 16]
    ]),
    customNodeLayout: {
      data: {
        modelNodes: [
          { nodeId: 1, coords: [{ buffer: { x: 0, y: 0 } }] },
          { nodeId: 2, coords: [{ buffer: { x: 0, y: 1 } }] },
          { nodeId: 3, coords: [{ buffer: { x: 0, y: 2 } }] },
          { nodeId: 4, coords: [{ buffer: { x: 0, y: 3 } }] }
        ]
      }
    }
  });

  assert.equal(out.construction.source, "layout.getModelNodes");
  assert.equal(out.nodeCount, 4);
  assert.equal(out.construction.dimensions.width, 1);
  assert.equal(out.construction.dimensions.height, 4);
  assert.equal(out.construction.nodeMap.nodeCount, 4);
});

test("analyzeCustomModelStructure uses face submodels to identify character customs", () => {
  const source = grid([
    ["", "", 1, "", ""],
    ["", 2, "", 3, ""],
    ["", "", "", "", ""],
    [4, "", "", "", 5],
    ["", "", 6, "", ""]
  ]);

  const out = analyzeCustomModelStructure(
    { CustomModel: source },
    {
      submodels: [
        { name: "@Eye-Left", type: "ranges", line0: "2" },
        { name: "@Eye-Right", type: "ranges", line0: "3" },
        { name: "@Mouth1", type: "ranges", line0: "4-5" }
      ]
    }
  );

  assert.equal(out.profile, "custom_face_like");
  assert.ok(out.traits.includes("face_submodels"));
  assert.equal(out.submodels.count, 3);
});

test("mapClassificationToTrainedModelProfiles treats Tree 180 as tree-compatible", () => {
  const profiles = mapClassificationToTrainedModelProfiles(classifyModelDisplayType("Tree 180"));

  assert.ok(profiles.includes("tree_flat"));
  assert.ok(profiles.includes("tree_360"));
});

test("vendor custom model structure capture preserves submodel construction signals", () => {
  const xml = fs.readFileSync(
    new URL("../../../../render-training-vendor-fixture/xlights_rgbeffects.xml", import.meta.url),
    "utf8"
  );
  const sceneGraph = parseXLightsRgbEffectsCustomModelSceneGraph(xml);
  const records = buildNormalizedTargetMetadataRecords({ sceneGraph });
  const customModels = records
    .filter((row) => row?.targetKind === "model" && row?.structure?.customStructure)
    .map((row) => row.structure.customStructure);

  assert.equal(customModels.length, 19);

  const faceLike = customModels.find((row) => row.profile === "custom_face_like" && row.submodels.count >= 2);
  assert.ok(faceLike);
  assert.equal(faceLike.construction.nodeMap.nodeCount, faceLike.nodeOrder.nodeCount);
  assert.equal(faceLike.construction.nodeMap.firstNodes[0].coordinateSource, "grid");

  const radialWithSubmodels = customModels.find((row) =>
    row.profile === "custom_radial_like"
    && row.traits.includes("custom_radial_submodels")
    && row.submodels.count >= 4
  );
  assert.ok(radialWithSubmodels);

  const layered = customModels.find((row) => row.traits.includes("layered_submodels"));
  assert.ok(layered);
  assert.ok(layered.submodels.count >= 2);
});

test("target metadata captures custom model structure inside the shared model index", () => {
  const sceneGraph = {
    modelsById: {
      CustomTargetA: {
        id: "CustomTargetA",
        name: "Custom Target A",
        displayAs: "Custom",
        attributes: {
          CustomModel: grid([
            ["", 1, ""],
            [2, "", 3],
            ["", 4, ""]
          ])
        }
      },
      Matrix: {
        id: "Matrix",
        name: "Matrix",
        displayAs: "Horiz Matrix"
      }
    },
    submodelsById: {
      "CustomTargetA/@Eye": { id: "CustomTargetA/@Eye", name: "@Eye", parentId: "CustomTargetA", type: "ranges", line0: "2-3" },
      "CustomTargetA/@Mouth": { id: "CustomTargetA/@Mouth", name: "@Mouth", parentId: "CustomTargetA", type: "ranges", line0: "4" }
    }
  };
  const records = buildNormalizedTargetMetadataRecords({ sceneGraph });
  const customRecord = records.find((row) => row.targetId === "CustomTargetA");

  assert.equal(customRecord.structure.submodelCount, 2);
  assert.equal(customRecord.structure.customStructure.profile, "custom_face_like");
  assert.match(customRecord.identity.fingerprint, /^tmf1:[0-9a-f]{8}$/);
  assert.equal(records.filter((row) => row?.structure?.customStructure).length, 1);
});

test("target metadata fingerprints include custom submodel construction", () => {
  const baseSceneGraph = {
    modelsById: {
      CustomTargetA: {
        id: "CustomTargetA",
        name: "Custom Target A",
        displayAs: "Custom",
        attributes: {
          CustomModel: grid([
            ["", 1, ""],
            [2, "", 3],
            ["", 4, ""]
          ])
        }
      }
    },
    submodelsById: {
      "CustomTargetA/@Eye": { id: "CustomTargetA/@Eye", name: "@Eye", parentId: "CustomTargetA", type: "ranges", line0: "2-3" }
    }
  };
  const changedSceneGraph = {
    ...baseSceneGraph,
    submodelsById: {
      ...baseSceneGraph.submodelsById,
      "CustomTargetA/@Mouth": { id: "CustomTargetA/@Mouth", name: "@Mouth", parentId: "CustomTargetA", type: "ranges", line0: "4" }
    }
  };

  const base = buildNormalizedTargetMetadataRecords({ sceneGraph: baseSceneGraph }).find((row) => row.targetId === "CustomTargetA");
  const changed = buildNormalizedTargetMetadataRecords({ sceneGraph: changedSceneGraph }).find((row) => row.targetId === "CustomTargetA");

  assert.notEqual(base.identity.fingerprint, changed.identity.fingerprint);
});

test("target metadata custom structure fingerprints survive model renames", () => {
  const baseSceneGraph = {
    modelsById: {
      CustomTargetA: {
        id: "CustomTargetA",
        name: "Custom Target A",
        displayAs: "Custom",
        attributes: {
          CustomModel: grid([
            ["", 1, ""],
            [2, "", 3],
            ["", 4, ""]
          ])
        }
      }
    }
  };
  const renamedSceneGraph = {
    modelsById: {
      RenamedTargetA: {
        ...baseSceneGraph.modelsById.CustomTargetA,
        id: "RenamedTargetA",
        name: "Renamed Target A"
      }
    }
  };

  const base = buildNormalizedTargetMetadataRecords({ sceneGraph: baseSceneGraph }).find((row) => row.targetId === "CustomTargetA");
  const renamed = buildNormalizedTargetMetadataRecords({ sceneGraph: renamedSceneGraph }).find((row) => row.targetId === "RenamedTargetA");

  assert.equal(base.identity.fingerprint, renamed.identity.fingerprint);
});

test("parseXmlAttributes decodes quoted XML attributes", () => {
  const attrs = parseXmlAttributes(`name="Custom &quot;Target&quot;" DisplayAs='Custom' CustomModel="1,2&amp;3"`);

  assert.equal(attrs.name, `Custom "Target"`);
  assert.equal(attrs.DisplayAs, "Custom");
  assert.equal(attrs.CustomModel, "1,2&3");
});

test("parseXLightsRgbEffectsCustomModelSceneGraph extracts custom models and submodels", () => {
  const xml = `
    <xrgb>
      <models>
        <model name="Custom Target A" DisplayAs="Custom" CustomModel="1,-1,2;3,-1,4">
          <faceInfo mouth="enabled" eyes="enabled" />
          <subModel name="@Eye-Left" type="ranges" line0="1" />
          <subModel name="@Mouth1" type="ranges" line0="3-4" />
        </model>
        <model name="Matrix" DisplayAs="Horiz Matrix" />
      </models>
    </xrgb>
  `;
  const sceneGraph = parseXLightsRgbEffectsCustomModelSceneGraph(xml);
  const records = buildNormalizedTargetMetadataRecords({ sceneGraph });
  const customRecord = records.find((row) => row.targetId === "Custom Target A");

  assert.equal(Object.keys(sceneGraph.modelsById).length, 2);
  assert.equal(Object.keys(sceneGraph.submodelsById).length, 2);
  assert.equal(sceneGraph.modelsById["Custom Target A"].attributes.CustomModel, "1,-1,2;3,-1,4");
  assert.equal(sceneGraph.submodelsById["Custom Target A/@Mouth1"].line0, "3-4");
  assert.equal(records.filter((row) => row?.structure?.customStructure).length, 1);
  assert.equal(customRecord.structure.customStructure.profile, "custom_face_like");
});

test("vendor custom model XML parser feeds shared target metadata", () => {
  const xml = fs.readFileSync(
    new URL("../../../../render-training-vendor-fixture/xlights_rgbeffects.xml", import.meta.url),
    "utf8"
  );
  const sceneGraph = parseXLightsRgbEffectsCustomModelSceneGraph(xml);
  const records = buildNormalizedTargetMetadataRecords({ sceneGraph });
  const customModels = records
    .filter((row) => row?.targetKind === "model" && row?.structure?.customStructure)
    .map((row) => row.structure.customStructure);
  const profileCounts = customModels.reduce((out, row) => {
    out[row.profile] = Number(out[row.profile] || 0) + 1;
    return out;
  }, {});

  assert.equal(customModels.length, 19);
  assert.equal(customModels.filter((row) => row.submodels.count > 0).length, 7);
  assert.equal(profileCounts.custom_face_like, 4);
  assert.equal(profileCounts.custom_radial_like, 7);
  assert.equal(profileCounts.custom_linear_like, 8);
});
