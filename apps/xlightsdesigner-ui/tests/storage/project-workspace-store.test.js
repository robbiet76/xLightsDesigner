import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildProjectSequencePaths,
  readProjectFileRecord,
  readProjectSequenceRecord,
  writeProjectFileRecord,
  writeProjectSequenceRecord
} from "../../storage/project-workspace-store.mjs";

function makeSnapshot(overrides = {}) {
  return {
    projectName: "Demo",
    showFolder: "/shows/A",
    mediaPath: "",
    ...overrides
  };
}

test("project identity is stable when show folder linkage changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-project-workspace-"));
  const first = writeProjectFileRecord({
    rootPath: root,
    projectName: "Demo",
    showFolder: "/shows/A",
    snapshot: makeSnapshot({ showFolder: "/shows/A" })
  });
  const second = writeProjectFileRecord({
    rootPath: root,
    currentFilePath: first.filePath,
    projectName: "Demo",
    showFolder: "/shows/B",
    snapshot: makeSnapshot({ showFolder: "/shows/B" })
  });
  const read = readProjectFileRecord({ filePath: first.filePath });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.project.id, first.project.id);
  assert.equal(second.project.key, "Demo");
  assert.equal(read.project.id, first.project.id);
  assert.equal(read.project.showFolder, "/shows/B");
});

test("project structure includes project-owned sequence and artifact roots", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-project-structure-"));
  const write = writeProjectFileRecord({
    rootPath: root,
    projectName: "Demo",
    showFolder: "/shows/A",
    snapshot: makeSnapshot()
  });
  const projectDir = path.dirname(write.filePath);

  assert.equal(fs.existsSync(path.join(projectDir, "display")), true);
  assert.equal(fs.existsSync(path.join(projectDir, "sequences")), true);
  assert.equal(fs.existsSync(path.join(projectDir, "artifacts")), true);
});

test("project sequence record survives show-folder relink by strong identity", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-project-sequence-"));
  const project = writeProjectFileRecord({
    rootPath: root,
    projectName: "Demo",
    showFolder: "/shows/A",
    snapshot: makeSnapshot()
  });
  const first = writeProjectSequenceRecord({
    projectFilePath: project.filePath,
    sequencePath: "/shows/A/Sequences/Holiday.xsq",
    showFolder: "/shows/A",
    contentFingerprint: "seq-content-001",
    trackFingerprint: "track-content-001",
    mediaPath: "/shows/A/Music/Holiday.mp3",
    displayName: "Holiday"
  });
  const relinked = writeProjectSequenceRecord({
    projectFilePath: project.filePath,
    sequencePath: "/shows/B/Copied/Holiday.xsq",
    showFolder: "/shows/B",
    contentFingerprint: "seq-content-001",
    trackFingerprint: "track-content-001",
    mediaPath: "/shows/B/Music/Holiday.mp3",
    displayName: "Holiday"
  });
  const read = readProjectSequenceRecord({
    projectFilePath: project.filePath,
    contentFingerprint: "seq-content-001"
  });

  assert.equal(first.ok, true);
  assert.equal(relinked.ok, true);
  assert.equal(relinked.sequenceId, first.sequenceId);
  assert.equal(read.exists, true);
  assert.equal(read.record.linkage.sequencePath, "/shows/B/Copied/Holiday.xsq");
  assert.equal(read.record.linkage.showFolderAtLastUse, "/shows/B");
  assert.deepEqual(read.record.linkage.priorSequencePaths, ["/shows/A/Sequences/Holiday.xsq"]);
});

test("project sequence paths are project-owned and do not point at show folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-project-sequence-paths-"));
  const project = writeProjectFileRecord({
    rootPath: root,
    projectName: "Demo",
    showFolder: "/shows/A",
    snapshot: makeSnapshot()
  });
  const paths = buildProjectSequencePaths({
    projectFilePath: project.filePath,
    sequencePath: "/shows/A/Sequence.xsq"
  });

  assert.match(paths.sequenceDir, /projects\/Demo\/sequences\//);
  assert.equal(paths.sequenceRecordPath.endsWith("/sequence.json"), true);
  assert.equal(paths.sequenceDir.startsWith("/shows/A"), false);
});
