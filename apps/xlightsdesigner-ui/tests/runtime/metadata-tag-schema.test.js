import test from "node:test";
import assert from "node:assert/strict";

import {
  getControlledMetadataTagRecords,
  isControlledMetadataTag,
  mergeMetadataTagRecords,
  normalizeMetadataTagName,
  toStoredMetadataTagRecords
} from "../../runtime/metadata-tag-schema.js";

test("controlled metadata tag records are present and normalized", () => {
  const rows = getControlledMetadataTagRecords();
  assert.ok(rows.length >= 5);
  assert.equal(rows.some((row) => row.name === "Focal" && row.controlled === true), true);
  assert.equal(rows.some((row) => row.name === "Character" && row.category === "semantic"), true);
});

test("mergeMetadataTagRecords keeps controlled tags and appends custom tags", () => {
  const rows = mergeMetadataTagRecords([
    { name: "roofline", description: "Project specific" },
    { name: "focal", description: "Should not override controlled tag" }
  ]);
  assert.equal(rows.some((row) => row.name === "Focal" && row.controlled === true), true);
  assert.equal(rows.some((row) => row.name === "Roofline" && row.controlled === false), true);
  assert.equal(rows.filter((row) => row.name === "Focal").length, 1);
});

test("toStoredMetadataTagRecords excludes controlled tags", () => {
  const rows = toStoredMetadataTagRecords([
    { name: "Focal", controlled: true, source: "controlled" },
    { name: "roofline", description: "Project specific", source: "custom" }
  ]);
  assert.deepEqual(rows, [
    { name: "Roofline", description: "Project specific", category: "project" }
  ]);
});

test("isControlledMetadataTag matches normalized names", () => {
  assert.equal(isControlledMetadataTag("focal"), true);
  assert.equal(isControlledMetadataTag(normalizeMetadataTagName("ambient fill")), true);
  assert.equal(isControlledMetadataTag("roofline"), false);
});
