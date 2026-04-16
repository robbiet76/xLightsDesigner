import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("import-upstream-effect-metadata emits normalized bundle, fingerprint, and diff", () => {
  const root = mkdtempSync(join(tmpdir(), "xlights-effectmetadata-"));
  execFileSync(
    "node",
    [
      resolve("scripts/sequencer-render-training/tooling/import-upstream-effect-metadata.mjs"),
      root,
      "/Users/robterry/xLights-2026.06/resources/effectmetadata",
      resolve("scripts/sequencer-render-training/catalog/effect-parameter-registry.json"),
      "2026.06"
    ],
    {
      cwd: resolve("."),
      stdio: "pipe"
    }
  );

  const bundlePath = join(root, "xlights-effectmetadata-bundle-2026.06.json");
  const fingerprintPath = join(root, "xlights-effectmetadata-fingerprint-2026.06.json");
  const diffPath = join(root, "xlights-effectmetadata-diff-2026.06.json");
  const effectiveRegistryPath = join(root, "effective-effect-parameter-registry-2026.06.json");

  assert.equal(existsSync(bundlePath), true);
  assert.equal(existsSync(fingerprintPath), true);
  assert.equal(existsSync(diffPath), true);
  assert.equal(existsSync(effectiveRegistryPath), true);

  const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  const fingerprint = JSON.parse(readFileSync(fingerprintPath, "utf8"));
  const diff = JSON.parse(readFileSync(diffPath, "utf8"));
  const effectiveRegistry = JSON.parse(readFileSync(effectiveRegistryPath, "utf8"));

  assert.equal(bundle.artifactType, "xlights_effect_metadata_bundle_v1");
  assert.equal(bundle.source.xlightsVersion, "2026.06");
  assert.ok(bundle.effectCount >= 50);
  assert.ok(bundle.sharedCount >= 3);

  assert.equal(fingerprint.artifactType, "xlights_effect_metadata_fingerprint_v1");
  assert.equal(typeof fingerprint.bundleSha256, "string");
  assert.equal(fingerprint.bundleSha256.length, 64);

  assert.equal(diff.artifactType, "xlights_effect_metadata_diff_v1");
  assert.ok(diff.overlapEffects.some((row) => row.effectName === "Shockwave"));
  assert.equal(effectiveRegistry.metadataSource.xlightsVersion, "2026.06");
  assert.equal(effectiveRegistry.effects.Shockwave.parameters.centerX.upstream.id, "Shockwave_CenterX");

  const shockwave = diff.overlapEffects.find((row) => row.effectName === "Shockwave");
  assert.ok(shockwave);
  assert.equal(shockwave.missingParameterCount, 0);
  assert.ok(shockwave.parameterMappings.some((row) => row.localParameter === "centerX" && row.upstreamId === "Shockwave_CenterX"));
});
