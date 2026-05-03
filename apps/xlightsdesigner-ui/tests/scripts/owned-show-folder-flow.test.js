import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseTargetModel,
  normalizeSubmodelTarget
} from "../../../../scripts/xlights/validate-owned-show-folder-flow.mjs";

test("normalizeSubmodelTarget derives full target name from parent and submodel names", () => {
  const target = normalizeSubmodelTarget({
    parentName: "Custom Face",
    name: "@Mouth1",
    nodeCount: 12
  });

  assert.equal(target.id, "Custom Face/@Mouth1");
  assert.equal(target.name, "Custom Face/@Mouth1");
  assert.equal(target.targetKind, "submodel");
  assert.equal(target.displayAs, "Submodel");
  assert.equal(target.nodeCount, 12);
});

test("chooseTargetModel resolves requested submodel targets from layout submodels", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/layout/models")) {
      return Response.json({
        ok: true,
        data: {
          models: [
            { name: "Custom Face", displayAs: "Custom" },
            { name: "Mega Tree", displayAs: "Tree 360" }
          ]
        }
      });
    }
    if (path.endsWith("/layout/submodels")) {
      return Response.json({
        ok: true,
        data: {
          submodels: [
            { fullName: "Custom Face/@Mouth1", name: "@Mouth1", parentName: "Custom Face" }
          ]
        }
      });
    }
    throw new Error(`Unexpected route: ${path}`);
  };

  try {
    const out = await chooseTargetModel("http://127.0.0.1:49915/xlightsdesigner/api", "Custom Face/@Mouth1");
    assert.equal(out.model.name, "Custom Face/@Mouth1");
    assert.equal(out.model.targetKind, "submodel");
    assert.equal(out.modelsPayload.data.models.length, 2);
    assert.equal(out.submodelsPayload.data.submodels.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
