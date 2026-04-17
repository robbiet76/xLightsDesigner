import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("build-layering-placement-evidence harvests placement refs from record files", () => {
  const root = mkdtempSync(join(tmpdir(), "layering-placement-evidence-"));
  const recordsDir = join(root, "records");
  mkdirSync(recordsDir, { recursive: true });

  const withPlacement = join(recordsDir, "sample-a.record.json");
  writeFileSync(withPlacement, JSON.stringify({
    sampleId: "sample-a",
    placementId: "placement-1",
    artifact: {
      previewSceneWindowRef: "/tmp/sample-a.preview-window.json",
      renderObservationRef: "/tmp/sample-a.render-observation.json"
    }
  }, null, 2));

  const withoutPlacement = join(recordsDir, "sample-b.record.json");
  writeFileSync(withoutPlacement, JSON.stringify({
    sampleId: "sample-b",
    artifact: {
      previewSceneWindowRef: "/tmp/sample-b.preview-window.json"
    }
  }, null, 2));

  const outPath = join(root, "layering-placement-evidence.json");
  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-layering-placement-evidence.py",
    "--records-root",
    recordsDir,
    "--out",
    outPath
  ], { cwd: process.cwd(), stdio: "pipe" });

  const out = JSON.parse(readFileSync(outPath, "utf8"));
  assert.equal(out.artifactType, "layering_placement_evidence_v1");
  assert.equal(out.placements.length, 1);
  assert.equal(out.placements[0].placementId, "placement-1");
  assert.match(out.placements[0].previewSceneWindowRef, /sample-a\.preview-window\.json$/);
  assert.equal(out.skipped.length, 1);
  assert.equal(out.skipped[0].reason, "missing placementId");
});

