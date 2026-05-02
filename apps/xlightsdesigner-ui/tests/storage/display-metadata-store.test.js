import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildDisplayMetadataPaths,
  readDisplayMetadataDocument,
  readDisplayRefreshArtifact,
  readTargetBehaviorLearningDocument,
  writeDisplayMetadataDocument,
  writeDisplayRefreshArtifacts,
  writeTargetBehaviorLearningDocument
} from "../../storage/display-metadata-store.mjs";

function makeProjectFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-display-metadata-"));
  const projectDir = path.join(root, "projects", "Demo");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Demo.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ projectName: "Demo" }), "utf8");
  return { root, projectDir, projectFilePath };
}

test("display metadata store writes canonical project metadata document", () => {
  const { projectFilePath } = makeProjectFixture();
  const document = {
    version: 1,
    tags: [{ id: "tag-focal", name: "Focal", description: "Primary" }],
    targetTags: { Tree: ["tag-focal"] },
    preferencesByTargetId: {},
    visualHintDefinitions: []
  };

  const write = writeDisplayMetadataDocument({ projectFilePath, document });
  const read = readDisplayMetadataDocument({ projectFilePath });

  assert.equal(write.ok, true);
  assert.equal(read.ok, true);
  assert.equal(read.legacy, false);
  assert.equal(read.document.tags[0].name, "Focal");
  assert.equal(write.metadataPath, buildDisplayMetadataPaths(projectFilePath).metadataPath);
});

test("display metadata store reads legacy layout metadata when canonical file is absent", () => {
  const { projectDir, projectFilePath } = makeProjectFixture();
  const legacyPath = path.join(projectDir, "layout", "layout-metadata.json");
  fs.mkdirSync(path.dirname(legacyPath), { recursive: true });
  fs.writeFileSync(legacyPath, JSON.stringify({
    version: 1,
    tags: [{ id: "tag-old", name: "Legacy", description: "" }],
    targetTags: {},
    preferencesByTargetId: {},
    visualHintDefinitions: []
  }), "utf8");

  const read = readDisplayMetadataDocument({ projectFilePath });

  assert.equal(read.ok, true);
  assert.equal(read.legacy, true);
  assert.equal(read.document.tags[0].name, "Legacy");
});

test("display metadata store writes refreshed model index and reconciliation artifacts", () => {
  const { projectFilePath } = makeProjectFixture();

  const write = writeDisplayRefreshArtifacts({
    projectFilePath,
    targetMetadata: { artifactType: "display_model_index_v1", records: [{ targetId: "Tree" }] },
    reconciliation: { artifactType: "display_reconciliation_v1", orphanTargetIds: [] }
  });
  const modelIndex = readDisplayRefreshArtifact({ projectFilePath, kind: "model-index" });
  const reconciliation = readDisplayRefreshArtifact({ projectFilePath, kind: "reconciliation" });

  assert.equal(write.ok, true);
  assert.deepEqual(write.rows.map((row) => row.kind), ["model-index", "reconciliation"]);
  assert.equal(modelIndex.artifact.records[0].targetId, "Tree");
  assert.deepEqual(reconciliation.artifact.orphanTargetIds, []);
});

test("display metadata store writes project-local target behavior learning", () => {
  const { projectFilePath } = makeProjectFixture();
  const initial = readTargetBehaviorLearningDocument({ projectFilePath });
  const document = {
    artifactType: "project_target_behavior_learning_v1",
    artifactVersion: "1.0",
    records: [
      {
        recordId: "tbl1:abc12345",
        targetFingerprint: "tmf1:target001",
        targetId: "Tree",
        effectName: "On",
        stats: { sampleCount: 1 }
      }
    ]
  };
  const write = writeTargetBehaviorLearningDocument({ projectFilePath, document });
  const read = readTargetBehaviorLearningDocument({ projectFilePath });
  const artifact = readDisplayRefreshArtifact({ projectFilePath, kind: "target-behavior" });

  assert.equal(initial.ok, true);
  assert.equal(initial.exists, false);
  assert.equal(write.ok, true);
  assert.equal(read.ok, true);
  assert.equal(read.exists, true);
  assert.equal(read.document.records[0].targetFingerprint, "tmf1:target001");
  assert.equal(artifact.artifact.records[0].recordId, "tbl1:abc12345");
});
