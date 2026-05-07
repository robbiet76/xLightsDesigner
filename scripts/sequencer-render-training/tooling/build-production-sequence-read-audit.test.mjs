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

test("production sequence read audit summarizes existing xsq structure without mutation", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-production-read-audit-"));
  const sequenceDir = path.join(root, "Song");
  const xsqPath = path.join(sequenceDir, "Song.xsq");
  const manifestPath = path.join(root, "manifest.json");
  const outPath = path.join(root, "audit.json");
  writeFile(xsqPath, `<?xml version="1.0" encoding="UTF-8"?>
<xsequence>
  <head>
    <sequenceTiming>50 ms</sequenceTiming>
    <sequenceType>Media</sequenceType>
    <mediaFile>/tmp/song.mp3</mediaFile>
    <sequenceDuration>10.0</sequenceDuration>
  </head>
  <DisplayElements>
    <Element type="timing" name="Timing" visible="1"/>
    <Element type="model" name="Arch" visible="1"/>
    <Element type="model" name="Star" visible="1"/>
  </DisplayElements>
  <ElementEffects>
    <Element type="timing" name="Timing">
      <EffectLayer>
        <Effect label="intro" startTime="0" endTime="3000"/>
        <Effect label="chorus" startTime="3000" endTime="10000"/>
      </EffectLayer>
    </Element>
    <Element type="model" name="Arch">
      <EffectLayer>
        <Effect ref="0" name="Bars" startTime="0" endTime="5000" palette="0"/>
      </EffectLayer>
    </Element>
    <Element type="model" name="Star">
      <EffectLayer>
        <Effect ref="1" name="Pinwheel" startTime="3000" endTime="10000" palette="1"/>
      </EffectLayer>
    </Element>
  </ElementEffects>
</xsequence>
`);
  writeJson(manifestPath, {
    artifactType: "production_sequence_read_benchmark_manifest_v1",
    artifactVersion: 1,
    readOnly: true,
    policy: { purpose: "production_sequence_read_calibration_only", mutateSourceSequences: false },
    sequences: [{
      sequenceId: "Song",
      folderName: "Song",
      folderPath: sequenceDir,
      readOnly: true,
      benchmarkUse: "production_sequence_read_calibration",
      expectedEvidenceScope: "full_sequence_render",
      xsq: { path: xsqPath, name: "Song.xsq" },
      fseq: { present: false, path: "", count: 0 },
      requiresRender: true,
      styleTags: ["high_energy"],
      initialAuditSubset: true,
      readGoals: ["whole_display_energy_arc", "section_contrast"],
      humanReview: { status: "pending" }
    }]
  });

  execFileSync("python3", [
    "scripts/sequencer-render-training/tooling/build-production-sequence-read-audit.py",
    "--manifest",
    manifestPath,
    "--out",
    outPath
  ], { cwd: path.resolve("."), stdio: "pipe" });

  const artifact = JSON.parse(fs.readFileSync(outPath, "utf8"));
  assert.equal(artifact.artifactType, "production_sequence_read_audit_v1");
  assert.equal(artifact.readOnly, true);
  assert.equal(artifact.metricScope, "full_sequence_render");
  assert.equal(artifact.promotionUse, "calibration_reference_only");
  assert.equal(artifact.summary.sequenceCount, 1);
  assert.equal(artifact.summary.totalEffectCount, 2);
  assert.equal(artifact.sequences[0].structure.modelElementCount, 2);
  assert.equal(artifact.sequences[0].structure.timingMarkCount, 2);
  assert.deepEqual(artifact.sequences[0].structure.topEffects.map((row) => row.name), ["Bars", "Pinwheel"]);
  assert.equal(artifact.sequences[0].timeline.effectTimelineCoverageRatio, 1);
});
