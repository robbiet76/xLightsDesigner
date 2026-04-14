import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

test("build-unified-training-set aggregates harvested outcome records", () => {
  const root = mkdtempSync(join(tmpdir(), "unified-training-"));
  const recordsDir = join(root, "records");
  const screeningDir = join(root, "screening");
  const outFile = join(root, "training-set.json");
  mkdirSync(recordsDir, { recursive: true });
  mkdirSync(screeningDir, { recursive: true });
  writeFileSync(join(recordsDir, "bars-outcome.json"), JSON.stringify({
    artifactType: "effect_family_outcome_record_v1",
    storageClass: "general_training",
    effectName: "Bars",
    requestScope: { mode: "section_target_refinement" },
    revisionRoles: ["strengthen_lead"],
    appliedParameterGuidance: [
      {
        parameterName: "speed",
        appliedValue: 7,
        paletteMode: "mono_white",
        geometryProfile: "arch_grouped",
        modelType: "arch",
        confidence: "medium",
        recommendationMode: "exact_geometry",
        behaviorHints: ["forward_motion"],
        temporalSignatureHints: ["moderate_motion"]
      }
    ],
    appliedSharedSettingGuidance: [
      { settingName: "layerMethod", appliedValue: "Additive" },
      { settingName: "effectLayerMix", appliedValue: 60 },
      { settingName: "bufferStyle", appliedValue: "Overlay - Scaled" },
      { settingName: "inTransitionType", appliedValue: "Fade" },
      { settingName: "outTransitionType", appliedValue: "Slide Bars" },
      { settingName: "layerMorph", appliedValue: true }
    ],
    resolvedSignals: ["lead_mismatch"],
    persistedSignals: [],
    newSignals: [],
    outcome: { status: "improved", improved: true }
  }, null, 2));

  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-unified-training-set.mjs"),
    outFile,
    recordsDir,
    screeningDir
  ], {
    cwd: resolve("."),
    stdio: "pipe"
  });

  const artifact = JSON.parse(readFileSync(outFile, "utf8"));
  const bars = artifact.effects.find((row) => row.effectName === "Bars");
  assert.equal(artifact.sources.liveLearning.status, "framework_with_outcome_records");
  assert.equal(bars.liveOutcomeLearning.status, "populated");
  assert.equal(bars.liveOutcomeLearning.outcomeRecordCount, 1);
  assert.ok(Array.isArray(bars.liveOutcomeLearning.seedRolePriors));
  assert.equal(bars.liveOutcomeLearning.seedRolePriors.some((row) => row.role === "strengthen_lead"), true);
  assert.equal(bars.liveOutcomeLearning.roleOutcomeMemory.strengthen_lead.sampleCount, 1);
  assert.equal(bars.liveOutcomeLearning.roleOutcomeMemory.strengthen_lead.successfulUses, 1);
  assert.deepEqual(bars.liveOutcomeLearning.roleOutcomeMemory.strengthen_lead.favoredScopes, ["section_target_refinement"]);
  assert.deepEqual(bars.liveOutcomeLearning.roleOutcomeMemory.strengthen_lead.favoredSignals, ["lead_mismatch"]);
  assert.equal(Array.isArray(bars.liveOutcomeLearning.parameterOutcomeMemory.speed), true);
  assert.equal(bars.liveOutcomeLearning.parameterOutcomeMemory.speed[0].parameterValue, 7);
  assert.equal(bars.liveOutcomeLearning.parameterOutcomeMemory.speed[0].successfulUses, 1);
  assert.deepEqual(bars.liveOutcomeLearning.parameterOutcomeMemory.speed[0].behaviorHints, ["forward_motion"]);
  assert.equal(Array.isArray(bars.liveOutcomeLearning.sharedSettingOutcomeMemory.layerMethod), true);
  assert.equal(bars.liveOutcomeLearning.sharedSettingOutcomeMemory.layerMethod[0].appliedValue, "Additive");
  assert.equal(bars.liveOutcomeLearning.sharedSettingOutcomeMemory.effectLayerMix[0].appliedValue, 60);
  assert.equal(bars.liveOutcomeLearning.sharedSettingOutcomeMemory.inTransitionType[0].appliedValue, "Fade");
  assert.equal(bars.liveOutcomeLearning.sharedSettingOutcomeMemory.layerMorph[0].appliedValue, true);
  assert.equal(Array.isArray(artifact.crossEffectSharedSettingLearning.sharedSettingOutcomeMemory.layerMethod), true);
  assert.equal(artifact.crossEffectSharedSettingLearning.sharedSettingOutcomeMemory.layerMethod[0].appliedValue, "Additive");
  assert.deepEqual(artifact.crossEffectSharedSettingLearning.sharedSettingOutcomeMemory.layerMethod[0].effectNames, ["Bars"]);
  assert.equal(artifact.crossEffectSharedSettingLearning.sharedSettingOutcomeMemory.bufferStyle[0].successfulUses, 1);
  assert.ok(["none", "single_reference_per_geometry", "multi_configuration_sampled"].includes(
    bars.screeningLearning.configurationRepresentativeness.coverageStatus
  ));
  assert.equal(Array.isArray(bars.screeningLearning.configurationRepresentativeness.profiles), true);
  assert.equal(bars.parameterLearning.derivedPriors.status, "empty");
});

test("build-unified-training-set derives bounded parameter priors from screening records", () => {
  const root = mkdtempSync(join(tmpdir(), "unified-training-screening-"));
  const outcomeDir = join(root, "outcomes");
  const screeningDir = join(root, "screening");
  const outFile = join(root, "training-set.json");
  mkdirSync(outcomeDir, { recursive: true });
  mkdirSync(screeningDir, { recursive: true });

  const makeRecord = ({ sampleId, speed, paletteMode, motion, colorDelta, signature, labels }) => ({
    recordVersion: "1.0",
    sampleId,
    effectName: "Marquee",
    fixture: {
      modelType: "arch",
      geometryProfile: "arch_grouped"
    },
    trainingContext: {
      screenedParameterName: "speed",
      screeningPaletteMode: paletteMode
    },
    effectSettings: {
      speed
    },
    observations: {
      labels
    },
    features: {
      temporalSignature: signature,
      temporalMotionMean: motion,
      temporalColorDeltaMean: colorDelta,
      temporalBrightnessDeltaMean: motion / 2,
      nonBlankSampledFrameRatio: 1
    },
    modelMetadata: {
      resolvedModelType: "arch",
      resolvedGeometryProfile: "arch_grouped",
      analyzerFamily: "linear",
      displayAsNormalized: "arches",
      stringType: "RGB Nodes",
      nodeCount: 50,
      channelsPerNode: 3,
      geometryTraits: ["grouped", "type:arch"],
      structuralSettings: {
        DisplayAs: "Arches",
        parm1: "3",
        parm2: "50",
        parm3: "1",
        StringType: "RGB Nodes"
      }
    }
  });

  writeFileSync(join(screeningDir, "marquee-speed-1.record.json"), JSON.stringify(makeRecord({
    sampleId: "marquee-speed-1-rgb_primary-generated-v1",
    speed: 1,
    paletteMode: "rgb_primary",
    motion: 0.02,
    colorDelta: 0.03,
    signature: "subtle_motion",
    labels: ["effect:marquee", "forward_motion", "speed", "speed_1", "palette_rgb_primary"]
  }), null, 2));
  writeFileSync(join(screeningDir, "marquee-speed-5.record.json"), JSON.stringify(makeRecord({
    sampleId: "marquee-speed-5-rgb_primary-generated-v1",
    speed: 5,
    paletteMode: "rgb_primary",
    motion: 0.08,
    colorDelta: 0.06,
    signature: "strong_motion",
    labels: ["effect:marquee", "forward_motion", "speed", "speed_5", "palette_rgb_primary"]
  }), null, 2));

  execFileSync("node", [
    resolve("scripts/sequencer-render-training/tooling/build-unified-training-set.mjs"),
    outFile,
    outcomeDir,
    screeningDir
  ], {
    cwd: resolve("."),
    stdio: "pipe"
  });

  const artifact = JSON.parse(readFileSync(outFile, "utf8"));
  const marquee = artifact.effects.find((row) => row.effectName === "Marquee");
  assert.equal(marquee.parameterLearning.derivedPriors.status, "populated");
  assert.equal(marquee.parameterLearning.derivedPriors.priorCount, 1);
  const prior = marquee.parameterLearning.derivedPriors.priors[0];
  assert.equal(prior.parameterName, "speed");
  assert.equal(prior.geometryProfile, "arch_grouped");
  assert.equal(prior.paletteMode, "rgb_primary");
  assert.equal(prior.distinctAnchorCount, 2);
  assert.equal(prior.configurationCoverageStatus, "single_reference_per_geometry");
  assert.equal(prior.anchorProfiles.length, 2);
  assert.equal(prior.anchorProfiles[0].parameterValue, 5);
  assert.equal(prior.anchorProfiles[0].behaviorHints.includes("forward_motion"), true);
});
