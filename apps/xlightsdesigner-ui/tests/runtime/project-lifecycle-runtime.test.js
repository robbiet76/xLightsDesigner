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
