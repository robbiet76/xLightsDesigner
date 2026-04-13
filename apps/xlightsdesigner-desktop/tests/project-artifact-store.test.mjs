import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { writeProjectArtifacts, readProjectArtifact } from "../../xlightsdesigner-ui/storage/project-artifact-store.mjs";

test("project artifact store writes and reads immutable artifacts by id", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-project-artifacts-"));
  const projectDir = path.join(root, "projects", "Christmas 2026");
  fs.mkdirSync(projectDir, { recursive: true });
  const projectFilePath = path.join(projectDir, "Christmas 2026.xdproj");
  fs.writeFileSync(projectFilePath, JSON.stringify({ projectName: "Christmas 2026" }), "utf8");

  const artifacts = [
    {
      artifactType: "creative_brief_v1",
      artifactId: "creative_brief_v1-brief123",
      createdAt: "2026-03-13T12:00:00.000Z",
      summary: "Brief"
    },
    {
      artifactType: "history_entry_v1",
      artifactId: "history_entry_v1-entry123",
      createdAt: "2026-03-13T12:01:00.000Z",
      summary: "Apply snapshot"
    },
    {
      artifactType: "render_observation_v1",
      artifactId: "render_observation_v1-render123",
      createdAt: "2026-03-13T12:01:30.000Z",
      summary: "Render observation"
    },
    {
      artifactType: "sequence_render_critique_context_v1",
      artifactId: "sequence_render_critique_context_v1-critique123",
      createdAt: "2026-03-13T12:01:45.000Z",
      summary: "Render critique"
    }
  ];

  const writeRes = writeProjectArtifacts({ projectFilePath, artifacts });
  assert.equal(writeRes.ok, true);
  assert.equal(writeRes.rows.length, 4);

  const briefRes = readProjectArtifact({
    projectFilePath,
    artifactType: "creative_brief_v1",
    artifactId: "creative_brief_v1-brief123"
  });
  assert.equal(briefRes.ok, true);
  assert.equal(briefRes.artifact.summary, "Brief");

  const historyRes = readProjectArtifact({
    projectFilePath,
    artifactType: "history_entry_v1",
    artifactId: "history_entry_v1-entry123"
  });
  assert.equal(historyRes.ok, true);
  assert.match(historyRes.artifactPath, /history\/history_entry_v1-entry123\.json$/);

  const renderRes = readProjectArtifact({
    projectFilePath,
    artifactType: "render_observation_v1",
    artifactId: "render_observation_v1-render123"
  });
  assert.equal(renderRes.ok, true);
  assert.match(renderRes.artifactPath, /artifacts\/render-observations\/render_observation_v1-render123\.json$/);

  fs.rmSync(root, { recursive: true, force: true });
});
