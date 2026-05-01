import test from "node:test";
import assert from "node:assert/strict";

import { createMetadataRuntime } from "../../runtime/metadata-runtime.js";

function normalizeTagName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

function buildState() {
  return {
    models: [
      { id: "Tree", name: "Tree", type: "Tree" },
      { id: "Snowman", name: "Snowman", type: "Prop" }
    ],
    submodels: [
      { id: "Tree/Star", name: "Star", parentId: "Tree" }
    ],
    metadata: {
      tags: [{ name: "Existing", description: "keep" }],
      assignments: [],
      preferencesByTargetId: {},
      visualHintDefinitions: [],
      ignoredOrphanTargetIds: []
    },
    ui: {
      metadataTargetId: "",
      metadataSelectionIds: ["Tree", "Missing", "Tree/Star", "Tree"],
      metadataSelectedTags: [],
      metadataNewTag: " Accent ",
      metadataNewTagDescription: "  bright  "
    }
  };
}

function buildRuntime(state, hooks = {}) {
  return createMetadataRuntime({
    state,
    persist: hooks.persist || (() => {}),
    render: hooks.render || (() => {}),
    saveCurrentProjectSnapshot: hooks.saveCurrentProjectSnapshot || (() => {}),
    setStatus: hooks.setStatus || (() => {}),
    invalidatePlanHandoff: hooks.invalidatePlanHandoff || (() => {}),
    mergeVisualHintDefinitions: (records) => Array.isArray(records) ? [...records] : [],
    ensureVisualHintDefinitions: (records, hintNames, meta = {}) => {
      const byName = new Map((Array.isArray(records) ? records : []).map((row) => [row.name, row]));
      for (const name of hintNames) {
        const normalized = normalizeTagName(name);
        if (!normalized || byName.has(normalized)) continue;
        byName.set(normalized, { name: normalized, ...meta });
      }
      return Array.from(byName.values());
    },
    defineVisualHint: (records, rawName, definition = {}) => {
      const normalized = normalizeTagName(rawName);
      const next = Array.isArray(records) ? [...records] : [];
      const idx = next.findIndex((row) => row.name === normalized);
      const record = { name: normalized, ...definition };
      if (idx >= 0) next[idx] = { ...next[idx], ...record };
      else next.push(record);
      return next;
    },
    toStoredVisualHintDefinitions: (records) => Array.isArray(records) ? [...records] : [],
    isControlledMetadataTag: (name) => normalizeTagName(name) === "Controlled",
    mergeMetadataTagRecords: (records) => Array.isArray(records)
      ? records
          .map((row) => ({
            name: normalizeTagName(row?.name),
            description: String(row?.description || "").trim()
          }))
          .filter((row) => row.name)
      : [],
    normalizeMetadataTagName: normalizeTagName,
    toStoredMetadataTagRecords: (records) => Array.isArray(records) ? [...records] : [],
    buildRuntimeEffectiveMetadataAssignments: (assignments, preferencesByTargetId, deps = {}) => {
      const byId = new Map();
      for (const row of assignments) {
        byId.set(row.targetId, {
          ...row,
          resolved: deps.resolveTarget ? deps.resolveTarget(row.targetId) : null,
          preferences: preferencesByTargetId[row.targetId] || null
        });
      }
      for (const [targetId, preferences] of Object.entries(preferencesByTargetId || {})) {
        if (byId.has(targetId)) continue;
        byId.set(targetId, {
          targetId,
          resolved: deps.resolveTarget ? deps.resolveTarget(targetId) : null,
          preferences
        });
      }
      return Array.from(byId.values());
    },
    parseSubmodelParentId: (id) => String(id || "").split("/")[0] || "",
    modelStableId: (model) => String(model?.id || model?.name || ""),
    modelDisplayName: (model) => String(model?.name || model?.id || ""),
    normalizeElementType: (type) => String(type || "").trim().toLowerCase(),
    normalizeStringArray: (values) => Array.isArray(values)
      ? values.map((value) => String(value || "").trim()).filter(Boolean).sort()
      : [],
    arraysEqualAsSets: (a, b) => JSON.stringify([...(new Set(a))].sort()) === JSON.stringify([...(new Set(b))].sort())
  });
}

test("metadata runtime ensures target selection and filters invalid ids", () => {
  const state = buildState();
  const runtime = buildRuntime(state);

  runtime.ensureMetadataTargetSelection();

  assert.equal(state.ui.metadataTargetId, "Snowman");
  assert.deepEqual(state.ui.metadataSelectionIds, ["Tree", "Tree/Star"]);
  assert.equal(runtime.getMetadataTargetNameById("Tree/Star"), "Tree / Star");
});

test("metadata runtime adds tags from persisted tag state", () => {
  const state = buildState();
  let persistCount = 0;
  let renderCount = 0;
  let snapshotCount = 0;
  const statuses = [];
  const runtime = buildRuntime(state, {
    persist: () => { persistCount += 1; },
    render: () => { renderCount += 1; },
    saveCurrentProjectSnapshot: () => { snapshotCount += 1; },
    setStatus: (level, text) => statuses.push({ level, text })
  });

  assert.deepEqual(runtime.getMetadataTagRecords().map((row) => row.name), ["Existing"]);
  runtime.addMetadataTag();

  assert.deepEqual(state.metadata.tags.map((row) => row.name), ["Accent", "Existing"]);
  assert.deepEqual(state.ui.metadataSelectedTags, ["Accent"]);
  assert.equal(state.ui.metadataNewTag, "");
  assert.equal(state.ui.metadataNewTagDescription, "");
  assert.equal(persistCount, 1);
  assert.equal(renderCount, 1);
  assert.equal(snapshotCount, 1);
  assert.equal(statuses.at(-1)?.text, "Added tag: Accent");
});

test("metadata runtime applies semantic hints and invalidates plan handoff", () => {
  const state = buildState();
  const invalidations = [];
  const runtime = buildRuntime(state, {
    invalidatePlanHandoff: (reason) => invalidations.push(reason)
  });

  const ok = runtime.updateMetadataTargetSemanticHints("Tree", " sparkle, cool ");

  assert.equal(ok, true);
  assert.deepEqual(state.metadata.preferencesByTargetId.Tree.semanticHints, ["Sparkle", "Cool"]);
  assert.equal(typeof state.metadata.preferencesByTargetId.Tree.displayBinding.xlightsLayoutFingerprint, "string");
  assert.ok(state.metadata.preferencesByTargetId.Tree.displayBinding.xlightsLayoutFingerprint);
  assert.equal(typeof state.metadata.preferencesByTargetId.Tree.displayBinding.layoutFingerprint, "string");
  assert.ok(state.metadata.preferencesByTargetId.Tree.displayBinding.layoutFingerprint);
  assert.deepEqual(state.metadata.visualHintDefinitions.map((row) => row.name), ["Sparkle", "Cool"]);
  assert.equal(invalidations.at(-1), "metadata semantic hints changed");
});

test("metadata runtime stamps user-authored assignments with the display fingerprint", () => {
  const state = buildState();
  state.showFolder = "/show/fingerprint";
  const runtime = buildRuntime(state);
  const fingerprint = runtime.buildDisplayMetadataLayoutFingerprint();
  state.metadata.displayBinding = {
    showFolder: state.showFolder,
    layoutFingerprint: fingerprint,
    status: "reconciled"
  };

  const ok = runtime.upsertMetadataAssignmentTags("Tree", ["Existing"], []);

  assert.equal(ok, true);
  assert.equal(state.metadata.assignments[0].targetId, "Tree");
  assert.equal(state.metadata.assignments[0].displayBinding.showFolder, "/show/fingerprint");
  assert.equal(state.metadata.assignments[0].displayBinding.xlightsLayoutFingerprint, fingerprint);
  assert.equal(state.metadata.assignments[0].displayBinding.layoutFingerprint, fingerprint);
});

test("metadata runtime stamps user-authored assignments with target fingerprints", () => {
  const state = buildState();
  state.sceneGraph = {
    modelsById: {
      Tree: { id: "Tree", name: "Tree", displayAs: "Tree 360", attributes: { DisplayAs: "Tree 360", parm1: "16" } }
    }
  };
  const runtime = buildRuntime(state);

  const ok = runtime.upsertMetadataAssignmentTags("Tree", ["Existing"], []);

  assert.equal(ok, true);
  assert.match(state.metadata.assignments[0].displayBinding.targetFingerprint, /^tmf1:[0-9a-f]{8}$/);
  assert.equal(state.metadata.assignments[0].displayBinding.targetFingerprintVersion, "target-metadata-fingerprint-v1");
});

test("metadata runtime remaps renamed targets by fingerprint during reconciliation", () => {
  const state = buildState();
  state.models = [{ id: "CustomFace", name: "Custom Face", type: "Prop" }];
  state.submodels = [];
  state.sceneGraph = {
    modelsById: {
      CustomFace: {
        id: "CustomFace",
        name: "Custom Face",
        displayAs: "Custom",
        attributes: { CustomModel: ",1,;2,,3;,4," }
      }
    }
  };
  const runtime = buildRuntime(state);

  assert.equal(runtime.upsertMetadataAssignmentTags("CustomFace", ["Existing"], []), true);
  assert.equal(runtime.updateMetadataTargetSemanticHints("CustomFace", "Face"), true);
  const originalFingerprint = state.metadata.assignments[0].displayBinding.targetFingerprint;

  state.models = [{ id: "RenamedFace", name: "Renamed Face", type: "Prop" }];
  state.sceneGraph = {
    modelsById: {
      RenamedFace: {
        id: "RenamedFace",
        name: "Renamed Face",
        displayAs: "Custom",
        attributes: { CustomModel: ",1,;2,,3;,4," }
      }
    }
  };

  const binding = runtime.reconcileDisplayMetadataForSceneGraphChange({ reason: "layout refresh" });

  assert.equal(state.metadata.assignments[0].targetId, "RenamedFace");
  assert.equal(state.metadata.assignments[0].targetName, "Renamed Face");
  assert.equal(state.metadata.assignments[0].displayBinding.targetFingerprint, originalFingerprint);
  assert.equal(state.metadata.assignments[0].displayBinding.previousTargetId, "CustomFace");
  assert.deepEqual(state.metadata.preferencesByTargetId.RenamedFace.semanticHints, ["Face"]);
  assert.equal(state.metadata.preferencesByTargetId.RenamedFace.displayBinding.previousTargetId, "CustomFace");
  assert.equal(state.metadata.preferencesByTargetId.CustomFace, undefined);
  assert.deepEqual(binding.orphanTargetIds, []);
});

test("metadata runtime refreshes custom model catalog during display reconciliation", () => {
  const state = buildState();
  state.models = [{ id: "CustomFace", name: "Custom Face", type: "Custom" }];
  state.submodels = [{ id: "CustomFace/@Mouth", name: "@Mouth", parentId: "CustomFace" }];
  state.sceneGraph = {
    modelsById: {
      CustomFace: {
        id: "CustomFace",
        name: "Custom Face",
        displayAs: "Custom",
        attributes: { CustomModel: ",1,;2,,3;,4," }
      }
    },
    submodelsById: {
      "CustomFace/@Mouth": {
        id: "CustomFace/@Mouth",
        name: "@Mouth",
        parentId: "CustomFace",
        type: "ranges",
        line0: "2-3"
      }
    }
  };
  const runtime = buildRuntime(state);

  runtime.reconcileDisplayMetadataForSceneGraphChange({ reason: "layout refresh" });

  assert.equal(state.sceneGraph.customModelCatalog.artifactType, "custom_model_structure_catalog_v1");
  assert.equal(state.sceneGraph.customModelCatalog.summary.customModelCount, 1);
  assert.equal(state.sceneGraph.customModelCatalog.models[0].targetId, "CustomFace");
  assert.equal(state.sceneGraph.customModelCatalog.models[0].construction.nodeMap.nodeCount, 4);
});

test("metadata runtime safely resolves duplicate fingerprints when stored identity matches one candidate", () => {
  const state = buildState();
  state.models = [
    { id: "FaceA", name: "Face A", type: "Prop", fingerprint: "tmf1:duplicate-face" },
    { id: "FaceB", name: "Face B", type: "Prop", fingerprint: "tmf1:duplicate-face" }
  ];
  state.submodels = [];
  state.metadata.assignments = [{
    targetId: "OldFace",
    targetName: "Face B",
    tags: ["Existing"],
    displayBinding: {
      targetFingerprint: "tmf1:duplicate-face",
      previousTargetName: "Face B"
    }
  }];
  state.metadata.preferencesByTargetId = {
    OldFace: {
      semanticHints: ["Face"],
      displayBinding: {
        targetFingerprint: "tmf1:duplicate-face",
        previousTargetName: "Face B"
      }
    }
  };
  const runtime = buildRuntime(state);

  const binding = runtime.reconcileDisplayMetadataForSceneGraphChange({ reason: "layout refresh" });

  assert.equal(state.metadata.assignments[0].targetId, "FaceB");
  assert.equal(state.metadata.assignments[0].targetName, "Face B");
  assert.equal(state.metadata.assignments[0].displayBinding.previousTargetId, "OldFace");
  assert.deepEqual(state.metadata.preferencesByTargetId.FaceB.semanticHints, ["Face"]);
  assert.equal(state.metadata.preferencesByTargetId.OldFace, undefined);
  assert.deepEqual(binding.orphanTargetIds, []);
});

test("metadata runtime reconciles display metadata without deleting orphaned user work", () => {
  const state = buildState();
  state.showFolder = "/show/a";
  state.metadata.assignments = [
    { targetId: "Tree", tags: ["Existing"] },
    { targetId: "Old Spinner", tags: ["Existing"] }
  ];
  state.metadata.preferencesByTargetId = {
    Tree: { rolePreference: "focal" },
    "Old Spinner": { semanticHints: ["Legacy"] }
  };
  state.ui.metadataTargetId = "Tree";
  state.ui.metadataSelectionIds = ["Tree"];
  const invalidations = [];
  const statuses = [];
  const runtime = buildRuntime(state, {
    invalidatePlanHandoff: (reason) => invalidations.push(reason),
    setStatus: (level, text) => statuses.push({ level, text })
  });

  runtime.markDisplayMetadataPendingReconciliation("show folder changed");

  assert.equal(state.metadata.displayBinding.status, "pending");
  assert.equal(state.metadata.displayBinding.pendingReason, "show folder changed");
  assert.deepEqual(state.ui.metadataSelectionIds, []);

  const binding = runtime.reconcileDisplayMetadataForSceneGraphChange({ reason: "layout refresh" });

  assert.equal(binding.status, "reconciled");
  assert.equal(binding.xlightsLayoutFingerprint, binding.layoutFingerprint);
  assert.equal(binding.summary.activeAssignmentCount, 1);
  assert.equal(binding.summary.activePreferenceCount, 1);
  assert.deepEqual(binding.orphanTargetIds, ["Old Spinner"]);
  assert.equal(state.metadata.assignments.length, 2);
  assert.equal(state.metadata.preferencesByTargetId["Old Spinner"].semanticHints[0], "Legacy");
  assert.match(statuses.at(-1)?.text || "", /need remapping/);
  assert.equal(invalidations.at(-1), "display metadata reconciled against refreshed display");
});

test("effective metadata excludes assignments for targets missing from the current display", () => {
  const state = buildState();
  state.metadata.assignments = [
    { targetId: "Tree", tags: ["Existing"] },
    { targetId: "Retired", tags: ["Existing"] }
  ];
  state.metadata.preferencesByTargetId = {
    Snowman: { rolePreference: "accent" },
    Retired: { rolePreference: "focal" }
  };
  const runtime = buildRuntime(state);

  const effective = runtime.buildEffectiveMetadataAssignments();

  assert.deepEqual(effective.map((row) => row.targetId).sort(), ["Snowman", "Tree"]);
});
