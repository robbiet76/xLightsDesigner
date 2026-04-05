import test from "node:test";
import assert from "node:assert/strict";

import { createProjectCatalogRuntime } from "../../runtime/project-catalog-runtime.js";

test("project catalog runtime refreshes sequence catalog", async () => {
  const state = {
    showFolder: "/show",
    sequenceCatalog: [],
    showDirectoryStats: {},
    sequencePathInput: "",
    ui: { sequenceMode: "existing" }
  };
  const runtime = createProjectCatalogRuntime({
    state,
    getDesktopSequenceBridge: () => ({
      listSequencesInShowFolder: async () => ({
        ok: true,
        sequences: [{ path: "/show/A.xsq" }],
        stats: { xsqCount: 1, xdmetaCount: 0 }
      })
    })
  });

  await runtime.refreshSequenceCatalog({ silent: true });

  assert.equal(state.sequenceCatalog.length, 1);
  assert.equal(state.sequencePathInput, "/show/A.xsq");
  assert.equal(state.showDirectoryStats.xsqCount, 1);
});

test("project catalog runtime refreshes media catalog and adopts exact-path match", async () => {
  const calls = [];
  const state = {
    mediaPath: "/media",
    mediaCatalog: [],
    audioPathInput: "",
    sequenceMediaFile: "/media/song.mp3"
  };
  const runtime = createProjectCatalogRuntime({
    state,
    supportedSequenceMediaExtensions: [".mp3"],
    getDesktopMediaCatalogBridge: () => ({
      listMediaFilesInFolder: async () => ({
        ok: true,
        mediaFiles: [{ path: "/media/song.mp3" }]
      })
    }),
    resolvePreferredMediaCatalogEntry: (rows) => ({ row: rows[0], basis: "exact_path" }),
    setAudioPathWithAgentPolicy: (path, reason) => {
      calls.push({ path, reason });
      state.audioPathInput = path;
    }
  });

  await runtime.refreshMediaCatalog({ silent: true });

  assert.equal(state.mediaCatalog.length, 1);
  assert.equal(state.audioPathInput, "/media/song.mp3");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].reason, "media catalog preferred track");
});
