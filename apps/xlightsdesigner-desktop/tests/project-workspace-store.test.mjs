import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  writeProjectFileRecord,
  readProjectFileRecord,
  writeSequenceSidecarFile,
  readSequenceSidecarFile,
  createSequenceBackupFile,
  restoreSequenceBackupFile,
  listSequenceFilesInShowFolder,
  listMediaFilesInFolder,
  saveReferenceMediaFile
} from "../../xlightsdesigner-ui/storage/project-workspace-store.mjs";

function makeTempRoot(prefix = "xld-project-workspace-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("project workspace store writes and reads canonical project files", () => {
  const root = makeTempRoot();
  try {
    const snapshot = { projectMission: "Warm and welcoming.", layout: {} };
    const write = writeProjectFileRecord({
      rootPath: root,
      projectName: "Christmas 2026",
      showFolder: "/show",
      mediaPath: "/media",
      snapshot
    });
    assert.equal(write.ok, true);
    assert.equal(path.basename(write.filePath), "Christmas 2026.xdproj");

    const read = readProjectFileRecord({ filePath: write.filePath });
    assert.equal(read.ok, true);
    assert.equal(read.project.projectName, "Christmas 2026");
    assert.equal(read.project.showFolder, "/show");
    assert.equal(read.project.appRootPath, root);
    assert.deepEqual(read.snapshot, snapshot);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("project workspace store writes and reads managed sequence sidecars", () => {
  const root = makeTempRoot();
  try {
    const sequencePath = path.join(root, "show", "song.xsq");
    fs.mkdirSync(path.dirname(sequencePath), { recursive: true });
    fs.writeFileSync(sequencePath, "sequence", "utf8");

    const write = writeSequenceSidecarFile({
      sequencePath,
      appRootPath: root,
      data: { activeTrack: "Song Structure" }
    });
    assert.equal(write.ok, true);
    assert.match(write.sidecarPath, /sequence\.xdmeta$/);

    const read = readSequenceSidecarFile({ sequencePath, appRootPath: root });
    assert.equal(read.ok, true);
    assert.equal(read.exists, true);
    assert.deepEqual(read.data, { activeTrack: "Song Structure" });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("project workspace store creates and restores sequence backups", () => {
  const root = makeTempRoot();
  try {
    const sequencePath = path.join(root, "show", "song.xsq");
    fs.mkdirSync(path.dirname(sequencePath), { recursive: true });
    fs.writeFileSync(sequencePath, "original", "utf8");

    const backup = createSequenceBackupFile({ sequencePath });
    assert.equal(backup.ok, true);
    assert.equal(fs.existsSync(backup.backupPath), true);

    fs.writeFileSync(sequencePath, "changed", "utf8");
    const restore = restoreSequenceBackupFile({ sequencePath, backupPath: backup.backupPath });
    assert.equal(restore.ok, true);
    assert.equal(fs.readFileSync(sequencePath, "utf8"), "original");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("project workspace store lists sequences and media files", () => {
  const root = makeTempRoot();
  try {
    const showFolder = path.join(root, "show");
    const mediaFolder = path.join(root, "media");
    fs.mkdirSync(path.join(showFolder, "nested"), { recursive: true });
    fs.mkdirSync(mediaFolder, { recursive: true });
    fs.writeFileSync(path.join(showFolder, "a.xsq"), "a", "utf8");
    fs.writeFileSync(path.join(showFolder, "nested", "b.xsq"), "b", "utf8");
    fs.mkdirSync(path.join(showFolder, ".xlightsdesigner-backups"), { recursive: true });
    fs.writeFileSync(path.join(showFolder, ".xlightsdesigner-backups", "skip.xsq"), "skip", "utf8");
    fs.writeFileSync(path.join(mediaFolder, "song.mp3"), "mp3", "utf8");
    fs.writeFileSync(path.join(mediaFolder, "notes.txt"), "txt", "utf8");

    const sequences = listSequenceFilesInShowFolder({ showFolder });
    assert.equal(sequences.ok, true);
    assert.equal(sequences.sequences.length, 2);
    assert.equal(sequences.stats.xsqCount, 2);

    const media = listMediaFilesInFolder({ mediaFolder, extensions: ["mp3"] });
    assert.equal(media.ok, true);
    assert.equal(media.mediaFiles.length, 1);
    assert.equal(media.mediaFiles[0].fileName, "song.mp3");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("project workspace store saves reference media beside the sequence", () => {
  const root = makeTempRoot();
  try {
    const sequencePath = path.join(root, "show", "song.xsq");
    fs.mkdirSync(path.dirname(sequencePath), { recursive: true });
    fs.writeFileSync(sequencePath, "sequence", "utf8");

    const bytes = Uint8Array.from([1, 2, 3, 4]).buffer;
    const save = saveReferenceMediaFile({ sequencePath, fileName: "Ref Image?.png", bytes });
    assert.equal(save.ok, true);
    assert.equal(fs.existsSync(save.absolutePath), true);
    assert.equal(path.basename(save.absolutePath), "Ref Image_.png");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
