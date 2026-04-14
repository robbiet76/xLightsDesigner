import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildBundle } from "./export-derived-parameter-priors-bundle.mjs";

const trainingSet = JSON.parse(
  fs.readFileSync(
    new URL("../catalog/sequencer-unified-training-set-v1.json", import.meta.url),
    "utf8"
  )
);

test("derived parameter prior bundle includes model-type aware priors", () => {
  const bundle = buildBundle(trainingSet);
  assert.equal(bundle.artifactType, "sequencer_derived_parameter_priors_bundle");
  assert.ok(bundle.effectCount > 0);
  const marquee = bundle.effectsByName.Marquee;
  assert.ok(marquee);
  assert.ok(marquee.priors.length > 0);
  assert.ok(marquee.priors.some((row) => row.modelType === "arch"));
  assert.ok(marquee.priors.some((row) => row.anchorProfiles.length > 0));
});

test("derived parameter prior bundle stays generic and excludes runtime-specific identifiers", () => {
  const bundle = buildBundle(trainingSet);
  const text = JSON.stringify(bundle);
  for (const forbidden of [
    "modelName",
    "sequencePath",
    "workingSequencePath",
    "Chorus 1",
    "Verse 1",
    "MegaTree",
    "Roofline",
    "SpinnerHero"
  ]) {
    assert.equal(text.includes(forbidden), false, `unexpected token in shared prior bundle: ${forbidden}`);
  }
});
