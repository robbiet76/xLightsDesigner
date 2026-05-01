import test from "node:test";
import assert from "node:assert/strict";

import { buildMetadataDashboardState } from "../../../app-ui/page-state/metadata-dashboard-state.js";

function buildHelpers() {
  return {
    buildMetadataTargets: () => [
      { id: "Snowman", displayName: "Snowman", type: "model", fingerprint: "tmf1:snowman" },
      { id: "SpiralTrees", displayName: "SpiralTrees", type: "model", fingerprint: "tmf1:spiral" }
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
            label: "medium",
            nodeCount: 48,
            footprint: { width: 10, height: 5, depth: 0, area: 50, span: 10 }
          },
          locationMetadata: {
            source: "direct",
            position: { x: 10.5, y: 2.1, z: 0.4 },
            zones: { horizontal: "left", vertical: "mid", depth: "front" }
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
            canonicalType: { source: "derived_layout", detail: "Derived from display/model type as custom." },
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
      const tokens = String(filter || "")
        .toLowerCase()
        .split(/[,;|]/)
        .map((row) => row.trim())
        .filter(Boolean);
      if (!tokens.length) return true;
      const text = String(value || "").toLowerCase();
      const includeTokens = tokens.filter((token) => !token.startsWith("!"));
      const excludeTokens = tokens
        .filter((token) => token.startsWith("!"))
        .map((token) => token.slice(1))
        .filter(Boolean);
      if (excludeTokens.some((token) => text.includes(token))) return false;
      if (!includeTokens.length) return true;
      return includeTokens.some((token) => text.includes(token));
    },
    normalizeMetadataSelectionIds: (ids) => Array.isArray(ids) ? ids.map(String) : []
  };
}

test("metadata dashboard summarizes tag and target state", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: {
        assignments: [{
          targetId: "Snowman",
          tags: ["character"],
          displayBinding: { targetFingerprint: "tmf1:snowman" }
        }]
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
  assert.equal(dashboard.data.reconciliation.state, "matched");
  assert.equal(dashboard.data.reconciliation.summary.matchedCount, 1);
  assert.equal(dashboard.data.reconciliation.summary.reviewNeeded, false);
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
  assert.match(dashboard.data.activeTarget.summaryText, /Location: left, mid, front \| x 10.5, y 2.1, z 0.4\./);
  assert.equal(dashboard.data.activeTarget.densityMetadata.label, "medium");
  assert.match(dashboard.data.activeTarget.summaryText, /Visual Weight: medium \| 1.234 nodes per area \| 48 nodes\./);
});

test("metadata dashboard exposes reconciliation review state", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: {
        assignments: [
          {
            targetId: "RenamedFace",
            targetName: "Renamed Face",
            tags: ["character"],
            displayBinding: {
              targetFingerprint: "tmf1:face",
              previousTargetId: "CustomFace",
              previousTargetName: "Custom Face"
            }
          },
          {
            targetId: "RetiredSpinner",
            targetName: "Retired Spinner",
            tags: ["legacy"],
            displayBinding: { targetFingerprint: "tmf1:retired" }
          }
        ],
        preferencesByTargetId: {
          RenamedFace: {
            semanticHints: ["Face"],
            displayBinding: {
              targetFingerprint: "tmf1:face",
              previousTargetId: "CustomFace",
              previousTargetName: "Custom Face"
            }
          }
        },
        displayBinding: {
          status: "reconciled",
          orphanTargetIds: ["RetiredSpinner"],
          layoutFingerprint: "display-fp-2",
          previousLayoutFingerprint: "display-fp-1"
        }
      },
      ui: {},
      health: {}
    },
    helpers: {
      ...buildHelpers(),
      buildMetadataTargets: () => [
        { id: "RenamedFace", displayName: "Renamed Face", type: "model", fingerprint: "tmf1:face" },
        { id: "TwinA", displayName: "Twin A", type: "model", fingerprint: "tmf1:duplicate" },
        { id: "TwinB", displayName: "Twin B", type: "model", fingerprint: "tmf1:duplicate" }
      ],
      buildNormalizedTargetMetadataRecords: () => []
    }
  });

  assert.equal(dashboard.data.reconciliation.state, "needs_review");
  assert.equal(dashboard.data.reconciliation.summary.renamedCount, 1);
  assert.equal(dashboard.data.reconciliation.summary.orphanedCount, 1);
  assert.equal(dashboard.data.reconciliation.summary.collisionCount, 1);
  assert.equal(dashboard.data.reconciliation.renamed[0].previousTargetId, "CustomFace");
  assert.equal(dashboard.data.reconciliation.renamed[0].targetId, "RenamedFace");
  assert.equal(dashboard.data.reconciliation.orphaned[0].targetId, "RetiredSpinner");
  assert.deepEqual(dashboard.data.reconciliation.collisions[0].targets.map((row) => row.targetId), ["TwinA", "TwinB"]);
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

test("metadata dashboard applies role filter to target rows", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: { assignments: [] },
      ui: {
        metadataSelectionIds: [],
        metadataFilterName: "",
        metadataFilterType: "",
        metadataFilterRole: "support"
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].displayName, "Snowman");
});

test("metadata dashboard applies visual hints filter to target rows", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: { assignments: [] },
      ui: {
        metadataSelectionIds: [],
        metadataFilterName: "",
        metadataFilterType: "",
        metadataFilterVisualHints: "face"
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].displayName, "Snowman");
});

test("metadata dashboard supports exclusion terms in filters", () => {
  const dashboard = buildMetadataDashboardState({
    state: {
      submodels: [],
      metadata: { assignments: [] },
      ui: {
        metadataSelectionIds: [],
        metadataFilterName: "!snow"
      },
      health: {}
    },
    helpers: buildHelpers()
  });

  assert.equal(dashboard.data.rows.length, 1);
  assert.equal(dashboard.data.rows[0].displayName, "SpiralTrees");
});
