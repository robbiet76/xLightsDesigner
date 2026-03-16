import test from "node:test";
import assert from "node:assert/strict";

import { buildMetadataDashboardState } from "../../../app-ui/page-state/metadata-dashboard-state.js";

function buildHelpers() {
  return {
    getMetadataTagRecords: () => [
      { name: "character", description: "Character prop" },
      { name: "support", description: "Supporting prop" }
    ],
    buildMetadataTargets: () => [
      { id: "Snowman", displayName: "Snowman", type: "model" },
      { id: "SpiralTrees", displayName: "SpiralTrees", type: "model" }
    ],
    matchesMetadataFilterValue: (value, filter) => {
      const tokens = String(filter || "").toLowerCase().split(",").map((row) => row.trim()).filter(Boolean);
      if (!tokens.length) return true;
      return tokens.some((token) => String(value || "").includes(token));
    },
    normalizeMetadataSelectionIds: (ids) => Array.isArray(ids) ? ids.map(String) : [],
    normalizeMetadataSelectedTags: (tags) => Array.isArray(tags) ? tags.map(String) : []
  };
}

test("metadata dashboard summarizes tag and target state", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: {
        assignments: [{ targetId: "Snowman", tags: ["character"] }]
      },
      ui: {
        metadataSelectedTags: ["character"],
        metadataSelectionIds: ["Snowman"],
        metadataFilterName: "",
        metadataFilterType: "",
        metadataFilterTags: "",
        metadataNewTag: ""
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.page, "metadata");
  assert.equal(dashboard.data.tags.length, 2);
  assert.equal(dashboard.data.rows.length, 2);
  assert.equal(dashboard.data.selectedCount, 1);
  assert.equal(dashboard.data.hasSelectedTags, true);
});

test("metadata dashboard applies filters to target rows", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: { assignments: [] },
      ui: {
        metadataSelectedTags: [],
        metadataSelectionIds: [],
        metadataFilterName: "snow",
        metadataFilterType: "",
        metadataFilterTags: "",
        metadataNewTag: ""
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].displayName, "Snowman");
});
