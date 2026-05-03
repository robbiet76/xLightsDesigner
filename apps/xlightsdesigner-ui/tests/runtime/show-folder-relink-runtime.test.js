import test from "node:test";
import assert from "node:assert/strict";

import { relinkProjectShowFolder } from "../../runtime/show-folder-relink-runtime.js";

test("relinkProjectShowFolder refreshes derived display state and preserves durable metadata", async () => {
  const calls = [];
  const state = {
    showFolder: "/shows/A",
    proposed: ["stale proposal"],
    flags: { proposalStale: false, hasDraftProposal: true },
    metadata: {
      assignments: [{ targetId: "Tree", tags: ["focal"] }],
      preferencesByTargetId: { Tree: { rolePreference: "lead" } },
      displayBinding: { status: "reconciled" }
    },
    sequenceAgentRuntime: {}
  };

  const out = await relinkProjectShowFolder({
    state,
    showFolder: "/shows/B",
    deps: {
      markDisplayMetadataPendingReconciliation: (reason) => {
        calls.push(`pending:${reason}`);
        state.metadata.displayBinding = {
          ...state.metadata.displayBinding,
          status: "pending",
          pendingReason: reason
        };
      },
      clearSequencingHandoffsForSequenceChange: (reason) => calls.push(`clear:${reason}`),
      onRefreshSequenceCatalog: async () => {
        calls.push("sequence-catalog");
        return { ok: true };
      },
      onRefreshMediaCatalog: async () => {
        calls.push("media-catalog");
        return { ok: true };
      },
      onRefreshDisplay: async () => {
        calls.push("display-refresh");
        return { ok: true };
      },
      reconcileDisplayMetadataForSceneGraphChange: ({ reason }) => {
        calls.push(`reconcile:${reason}`);
        state.metadata.displayBinding = {
          ...state.metadata.displayBinding,
          status: "reconciled",
          showFolder: state.showFolder
        };
        return state.metadata.displayBinding;
      },
      saveProjectToCurrentFile: async ({ reason }) => {
        calls.push(`save:${reason}`);
        return { ok: true };
      },
      persist: () => calls.push("persist"),
      render: () => calls.push("render"),
      setStatus: (level, text) => {
        calls.push(`status:${level}`);
        state.status = { level, text };
      }
    }
  });

  assert.equal(out.ok, true);
  assert.equal(out.changed, true);
  assert.equal(out.previousShowFolder, "/shows/A");
  assert.equal(out.showFolder, "/shows/B");
  assert.equal(state.showFolder, "/shows/B");
  assert.deepEqual(state.metadata.assignments, [{ targetId: "Tree", tags: ["focal"] }]);
  assert.deepEqual(state.metadata.preferencesByTargetId, { Tree: { rolePreference: "lead" } });
  assert.equal(state.metadata.displayBinding.status, "reconciled");
  assert.equal(state.metadata.displayBinding.showFolder, "/shows/B");
  assert.equal(state.flags.proposalStale, true);
  assert.equal(state.sequenceAgentRuntime.displayRelink.previousShowFolder, "/shows/A");
  assert.deepEqual(calls, [
    "pending:show folder changed",
    "clear:show folder changed",
    "sequence-catalog",
    "media-catalog",
    "display-refresh",
    "reconcile:show folder relink",
    "save:show_folder_relink",
    "status:info",
    "persist",
    "render"
  ]);
});

test("relinkProjectShowFolder no-ops when show folder did not change", async () => {
  let refreshed = false;
  const state = { showFolder: "/shows/A" };
  const out = await relinkProjectShowFolder({
    state,
    showFolder: "/shows/A",
    deps: {
      onRefreshDisplay: async () => {
        refreshed = true;
      }
    }
  });

  assert.equal(out.ok, true);
  assert.equal(out.changed, false);
  assert.equal(refreshed, false);
});
