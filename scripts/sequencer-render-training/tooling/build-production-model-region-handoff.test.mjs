import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function writeFile(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text);
}

function writeJson(filePath, payload) {
  writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test("production model region handoff maps xsq targets onto layout regions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-model-region-handoff-"));
  const xsqPath = path.join(root, "Show", "Song", "Song.xsq");
  const manifestPath = path.join(root, "manifest.json");
  const geometryPath = path.join(root, "geometry.json");
  const outPath = path.join(root, "handoff.json");
  writeFile(xsqPath, `<?xml version="1.0" encoding="UTF-8"?>
<xsequence>
  <head><sequenceDuration>6.0</sequenceDuration></head>
  <ElementEffects>
    <Element type="model" name="LeftArch">
      <EffectLayer><Effect name="Bars" startTime="0" endTime="2500"/></EffectLayer>
    </Element>
    <Element type="model" name="RightTree">
      <EffectLayer><Effect name="On" startTime="2500" endTime="6000"/></EffectLayer>
    </Element>
    <Element type="model" name="GroupOnly">
      <EffectLayer><Effect name="Pinwheel" startTime="0" endTime="6000"/></EffectLayer>
    </Element>
  </ElementEffects>
</xsequence>`);
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    sequences: [{
      sequenceId: "Song",
      folderName: "Song",
      readOnly: true,
      xsq: { path: xsqPath }
    }]
  });
  writeJson(geometryPath, {
    artifactType: "preview_scene_geometry_v1",
    summaries: {
      sceneBounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } }
    },
    scene: {
      models: [
        {
          name: "LeftArch",
          displayAs: "Single Line",
          nodes: [{ coords: [{ screen: { x: 10, y: 50 } }] }]
        },
        {
          name: "RightTree",
          displayAs: "Tree Flat",
          nodes: [{ coords: [{ screen: { x: 90, y: 40 } }] }]
        }
      ]
    }
  });

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-production-model-region-handoff.py",
    "--manifest", manifestPath,
    "--geometry", geometryPath,
    "--out", outPath,
    "--window-count", "3"
  ], { cwd: path.resolve("."), stdio: "pipe" });

  const artifact = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(artifact.artifactType, "production_model_region_handoff_v1");
  assert.equal(artifact.summary.sequenceCount, 1);
  assert.equal(artifact.summary.modelRegionCount, 2);
  assert.equal(artifact.references[0].windowCount, 3);
  assert.equal(artifact.references[0].scores.leadTargetChangeRatio > 0, true);
  assert.equal(artifact.references[0].windows[0].leadTarget, "LeftArch");
  assert.equal(artifact.references[0].windows[2].leadTarget, "RightTree");
  assert.equal(artifact.references[0].windows[0].topUnresolvedTargets[0].target, "GroupOnly");
});

test("production model region handoff can restrict scoring to accepted baseline references", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-model-region-handoff-baseline-"));
  const acceptedXsq = path.join(root, "Show", "Accepted", "Accepted.xsq");
  const invalidXsq = path.join(root, "Show", "Invalid", "Invalid.xsq");
  const manifestPath = path.join(root, "manifest.json");
  const geometryPath = path.join(root, "geometry.json");
  const baselinePath = path.join(root, "baseline.json");
  const outPath = path.join(root, "handoff.json");
  writeFile(acceptedXsq, `<?xml version="1.0" encoding="UTF-8"?>
<xsequence><head><sequenceDuration>4.0</sequenceDuration></head><ElementEffects>
  <Element type="model" name="Arch"><EffectLayer><Effect name="Bars" startTime="0" endTime="4000"/></EffectLayer></Element>
</ElementEffects></xsequence>`);
  writeFile(invalidXsq, `<?xml version="1.0" encoding="UTF-8"?>
<xsequence><head><sequenceDuration>4.0</sequenceDuration></head><ElementEffects></ElementEffects></xsequence>`);
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    sequences: [
      { sequenceId: "Accepted", folderName: "Accepted", readOnly: true, xsq: { path: acceptedXsq } },
      { sequenceId: "Invalid", folderName: "Invalid", readOnly: true, xsq: { path: invalidXsq } }
    ]
  });
  writeJson(baselinePath, {
    artifactType: "production_video_calibration_baseline_v1",
    references: [{ sequenceId: "Accepted" }]
  });
  writeJson(geometryPath, {
    artifactType: "preview_scene_geometry_v1",
    summaries: { sceneBounds: { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } } },
    scene: { models: [{ name: "Arch", nodes: [{ coords: [{ screen: { x: 50, y: 50 } }] }] }] }
  });

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-production-model-region-handoff.py",
    "--manifest", manifestPath,
    "--geometry", geometryPath,
    "--baseline", baselinePath,
    "--out", outPath,
    "--window-count", "2"
  ], { cwd: path.resolve("."), stdio: "pipe" });

  const artifact = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(artifact.summary.sourceSequenceCount, 2);
  assert.equal(artifact.summary.sequenceCount, 1);
  assert.equal(artifact.summary.excludedSequenceCount, 1);
  assert.deepEqual(artifact.references.map((row) => row.sequenceId), ["Accepted"]);
  assert.equal(artifact.excludedReferences[0].sequenceId, "Invalid");
});
