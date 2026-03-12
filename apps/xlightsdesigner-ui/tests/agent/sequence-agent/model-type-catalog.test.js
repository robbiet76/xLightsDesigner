import test from "node:test";
import assert from "node:assert/strict";

import { classifyModelDisplayType } from "../../../agent/sequence-agent/model-type-catalog.js";

test("classifyModelDisplayType maps exact core model types", () => {
  const out = classifyModelDisplayType("ModelGroup");
  assert.equal(out.canonicalType, "model_group");
  assert.equal(out.category, "group");
  assert.equal(out.isGroup, true);
});

test("classifyModelDisplayType maps prefix variants", () => {
  const tree = classifyModelDisplayType("Tree Ribbon");
  assert.equal(tree.canonicalType, "tree");
  assert.equal(tree.category, "tree");

  const sphere = classifyModelDisplayType("Sphere");
  assert.equal(sphere.canonicalType, "sphere");
  assert.equal(sphere.category, "volume");
});

test("classifyModelDisplayType flags dmx/deprecated types", () => {
  const a = classifyModelDisplayType("DmxMovingHead");
  assert.equal(a.isDmx, true);
  assert.equal(a.isDeprecated, false);

  const b = classifyModelDisplayType("DmxSkulltronix");
  assert.equal(b.isDmx, true);
  assert.equal(b.isDeprecated, true);
});

test("classifyModelDisplayType falls back gracefully for unknown types", () => {
  const out = classifyModelDisplayType("Some Future Type");
  assert.equal(out.category, "unknown");
  assert.equal(out.canonicalType, "some_future_type");
});
