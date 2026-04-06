import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  ensureProjectStructure,
  writeAnalysisArtifactToProject,
  readAnalysisArtifactFromProject,
  writeAnalysisArtifactToLibrary
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

test("readAnalysisArtifactFromProject resolves by explicit content fingerprint without media path", () => {
  const { root, projectFilePath } = makeTempProject();
  try {
    const mediaPath = path.join(root, "Candy Cane Lane.mp3");
    fs.writeFileSync(mediaPath, Buffer.from("bound-track-audio-content"));

    const artifact = {
      media: {
        path: mediaPath,
        fileName: path.basename(mediaPath)
      },
      identity: {
        title: "Candy Cane Lane",
        artist: "Sia",
        contentFingerprint: ""
      },
      provenance: {
        analysisProfile: {
          mode: "deep"
        }
      }
    };

    const written = writeAnalysisArtifactToProject({
      projectFilePath,
      mediaFilePath: mediaPath,
      artifact
    });
    assert.equal(written.ok, true);

    const fingerprint = String(written.contentFingerprint || "").trim();
    assert.ok(fingerprint);

    const read = readAnalysisArtifactFromProject({
      projectFilePath,
      contentFingerprint: fingerprint,
      preferredProfileMode: "deep"
    });

    assert.equal(read.ok, true);
    assert.equal(read.matchedBy, "contentFingerprint");
    assert.equal(read.artifact.identity.title, "Candy Cane Lane");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writeAnalysisArtifactToProject renames shared record to corrected title and artist slug", () => {
  const { root, projectFilePath } = makeTempProject();
  try {
    const mediaPath = path.join(root, "02 Candy Cane Lane.mp3");
    fs.writeFileSync(mediaPath, Buffer.from("corrected-track-identity-content"));

    const initialArtifact = {
      media: {
        path: mediaPath,
        fileName: path.basename(mediaPath)
      },
      identity: {
        title: "",
        artist: "",
        contentFingerprint: ""
      },
      provenance: {
        analysisProfile: {
          mode: "fast"
        }
      }
    };

    const initialWrite = writeAnalysisArtifactToProject({
      projectFilePath,
      mediaFilePath: mediaPath,
      artifact: initialArtifact
    });
    assert.equal(initialWrite.ok, true);
    assert.match(path.basename(initialWrite.recordPath), /^track-[a-f0-9]{8}(?:-[a-f0-9]{8})?\.json$/);
    assert.equal(fs.existsSync(initialWrite.recordPath), true);

    const correctedArtifact = {
      ...initialArtifact,
      identity: {
        title: "Candy Cane Lane",
        artist: "Sia",
        contentFingerprint: initialWrite.contentFingerprint
      }
    };

    const correctedWrite = writeAnalysisArtifactToProject({
      projectFilePath,
      mediaFilePath: mediaPath,
      artifact: correctedArtifact
    });
    assert.equal(correctedWrite.ok, true);
    assert.match(path.basename(correctedWrite.recordPath), /^candy-cane-lane-sia(?:-[a-f0-9]{8})?\.json$/);
    assert.equal(fs.existsSync(correctedWrite.recordPath), true);
    assert.equal(fs.existsSync(initialWrite.recordPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writeAnalysisArtifactToProject emits canonical track metadata timing tracks", () => {
  const { root, projectFilePath } = makeTempProject();
  try {
    const mediaPath = path.join(root, "Candy Cane Lane.mp3");
    fs.writeFileSync(mediaPath, Buffer.from("canonical-track-metadata-content"));

    const artifact = {
      media: {
        path: mediaPath,
        fileName: path.basename(mediaPath),
        durationMs: 120000
      },
      identity: {
        title: "Candy Cane Lane",
        artist: "Sia",
        isrc: "USRC17607839",
        contentFingerprint: ""
      },
      timing: {
        bpm: 128,
        timeSignature: "4/4",
        beats: [{ startMs: 0, endMs: 500, label: "1" }],
        bars: [{ startMs: 0, endMs: 2000, label: "1" }]
      },
      harmonic: {
        chords: [{ startMs: 0, endMs: 2000, label: "C" }]
      },
      lyrics: {
        lines: [{ startMs: 400, endMs: 1500, label: "Take a trip down Candy Cane Lane" }]
      },
      structure: {
        sections: [{ startMs: 0, endMs: 120000, label: "Verse 1" }]
      },
      provenance: {
        analysisProfile: {
          mode: "deep"
        }
      }
    };

    const written = writeAnalysisArtifactToProject({
      projectFilePath,
      mediaFilePath: mediaPath,
      artifact
    });
    assert.equal(written.ok, true);

    const stored = JSON.parse(fs.readFileSync(written.recordPath, "utf8"));
    assert.equal(stored.version, 2);
    assert.equal(stored.track.title, "Candy Cane Lane");
    assert.equal(stored.track.artist, "Sia");
    assert.equal(stored.track.verification.status, "present");
    assert.equal(stored.track.naming.shouldRename, false);
    assert.equal(stored.analysis.canonicalProfile, "deep");
    assert.deepEqual(stored.analysis.availableProfiles, ["deep"]);

    const names = stored.timingTracks.map((row) => row.name);
    assert.deepEqual(names, [
      "XD: Song Structure",
      "XD: Phrase Cues",
      "XD: Beats",
      "XD: Bars",
      "XD: Chords"
    ]);
    assert.equal(stored.timingTracks[0].segments[0].kind, "section");
    assert.equal(stored.timingTracks[1].segments[0].kind, "phrase");
    assert.equal(stored.timingTracks[2].tempoBpm, 128);
    assert.equal(stored.timingTracks[3].timeSignature, "4/4");
    assert.equal(stored.timingTracks[4].segments[0].label, "C");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writeAnalysisArtifactToLibrary writes shared track records directly under app root", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-analysis-library-"));
  try {
    const appRootPath = path.join(root, "xLightsDesigner");
    const mediaPath = path.join(root, "Christmas Vacation.mp3");
    fs.writeFileSync(mediaPath, Buffer.from("library-direct-write-content"));

    const artifact = {
      media: {
        path: mediaPath,
        fileName: path.basename(mediaPath),
        durationMs: 201000
      },
      identity: {
        title: "Christmas Vacation",
        artist: "Mavis Staples",
        contentFingerprint: ""
      },
      provenance: {
        analysisProfile: {
          mode: "deep"
        }
      }
    };

    const written = writeAnalysisArtifactToLibrary({
      appRootPath,
      mediaFilePath: mediaPath,
      artifact
    });
    assert.equal(written.ok, true);
    assert.equal(written.libraryDir, path.join(appRootPath, "library", "tracks"));
    assert.equal(fs.existsSync(written.recordPath), true);
    assert.match(path.basename(written.recordPath), /^christmas-vacation-mavis-staples(?:-[a-f0-9]{8})?\.json$/);

    const stored = JSON.parse(fs.readFileSync(written.recordPath, "utf8"));
    assert.equal(stored.track.title, "Christmas Vacation");
    assert.equal(stored.track.artist, "Mavis Staples");
    assert.equal(stored.track.sourceMedia.path, mediaPath);
    assert.equal(stored.analysis.canonicalProfile, "deep");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
