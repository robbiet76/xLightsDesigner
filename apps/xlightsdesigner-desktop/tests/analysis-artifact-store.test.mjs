import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ensureProjectStructure,
  writeAnalysisArtifactToProject,
  readAnalysisArtifactFromProject
} from "../analysis-artifact-store.mjs";

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-analysis-artifact-store-"));
  const projectDir = path.join(root, "project");
  ensureProjectStructure(projectDir);
  const projectFilePath = path.join(projectDir, "test.xldproj");
  fs.writeFileSync(projectFilePath, "{}", "utf8");
  return { root, projectDir, projectFilePath };
}

test("readAnalysisArtifactFromProject falls back to matching content fingerprint after media rename", () => {
  const { root, projectFilePath } = makeTempProject();
  try {
    const originalPath = path.join(root, "Track A.mp3");
    const renamedPath = path.join(root, "Track Renamed.mp3");
    const bytes = Buffer.from("same-audio-content-for-fingerprint");
    fs.writeFileSync(originalPath, bytes);
    fs.writeFileSync(renamedPath, bytes);

    const artifact = {
      media: {
        path: originalPath,
        fileName: path.basename(originalPath)
      },
      identity: {
        title: "Track A",
        artist: "Artist",
        contentFingerprint: ""
      },
      provenance: {
        analysisProfile: {
          mode: "fast"
        }
      }
    };

    const written = writeAnalysisArtifactToProject({
      projectFilePath,
      mediaFilePath: originalPath,
      artifact
    });
    assert.equal(written.ok, true);

    assert.match(path.basename(written.recordPath), /^track-a-artist(?:-[a-f0-9]{8})?\.json$/);
    const stored = JSON.parse(fs.readFileSync(written.profileArtifactPath, "utf8"));
    const contentFingerprint = String(stored.track?.identity?.contentFingerprint || "").trim();
    assert.ok(contentFingerprint);


    const read = readAnalysisArtifactFromProject({
      projectFilePath,
      mediaFilePath: renamedPath,
      preferredProfileMode: "fast"
    });
    assert.equal(read.ok, true);
    assert.equal(read.matchedBy, "contentFingerprint");
    assert.equal(read.artifact.identity.title, "Track A");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
