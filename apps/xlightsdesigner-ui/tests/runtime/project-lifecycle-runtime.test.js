import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCanonicalProjectFilePath,
  inferProjectRootFromFilePath,
  normalizeProjectDisplayName,
  createProjectLifecycleRuntime
} from "../../runtime/project-lifecycle-runtime.js";

test("project lifecycle helpers normalize and derive project paths", () => {
  assert.equal(normalizeProjectDisplayName(' My:Project. '), "My Project");
  assert.equal(
    buildCanonicalProjectFilePath("/root/app", "My Project"),
    "/root/app/projects/My Project/My Project.xdproj"
  );
  assert.equal(
    inferProjectRootFromFilePath("/root/app/projects/My Project/My Project.xdproj"),
    "/root/app"
  );
});

test("project lifecycle dialog helpers update UI state", () => {
  const state = {
    ui: {}
  };
  let persisted = 0;
  let rendered = 0;
  const runtime = createProjectLifecycleRuntime({
    state,
    persist: () => { persisted += 1; },
    render: () => { rendered += 1; }
  });

  runtime.openProjectNameDialog({ mode: "create", title: "Create New Project", initialName: "Demo" });
  assert.equal(state.ui.projectNameDialogOpen, true);
  assert.equal(state.ui.projectNameDialogMode, "create");
  assert.equal(state.ui.projectNameDialogTitle, "Create New Project");
  assert.equal(state.ui.projectNameDialogValue, "Demo");

  runtime.closeProjectNameDialog();
  assert.equal(state.ui.projectNameDialogOpen, false);
  assert.equal(state.ui.projectNameDialogMode, "");
  assert.equal(state.ui.projectNameDialogTitle, "");
  assert.equal(state.ui.projectNameDialogValue, "");
  assert.ok(persisted >= 2);
  assert.ok(rendered >= 2);
});

test("opening a project notifies display-context listeners after hydrating snapshot", async () => {
  const state = {
    projectMetadataRoot: "/root/app",
    projectName: "Current",
    showFolder: "/show/current",
    mediaPath: "",
    ui: {}
  };
  const order = [];
  const runtime = createProjectLifecycleRuntime({
    state,
    app: { querySelector: () => null },
    getAppProjectBridge: () => ({
      openProjectFile: async () => ({
        ok: true,
        snapshot: { marker: "snapshot" },
        project: {
          appRootPath: "/root/app",
          projectName: "Opened",
          showFolder: "/show/opened",
          mediaPath: "/show/media"
        }
      })
    }),
    parseProjectKey: () => ({ projectName: "Opened", showFolder: "/show/opened" }),
    applyProjectSnapshot: () => {
      order.push("snapshot");
      state.snapshotApplied = true;
    },
    onProjectContextChanged: (context) => {
      order.push("context");
      state.context = context;
    }
  });

  await runtime.openSelectedProject("Opened::/show/opened");

  assert.deepEqual(order, ["snapshot", "context"]);
  assert.equal(state.context.reason, "project opened");
  assert.equal(state.context.projectName, "Opened");
  assert.equal(state.context.showFolder, "/show/opened");
});

test("creating a new project starts with blank project metadata", async () => {
  const defaultState = {
    metadata: {
      tags: ["focal"],
      assignments: [],
      preferencesByTargetId: {},
      visualHintDefinitions: [],
      displayBinding: { status: "unknown" },
      ignoredOrphanTargetIds: []
    }
  };
  const state = {
    projectName: "Old",
    showFolder: "/show",
    mediaPath: "/media",
    metadata: {
      tags: ["old"],
      assignments: [{ targetId: "Tree", tags: ["old"] }],
      preferencesByTargetId: { Tree: { rolePreference: "focal" } }
    },
    ui: {
      projectNameDialogMode: "create",
      projectNameDialogValue: "New Project",
      metadataTargetId: "Tree",
      metadataSelectionIds: ["Tree"],
      metadataSelectedTags: ["old"],
      metadataNewTag: "old",
      metadataNewTagDescription: "old",
      metadataFilterName: "tree",
      metadataFilterType: "model",
      metadataFilterRole: "focal",
      metadataFilterVisualHints: "sparkle",
      metadataFilterEffectAvoidances: "none",
      metadataFilterSupport: "supported",
      metadataFilterTags: "old",
      metadataFilterMetadata: "old",
      metadataFilterDimension: "metadata"
    },
    flags: {},
    recentSequences: ["a"],
    projectSequences: ["b"]
  };
  let savedSnapshot = null;
  const runtime = createProjectLifecycleRuntime({
    state,
    defaultState,
    saveProjectToCurrentFile: async () => {
      savedSnapshot = structuredClone(state.metadata);
      return { ok: true, filePath: "/projects/New Project/New Project.xdproj" };
    },
    resetSessionDraftState: () => {},
    resetCreativeState: () => {},
    saveCurrentProjectSnapshot: () => {},
    persist: () => {},
    render: () => {}
  });

  await runtime.confirmProjectNameDialog();

  assert.equal(state.projectName, "New Project");
  assert.deepEqual(state.metadata, defaultState.metadata);
  assert.deepEqual(savedSnapshot, defaultState.metadata);
  assert.equal(state.ui.metadataTargetId, "");
  assert.deepEqual(state.ui.metadataSelectionIds, []);
  assert.equal(state.ui.metadataFilterName, "");
});

test("save as preserves current display metadata as a migrated project copy", async () => {
  const migratedMetadata = {
    tags: ["mature"],
    assignments: [{ targetId: "Tree", tags: ["mature"] }],
    preferencesByTargetId: { Tree: { rolePreference: "focal" } }
  };
  const state = {
    projectName: "Old",
    metadata: structuredClone(migratedMetadata),
    ui: {
      projectNameDialogMode: "saveAs",
      projectNameDialogValue: "Migrated"
    }
  };
  let savedSnapshot = null;
  const runtime = createProjectLifecycleRuntime({
    state,
    defaultState: { metadata: { assignments: [] } },
    saveProjectToCurrentFile: async ({ saveAs }) => {
      assert.equal(saveAs, true);
      savedSnapshot = structuredClone(state.metadata);
      return { ok: true, filePath: "/projects/Migrated/Migrated.xdproj" };
    },
    saveCurrentProjectSnapshot: () => {},
    persist: () => {},
    render: () => {}
  });

  await runtime.confirmProjectNameDialog();

  assert.equal(state.projectName, "Migrated");
  assert.deepEqual(savedSnapshot, migratedMetadata);
  assert.deepEqual(state.metadata, migratedMetadata);
});

test("resetProjectWorkspace restores project draft state to defaults", () => {
  const defaultState = {
    sequencePathInput: "",
    newSequencePathInput: "",
    newSequenceType: "musical",
    newSequenceDurationMs: 60000,
    newSequenceFrameMs: 50,
    audioPathInput: "",
    mediaPath: "",
    savePathInput: "",
    lastApplyBackupPath: "",
    proposed: [],
    metadata: { assignments: [] }
  };
  const state = {
    sequencePathInput: "/show/seq.xsq",
    newSequencePathInput: "/show/new.xsq",
    newSequenceType: "animation",
    newSequenceDurationMs: 1000,
    newSequenceFrameMs: 25,
    audioPathInput: "/show/media/song.mp3",
    mediaPath: "/show/media",
    mediaCatalog: [{}],
    savePathInput: "/show/seq.xsq",
    lastApplyBackupPath: "/tmp/backup.xsq",
    recentSequences: ["a"],
    projectSequences: ["b"],
    revision: "rev-1",
    draftBaseRevision: "rev-0",
    proposed: ["row"],
    flags: {
      planOnlyMode: true,
      planOnlyForcedByConnectivity: true,
      planOnlyForcedByRollout: true,
      hasDraftProposal: true,
      proposalStale: true
    },
    ui: {
      sectionSelections: ["Verse"],
      designTab: "review",
      designRevisionTarget: "x",
      sequenceDesignFilterId: "y",
      sequenceMode: "new",
      sectionTrackName: "XD: Song Structure",
      metadataTargetId: "target",
      metadataSelectionIds: ["1"],
      metadataSelectedTags: ["tag"],
      metadataNewTag: "new",
      metadataNewTagDescription: "desc",
      agentResponseId: "resp",
      metadataFilterName: "name",
      metadataFilterType: "type",
      metadataFilterRole: "role",
      metadataFilterVisualHints: "hint",
      metadataFilterEffectAvoidances: "avoid",
      metadataFilterSupport: "support",
      metadataFilterTags: "tags",
      metadataFilterMetadata: "meta",
      metadataFilterDimension: "x",
      detailsOpen: true,
      chatDraft: "draft"
    },
    chat: ["msg"],
    diagnostics: ["diag"],
    jobs: ["job"],
    sectionStartByLabel: { Intro: 0 },
    metadata: { assignments: ["a"] }
  };
  let savedStore = null;
  const runtime = createProjectLifecycleRuntime({
    state,
    defaultState,
    getProjectKey: () => "Demo::/show",
    confirm: () => true,
    loadProjectsStore: () => ({}),
    persistProjectsStore: (store) => { savedStore = store; },
    extractProjectSnapshot: () => ({ snapshot: true }),
    resetCreativeState: () => { state._creativeReset = true; },
    setStatus: (level, text) => { state._status = { level, text }; },
    persist: () => { state._persisted = true; },
    render: () => { state._rendered = true; }
  });

  runtime.resetProjectWorkspace();

  assert.equal(state.sequencePathInput, "");
  assert.equal(state.audioPathInput, "");
  assert.equal(state.flags.planOnlyMode, false);
  assert.deepEqual(state.ui.sectionSelections, ["all"]);
  assert.deepEqual(state.chat, []);
  assert.deepEqual(state.metadata, defaultState.metadata);
  assert.equal(state._creativeReset, true);
  assert.equal(savedStore["Demo::/show"].snapshot, true);
});
