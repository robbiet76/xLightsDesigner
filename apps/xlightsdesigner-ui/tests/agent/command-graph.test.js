import test from "node:test";
import assert from "node:assert/strict";

import { buildCommandGraph, validateCommandGraph } from "../../agent/command-graph.js";

test("buildCommandGraph emits canonical node schema", () => {
  const out = buildCommandGraph([
    { cmd: "timing.createTrack", params: { trackName: "XD: Test" } },
    { cmd: "timing.insertMarks", params: { trackName: "XD: Test", marks: [{ timeMs: 1, label: "A" }] } }
  ]);
  assert.equal(out.schema, "command_graph_v1");
  assert.equal(out.nodes.length, 2);
  assert.equal(out.nodes[0].id, "n1");
  assert.equal(out.nodes[1].id, "n2");
  assert.equal(out.nodes[0].writeKey, "timing:XD: Test");
});

test("validateCommandGraph blocks duplicate exact writes", () => {
  const out = validateCommandGraph([
    { cmd: "timing.createTrack", params: { trackName: "XD: Test" } },
    { cmd: "timing.createTrack", params: { trackName: "XD: Test" } }
  ]);
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => /duplicate write command/i.test(e)));
});

test("validateCommandGraph blocks unsafe writes by default", () => {
  const out = validateCommandGraph([
    { cmd: "layout.setModel", params: { id: "Tree" } }
  ]);
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => /unsafe command/i.test(e)));
});

test("validateCommandGraph validates dependency ordering", () => {
  const out = validateCommandGraph([
    { id: "n2", cmd: "timing.insertMarks", params: { trackName: "XD: Test", marks: [] }, dependsOn: ["n1"] },
    { id: "n1", cmd: "timing.createTrack", params: { trackName: "XD: Test" } }
  ]);
  assert.equal(out.ok, false);
  assert.ok(out.errors.some((e) => /out-of-order/i.test(e)));
});

test("validateCommandGraph passes valid graph", () => {
  const out = validateCommandGraph([
    { id: "n1", cmd: "timing.createTrack", params: { trackName: "XD: Test" } },
    { id: "n2", cmd: "timing.insertMarks", params: { trackName: "XD: Test", marks: [{ timeMs: 100, label: "1" }] }, dependsOn: ["n1"] }
  ]);
  assert.equal(out.ok, true);
  assert.equal(out.nodeCount, 2);
});

test("buildCommandGraph derives effect write keys from model and layer", () => {
  const out = buildCommandGraph([
    { cmd: "effects.create", params: { modelName: "MegaTree", layerIndex: 2, effectName: "Bars", startMs: 0, endMs: 1000 } }
  ]);
  assert.equal(out.nodes[0].writeKey, "effects:model:MegaTree:layer:2");
});

test("validateCommandGraph counts real effect writes", () => {
  const out = validateCommandGraph([
    { cmd: "effects.create", params: { modelName: "MegaTree", layerIndex: 0, effectName: "Bars", startMs: 0, endMs: 1000 } }
  ]);
  assert.equal(out.ok, true);
  assert.equal(out.writeCount, 1);
});
