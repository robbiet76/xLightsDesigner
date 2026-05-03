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
  assert.equal(bundle.provenance.generatedBy, "scripts/sequencer-render-training/tooling/export-derived-parameter-priors-bundle.mjs");
  assert.equal(bundle.provenance.compactionPolicy, "runtime_bundle_omits_raw_render_frames_and_project_specific_identifiers");
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

test("derived parameter prior bundle preserves runtime behavior rules without source-only dimensions", () => {
  const bundle = buildBundle({
    artifactType: "sequencer_unified_training_set_v1",
    artifactVersion: "1.0",
    effects: [
      {
        effectName: "Marquee",
        screeningLearning: {
          configurationRepresentativeness: {
            profiles: [
              { geometryProfile: "arch_grouped", modelType: "arch", analyzerFamily: "linear", structuralSignature: "abc123" }
            ]
          }
        },
        parameterLearning: {
          derivedPriors: {
            priors: [
              {
                parameterName: "speed",
                geometryProfile: "arch_grouped",
                paletteMode: "rgb_primary",
                confidence: "low",
                configurationCoverageStatus: "single_reference_per_geometry",
                configurationProfileCount: 1,
                distinctAnchorCount: 2,
                sampleCount: 2,
                structuralSignatures: ["abc123"],
                behaviorDimensions: {
                  schemaVersion: "1.0",
                  abstraction: "sparse_anchor_trend",
                  behaviorRules: [
                    { dimension: "motion", direction: "increases", magnitude: 0.06, summary: "speed increases motion" }
                  ],
                  generalization: {
                    interpolationPolicy: "interpolate_between_observed_anchors",
                    exactCombinationRequired: false
                  }
                },
                anchorProfiles: [
                  { parameterValue: 1, sampleCount: 1, meanTemporalMotion: 0.02, meanRenderedColorDiversity: 0.125 },
                  { parameterValue: 5, sampleCount: 1, meanTemporalMotion: 0.08, meanRenderedColorDiversity: 0.375 }
                ]
              }
            ]
          }
        }
      }
    ]
  });
  const prior = bundle.effectsByName.Marquee.priors[0];
  assert.deepEqual(Object.keys(prior.behaviorDimensions), ["behaviorRules"]);
  assert.equal(prior.behaviorDimensions.behaviorRules[0].summary, "speed increases motion");
  assert.equal(prior.behaviorDimensions.behaviorRules[0].magnitude, 0.06);
  assert.equal(prior.structuralSignatures, undefined);
  assert.equal(prior.anchorProfiles[1].meanRenderedColorDiversity, 0.375);
});
