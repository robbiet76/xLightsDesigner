import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { packEffectScreeningRecords } from "./pack-effect-screening-records.mjs";
import { loadScreeningRecordCatalog } from "./screening-record-catalog.mjs";

function screeningRecord({ paletteMode }) {
  return {
    recordVersion: "1.0",
    sampleId: "same-sample-id",
    effectName: "Bars",
    effectSettings: { cycles: 3 },
    sharedSettings: { paletteProfile: paletteMode },
    trainingContext: { screeningPaletteMode: paletteMode },
    observations: { labels: ["decoded_fseq"] },
    fixture: { geometryProfile: "arch-grouped" },
    features: {
      temporalMotionMean: 0.1,
      analysis: { qualitySignals: { nonBlank: true } },
      frames: [
        { nodeRgb: [[255, 0, 0], [0, 255, 0], [0, 0, 255]] },
        { nodeRgb: [[255, 255, 255], [0, 0, 0], [255, 255, 255]] }
      ]
    }
  };
}

test("pack-effect-screening-records compacts loose records into readable per-effect packs", () => {
  const root = mkdtempSync(join(tmpdir(), "effect-screening-packs-"));
  const source = join(root, "source");
  const outDir = join(root, "packs");
  mkdirSync(source, { recursive: true });

  writeFileSync(join(source, "bars-mono.record.json"), `${JSON.stringify(screeningRecord({ paletteMode: "mono_white" }), null, 2)}\n`, "utf8");
  writeFileSync(join(source, "bars-rgb.record.json"), `${JSON.stringify(screeningRecord({ paletteMode: "rgb_primary" }), null, 2)}\n`, "utf8");

  const index = packEffectScreeningRecords({ source, outDir });
  assert.equal(index.recordCount, 2);
  assert.equal(index.packCount, 1);
  assert.equal(index.packs[0].fileName, "bars.records.jsonl");

  const packLines = readFileSync(join(outDir, "bars.records.jsonl"), "utf8").trim().split("\n");
  assert.equal(packLines.length, 2);

  const records = loadScreeningRecordCatalog(outDir);
  assert.equal(records.length, 2);
  assert.deepEqual(records.map((record) => record.trainingContext.screeningPaletteMode).sort(), ["mono_white", "rgb_primary"]);
  assert.equal(records.every((record) => record.features.frames === undefined), true);
  assert.equal(records.every((record) => Number.isFinite(record.features.renderedColorDiversity)), true);
});
