import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

test("build-preview-window-frame-offsets emits broad distributed offsets", () => {
  const dir = mkdtempSync(join(tmpdir(), "preview-window-frame-offsets-"));
  const planPath = join(dir, "window-plan.json");
  writeFileSync(planPath, JSON.stringify({
    artifactType: "mature_sequence_window_plan_v1",
    stepTimeMs: 50,
    windows: [
      {
        name: "opening",
        startMs: 0,
        endMs: 8000,
        durationMs: 8000
      }
    ]
  }, null, 2));

  const outPath = join(dir, "offsets.json");
  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-preview-window-frame-offsets.py",
    "--window-plan", planPath,
    "--window-name", "opening",
    "--out", outPath
  ], { cwd: "/Users/robterry/Projects/xLightsDesigner" });

  const out = JSON.parse(readFileSync(outPath, "utf8"));
  assert.equal(out.artifactType, "preview_window_frame_offsets_v1");
  assert.equal(out.samplingMode, "broad_window");
  assert.deepEqual(out.frameOffsets, [13, 45, 80, 114, 146]);
  assert.equal(out.frameOffsetsCsv, "13,45,80,114,146");
});
