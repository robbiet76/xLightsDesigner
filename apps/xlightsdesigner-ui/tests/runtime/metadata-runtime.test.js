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
    buildRuntimeEffectiveMetadataAssignments: (assignments, preferencesByTargetId, deps = {}) =>
      assignments.map((row) => ({
        ...row,
        resolved: deps.resolveTarget ? deps.resolveTarget(row.targetId) : null,
        preferences: preferencesByTargetId[row.targetId] || null
      })),
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
  assert.deepEqual(state.metadata.visualHintDefinitions.map((row) => row.name), ["Sparkle", "Cool"]);
  assert.equal(invalidations.at(-1), "metadata semantic hints changed");
});
