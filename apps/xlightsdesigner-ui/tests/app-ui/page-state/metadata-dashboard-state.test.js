import test from "node:test";
import assert from "node:assert/strict";

import { buildMetadataDashboardState } from "../../../app-ui/page-state/metadata-dashboard-state.js";

function buildHelpers() {
  return {
    buildMetadataTargets: () => [
      { id: "Snowman", displayName: "Snowman", type: "model" },
      { id: "SpiralTrees", displayName: "SpiralTrees", type: "model" }
    ],
    buildNormalizedTargetMetadataRecords: () => [
      {
        targetId: "Snowman",
        targetKind: "model",
        identity: { canonicalType: "custom" },
        semantics: {
          metadataCompleteness: {
            structure: "metadata_ready",
            semantic: "metadata_partial",
            role: "metadata_ready",
            submodel: "metadata_ready",
            sequencing: "metadata_partial",
            overall: "metadata_partial"
          },
          inferredRole: "focal",
          inferredSemanticTraits: ["character", "focal"]
        },
        training: { trainedSupportState: "out_of_stage1_model_support" },
        user: { rolePreference: "support", semanticHints: ["face", "hat"] },
        structure: {
          densityMetadata: {
            basis: "area",
            value: 1.234,
            label: "balanced",
            nodeCount: 48,
            footprint: { width: 10, height: 5, depth: 0, area: 50, span: 10 }
          },
          locationMetadata: {
            source: "direct",
            position: { x: 10.5, y: 2.1, z: 0.4 },
            zones: { horizontal: "left", vertical: "mid", depth: "foreground" }
          },
          submodelMetadata: {
            hasSubmodels: false,
            submodelCount: 0
          }
        },
        recommendations: [
          { type: "prop_hints", priority: "medium", message: "Snowman: add a small number of prop hints." },
          { type: "prop_hints", priority: "high", message: "Snowman: add prop hints for child regions." }
        ],
        provenance: {
          confidence: 0.25,
          updatedAt: "2026-03-22T10:00:00.000Z",
          fields: {
            canonicalType: { source: "derived_layout", detail: "Derived from layout/model display type as custom." },
            rolePreference: { source: "user_override", detail: "User override set to support." },
            semanticHints: { source: "user_override", detail: "User prop hints: face, hat." }
          }
        }
      },
      {
        targetId: "SpiralTrees",
        targetKind: "model",
        identity: { canonicalType: "tree" },
        semantics: {
          metadataCompleteness: {
            structure: "metadata_ready",
            semantic: "metadata_partial",
            role: "metadata_needed",
            submodel: "metadata_ready",
            sequencing: "metadata_ready",
            overall: "metadata_needed"
          },
          inferredRole: "",
          inferredSemanticTraits: ["tree"]
        },
        training: { trainedSupportState: "trained_supported" },
        user: { rolePreference: "" },
        structure: {
          submodelMetadata: {
            hasSubmodels: true,
            submodelCount: 8
          }
        },
        provenance: { confidence: 1, updatedAt: "2026-03-22T10:00:00.000Z", fields: {} }
      }
    ],
    matchesMetadataFilterValue: (value, filter) => {
      const tokens = String(filter || "").toLowerCase().split(",").map((row) => row.trim()).filter(Boolean);
      if (!tokens.length) return true;
      return tokens.some((token) => String(value || "").includes(token));
    },
    normalizeMetadataSelectionIds: (ids) => Array.isArray(ids) ? ids.map(String) : []
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
        metadataSelectionIds: ["Snowman"],
        metadataFilterName: "",
        metadataFilterType: "",
        metadataFilterMetadata: ""
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.page, "metadata");
  assert.equal(dashboard.data.rows.length, 2);
  assert.equal(dashboard.data.selectedCount, 1);
  assert.equal(dashboard.data.targetsSummary.metadataReadyModels, 0);
  assert.equal(dashboard.data.targetsSummary.metadataPartialModels, 1);
  assert.equal(dashboard.data.targetsSummary.metadataNeededModels, 1);
  assert.equal(dashboard.data.targetsSummary.recommendationSummary.total, 2);
  assert.equal(dashboard.data.targetsSummary.recommendationSummary.highPriority, 1);
  assert.equal(dashboard.data.targetsSummary.recommendationSummary.items[0].type, "prop_hints");
  assert.equal(dashboard.data.rows[0].canonicalType, "custom");
  assert.equal(dashboard.data.rows[0].rolePreference, "support");
  assert.equal(dashboard.data.rows[0].visualHints.join(","), "face,hat");
  assert.equal(dashboard.data.rows[0].effectAvoidances.join(","), "");
  assert.equal(dashboard.data.activeTarget.displayName, "Snowman");
  assert.equal(dashboard.data.activeTarget.metadataCompleteness, "metadata_partial");
  assert.equal(dashboard.data.activeTarget.metadataCompletenessDetail.semantic, "metadata_partial");
  assert.equal(dashboard.data.activeTarget.rolePreference, "support");
  assert.equal(dashboard.data.activeTarget.semanticHints.join(","), "face,hat");
  assert.equal(dashboard.data.activeTarget.submodelMetadata.hasSubmodels, false);
  assert.equal(dashboard.data.activeTarget.recommendations.length, 2);
  assert.equal(dashboard.data.activeTarget.recommendations[1].priority, "high");
  assert.equal(dashboard.data.activeTarget.provenanceUpdatedAt, "2026-03-22T10:00:00.000Z");
  assert.equal(dashboard.data.activeTarget.provenanceFields.length, 3);
  assert.equal(dashboard.data.activeTarget.provenanceFields[0].source.length > 0, true);
  assert.equal(dashboard.data.activeTarget.locationMetadata.zones.horizontal, "left");
  assert.match(dashboard.data.activeTarget.summaryText, /Location: left, mid, foreground \| x 10.5, y 2.1, z 0.4\./);
  assert.equal(dashboard.data.activeTarget.densityMetadata.label, "balanced");
  assert.match(dashboard.data.activeTarget.summaryText, /Density: balanced \| 1.234 nodes per area \| 48 nodes\./);
});

test("metadata dashboard applies filters to target rows", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: { assignments: [] },
      ui: {
        metadataSelectionIds: [],
        metadataFilterName: "snow",
        metadataFilterType: "",
        metadataFilterMetadata: ""
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].displayName, "Snowman");
});

test("metadata dashboard applies metadata completeness filter to target rows", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: { assignments: [] },
      ui: {
        metadataSelectionIds: [],
        metadataFilterName: "",
        metadataFilterType: "",
        metadataFilterMetadata: "metadata_partial"
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].displayName, "Snowman");
});

test("metadata dashboard applies metadata completeness dimension filter to target rows", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: { assignments: [] },
      ui: {
        metadataSelectionIds: [],
        metadataFilterName: "",
        metadataFilterType: "",
        metadataFilterMetadata: "metadata_needed",
        metadataFilterDimension: "role"
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].displayName, "SpiralTrees");
  assert.equal(dashboard.data.metadataFilterDimension, "role");
});
