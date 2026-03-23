import test from "node:test";
import assert from "node:assert/strict";

import { buildMetadataDashboardState } from "../../../app-ui/page-state/metadata-dashboard-state.js";

function buildHelpers() {
  return {
    getMetadataTagRecords: () => [
      { name: "character", description: "Character prop", category: "semantic", source: "controlled", controlled: true },
      { name: "support", description: "Supporting prop", category: "role", source: "controlled", controlled: true }
    ],
    buildMetadataTargets: () => [
      { id: "Snowman", displayName: "Snowman", type: "model" },
      { id: "SpiralTrees", displayName: "SpiralTrees", type: "model" }
    ],
    buildNormalizedTargetMetadataRecords: () => [
      {
        targetId: "Snowman",
        targetKind: "model",
        identity: { canonicalType: "custom" },
        semantics: { supportState: "runtime_targetable_only", inferredRole: "focal", inferredSemanticTraits: ["character", "focal"] },
        training: { trainedSupportState: "out_of_stage1_model_support" },
        user: { rolePreference: "support" },
        provenance: {
          confidence: 0.25,
          updatedAt: "2026-03-22T10:00:00.000Z",
          fields: {
            canonicalType: { source: "derived_layout", detail: "Derived from layout/model display type as custom." },
            rolePreference: { source: "user_override", detail: "User override set to support." }
          }
        }
      },
      {
        targetId: "SpiralTrees",
        targetKind: "model",
        identity: { canonicalType: "tree" },
        semantics: { supportState: "trained_supported", inferredRole: "", inferredSemanticTraits: ["tree"] },
        training: { trainedSupportState: "trained_supported" },
        user: { rolePreference: "" },
        provenance: { confidence: 1, updatedAt: "2026-03-22T10:00:00.000Z", fields: {} }
      }
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
  assert.equal(dashboard.data.tags[0].category.length > 0, true);
  assert.equal(dashboard.data.rows.length, 2);
  assert.equal(dashboard.data.selectedCount, 1);
  assert.equal(dashboard.data.hasSelectedTags, true);
  assert.equal(dashboard.data.targetsSummary.trainedSupportedModels, 1);
  assert.equal(dashboard.data.targetsSummary.runtimeOnlyModels, 1);
  assert.equal(dashboard.data.targetsSummary.controlledTagCount, 2);
  assert.equal(dashboard.data.targetsSummary.customTagCount, 0);
  assert.equal(dashboard.data.rows[0].supportState.length > 0, true);
  assert.equal(dashboard.data.activeTarget.displayName, "Snowman");
  assert.equal(dashboard.data.activeTarget.rolePreference, "support");
  assert.equal(dashboard.data.activeTarget.provenanceUpdatedAt, "2026-03-22T10:00:00.000Z");
  assert.equal(dashboard.data.activeTarget.provenanceFields.length, 2);
  assert.equal(dashboard.data.activeTarget.provenanceFields[0].source.length > 0, true);
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
