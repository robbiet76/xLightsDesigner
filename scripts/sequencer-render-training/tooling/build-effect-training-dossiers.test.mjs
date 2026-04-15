import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("build-effect-training-dossiers emits one dossier per effect with current evidence surfaces", () => {
  const root = mkdtempSync(join(tmpdir(), "effect-dossiers-"));
  execFileSync("node", [resolve("scripts/sequencer-render-training/tooling/build-effect-training-dossiers.mjs"), root], {
    cwd: resolve("."),
    stdio: "pipe"
  });

  const index = JSON.parse(readFileSync(join(root, "index.json"), "utf8"));
  assert.equal(index.artifactType, "effect_training_dossier_index_v1");
  assert.ok(index.effectCount >= 10);

  const shockwavePath = join(root, "shockwave.json");
  assert.equal(existsSync(shockwavePath), true);
  const shockwave = JSON.parse(readFileSync(shockwavePath, "utf8"));
  assert.equal(shockwave.artifactType, "effect_training_dossier_v1");
  assert.equal(shockwave.effectName, "Shockwave");
  assert.ok(Array.isArray(shockwave.currentCoverage.registryParameterNames));
  assert.ok(Array.isArray(shockwave.interactionCoverage.interactionManifestNames));
  assert.ok(Array.isArray(shockwave.evidenceIndex.screeningRecordPaths));
});
