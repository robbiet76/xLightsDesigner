import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  analyzeCustomModelStructure,
  mapClassificationToTrainingBuckets
} from "../../runtime/custom-model-structure.js";
import { buildCustomModelStructureCatalog } from "../../runtime/custom-model-catalog.js";
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
  const buckets = mapClassificationToTrainingBuckets(classifyModelDisplayType("Custom"), out);

  assert.equal(out.profile, "custom_linear_like");
  assert.ok(out.traits.includes("continuous_node_path"));
  assert.deepEqual(buckets.sort(), []);
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
  const buckets = mapClassificationToTrainingBuckets(classifyModelDisplayType("Custom"), out);

  assert.equal(out.profile, "custom_radial_like");
  assert.ok(out.traits.includes("radial_like"));
  assert.deepEqual(buckets.sort(), []);
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

test("mapClassificationToTrainingBuckets treats Tree 180 as tree-compatible", () => {
  const buckets = mapClassificationToTrainingBuckets(classifyModelDisplayType("Tree 180"));

  assert.ok(buckets.includes("tree_flat"));
  assert.ok(buckets.includes("tree_360"));
});

test("vendor custom model structure capture preserves submodel construction signals", () => {
  const capture = JSON.parse(fs.readFileSync(
    new URL("../fixtures/vendor-custom-model-structure-capture.json", import.meta.url),
    "utf8"
  ));

  assert.equal(capture.artifactType, "custom_model_structure_catalog_v1");
  assert.equal(capture.summary.customModelCount, 19);

  const faceLike = capture.models.find((row) => row.profile === "custom_face_like" && row.submodels.count >= 2);
  assert.ok(faceLike);
  assert.equal(faceLike.construction.nodeMap.nodeCount, faceLike.nodeOrder.nodeCount);
  assert.equal(faceLike.construction.nodeMap.firstNodes[0].coordinateSource, "grid");

  const radialWithSubmodels = capture.models.find((row) =>
    row.profile === "custom_radial_like"
    && row.traits.includes("custom_radial_submodels")
    && row.submodels.count >= 4
  );
  assert.ok(radialWithSubmodels);

  const layered = capture.models.find((row) => row.traits.includes("layered_submodels"));
  assert.ok(layered);
  assert.ok(layered.submodels.count >= 2);
});

test("buildCustomModelStructureCatalog captures all custom models from a scene graph", () => {
  const catalog = buildCustomModelStructureCatalog({
    sceneGraph: {
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
    },
    createdAt: "2026-04-30T00:00:00.000Z"
  });

  assert.equal(catalog.artifactType, "custom_model_structure_catalog_v1");
  assert.equal(catalog.summary.customModelCount, 1);
  assert.equal(catalog.summary.modelsWithSubmodels, 1);
  assert.equal(catalog.models[0].modelName, "Custom Target A");
  assert.match(catalog.models[0].fingerprint, /^cmf1:[0-9a-f]{8}$/);
  assert.equal(catalog.models[0].fingerprintVersion, "custom-model-fingerprint-v1");
  assert.equal(catalog.models[0].profile, "custom_face_like");
});

test("buildCustomModelStructureCatalog fingerprints include custom submodel construction", () => {
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

  const base = buildCustomModelStructureCatalog({ sceneGraph: baseSceneGraph });
  const changed = buildCustomModelStructureCatalog({ sceneGraph: changedSceneGraph });

  assert.notEqual(base.models[0].fingerprint, changed.models[0].fingerprint);
});

test("buildCustomModelStructureCatalog fingerprints survive model renames", () => {
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

  const base = buildCustomModelStructureCatalog({ sceneGraph: baseSceneGraph });
  const renamed = buildCustomModelStructureCatalog({ sceneGraph: renamedSceneGraph });

  assert.equal(base.models[0].fingerprint, renamed.models[0].fingerprint);
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
  const catalog = buildCustomModelStructureCatalog({ sceneGraph });

  assert.equal(Object.keys(sceneGraph.modelsById).length, 2);
  assert.equal(Object.keys(sceneGraph.submodelsById).length, 2);
  assert.equal(sceneGraph.modelsById["Custom Target A"].attributes.CustomModel, "1,-1,2;3,-1,4");
  assert.equal(sceneGraph.submodelsById["Custom Target A/@Mouth1"].line0, "3-4");
  assert.equal(catalog.summary.customModelCount, 1);
  assert.equal(catalog.models[0].profile, "custom_face_like");
});

test("vendor custom model XML parser feeds permanent catalog builder", () => {
  const xml = fs.readFileSync(
    new URL("../../../../render-training-vendor-fixture/xlights_rgbeffects.xml", import.meta.url),
    "utf8"
  );
  const sceneGraph = parseXLightsRgbEffectsCustomModelSceneGraph(xml);
  const catalog = buildCustomModelStructureCatalog({ sceneGraph });

  assert.equal(catalog.summary.customModelCount, 19);
  assert.equal(catalog.summary.modelsWithSubmodels, 7);
  assert.equal(catalog.summary.profileCounts.custom_face_like, 4);
  assert.equal(catalog.summary.profileCounts.custom_radial_like, 7);
  assert.equal(catalog.summary.profileCounts.custom_linear_like, 8);
});
