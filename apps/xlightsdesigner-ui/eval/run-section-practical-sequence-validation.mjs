import fs from "node:fs";
import path from "node:path";

import { buildSequenceAgentPlan } from "../agent/sequence-agent/sequence-agent.js";
import { buildEffectDefinitionCatalog } from "../agent/sequence-agent/effect-definition-catalog.js";
import { verifyAppliedPlanReadback } from "../agent/sequence-agent/apply-readback.js";
import { buildPracticalSequenceValidation } from "../agent/sequence-agent/practical-sequence-validation.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveScenarioId(scenario = {}, fallback = "scenario") {
  return str(scenario?.scenarioId || scenario?.name || fallback);
}

function resolveScenarioLabel(scenario = {}, fallback = "") {
  return str(scenario?.scenarioLabel || scenario?.name || scenario?.scenarioId || fallback);
}

function sampleEffectCatalog() {
  return buildEffectDefinitionCatalog([
    { effectName: "Bars", params: [] },
    { effectName: "Color Wash", params: [] },
    { effectName: "Marquee", params: [] },
    { effectName: "On", params: [] },
    { effectName: "Pinwheel", params: [] },
    { effectName: "Shimmer", params: [] },
    { effectName: "Shockwave", params: [] },
    { effectName: "SingleStrand", params: [] },
    { effectName: "Spirals", params: [] },
    { effectName: "Twinkle", params: [] }
  ], { source: "section-practical-suite" });
}

function sampleDisplayElements() {
  return [
    { id: "TreeRound", name: "TreeRound", type: "Tree" },
    { id: "ArchSingle", name: "ArchSingle", type: "Arch" },
    { id: "SpinnerStandard", name: "SpinnerStandard", type: "Spinner" },
    { id: "StarSingle", name: "StarSingle", type: "Star" }
  ];
}

function sampleAnalysisFromScenario(scenario = {}) {
  const requestedLabel = str(scenario?.sectionName) || "Chorus 1";
  const requestedWindow = scenario?.sectionWindow && typeof scenario.sectionWindow === "object"
    ? scenario.sectionWindow
    : { startMs: 0, endMs: 10000 };
  const sections = [
    { label: "Intro", startMs: 0, endMs: 10000 },
    { label: "Verse 1", startMs: 10000, endMs: 44000 },
    { label: "Chorus 1", startMs: 44000, endMs: 62000 },
    { label: "Bridge", startMs: 90000, endMs: 120000 },
    { label: "Final Chorus", startMs: 120000, endMs: 156000 }
  ];
  const merged = sections.filter((row) => row.label !== requestedLabel);
  merged.push({
    label: requestedLabel,
    startMs: Number(requestedWindow.startMs || 0),
    endMs: Number(requestedWindow.endMs || (Number(requestedWindow.startMs || 0) + 1000))
  });
  merged.sort((a, b) => Number(a.startMs) - Number(b.startMs));
  return {
    trackIdentity: { title: "Section Practical Eval", artist: "xLightsDesigner" },
    structure: { sections: merged }
  };
}

function buildIntentHandoffForScenario(scenario = {}) {
  const sectionName = str(scenario?.sectionName);
  const targetIds = arr(scenario?.targets).map((row) => str(row)).filter(Boolean);
  const preferredVisualFamilies = arr(scenario?.preferredVisualFamilies).map((row) => str(row)).filter(Boolean);
  return {
    goal: str(scenario?.goal),
    mode: "revise",
    scope: {
      targetIds,
      tagNames: [],
      sections: sectionName ? [sectionName] : []
    },
    executionStrategy: {
      passScope: "single_section",
      implementationMode: "structured_brief",
      shouldUseFullSongStructureTrack: true,
      sectionPlans: [
        {
          section: sectionName,
          energy: preferredVisualFamilies.includes("radial_rotation") ? "high" : "medium",
          density: preferredVisualFamilies.includes("soft_texture") ? "restrained" : "balanced",
          intentSummary: str(scenario?.goal),
          targetIds,
          effectHints: []
        }
      ]
    },
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      designSummary: str(scenario?.designSummary),
      goal: str(scenario?.goal),
      scope: {
        targetIds,
        tagNames: [],
        sections: sectionName ? [sectionName] : []
      },
      focusPlan: {
        primaryTargetIds: arr(scenario?.primaryFocusTargetIds).map((row) => str(row)).filter(Boolean)
      },
      propRoleAssignments: [
        {
          role: "lead",
          targetIds
        }
      ],
      sectionDirectives: [
        {
          sectionName,
          sectionPurpose: "section_practical_validation",
          motionTarget: preferredVisualFamilies.includes("spiral_flow") ? "flowing" : "",
          densityTarget: preferredVisualFamilies.includes("soft_texture") ? "restrained" : "balanced",
          transitionIntent: "hold",
          preferredVisualFamilies
        }
      ]
    }
  };
}

function buildReadbackDepsFromPlan(plan = {}) {
  const commands = arr(plan?.commands);
  const timingInsert = commands.find((row) => str(row?.cmd) === "timing.insertMarks");
  const displayOrder = commands.find((row) => str(row?.cmd) === "sequencer.setDisplayElementOrder");
  const effects = commands.filter((row) => str(row?.cmd) === "effects.create");
  return {
    planMetadata: plan?.metadata || {},
    getTimingMarks: async () => ({
      data: {
        marks: arr(timingInsert?.params?.marks)
      }
    }),
    getDisplayElementOrder: async () => ({
      data: {
        elements: arr(displayOrder?.params?.orderedIds).map((id) => ({ id }))
      }
    }),
    listEffects: async (_endpoint, query = {}) => ({
      data: {
        effects: effects
          .filter((row) => {
            const params = row?.params || {};
            if (str(query?.modelName) && str(params.modelName) !== str(query.modelName)) return false;
            if (Number.isFinite(Number(query?.layerIndex)) && Number(params.layerIndex) !== Number(query.layerIndex)) return false;
            if (Number.isFinite(Number(query?.startMs)) && Number(params.startMs) !== Number(query.startMs)) return false;
            if (Number.isFinite(Number(query?.endMs)) && Number(params.endMs) !== Number(query.endMs)) return false;
            return true;
          })
          .map((row) => ({ ...row.params }))
      }
    })
  };
}

async function runScenario(scenario = {}) {
  const plan = buildSequenceAgentPlan({
    analysisHandoff: sampleAnalysisFromScenario(scenario),
    intentHandoff: buildIntentHandoffForScenario(scenario),
    sourceLines: arr(scenario?.sourceLines),
    effectCatalog: sampleEffectCatalog(),
    displayElements: sampleDisplayElements()
  });
  const verification = await verifyAppliedPlanReadback(plan.commands, buildReadbackDepsFromPlan(plan));
  verification.revisionAdvanced = true;
  const practicalValidation = buildPracticalSequenceValidation({
    planHandoff: plan,
    verification
  });
  const observedEffects = Array.from(new Set(
    arr(plan.commands)
      .filter((row) => str(row?.cmd) === "effects.create")
      .map((row) => str(row?.params?.effectName))
      .filter(Boolean)
  ));
  const expectedEffects = arr(scenario?.expectedEffects).map((row) => str(row)).filter(Boolean);
  const matchedExpectedEffects = expectedEffects.filter((row) => observedEffects.includes(row));
  return {
    scenarioId: resolveScenarioId(scenario),
    scenarioLabel: resolveScenarioLabel(scenario),
    ok: practicalValidation.overallOk === true && matchedExpectedEffects.length > 0,
    expectedEffects,
    observedEffects,
    matchedExpectedEffects,
    planSummary: str(plan?.summary),
    practicalValidation
  };
}

async function main() {
  const cwd = process.cwd();
  const suitePath = process.argv[2]
    ? path.resolve(cwd, process.argv[2])
    : path.join(cwd, "apps/xlightsdesigner-ui/eval/section-practical-sequence-validation-suite-v1.json");
  const suite = readJson(suitePath);
  const scenarios = arr(suite?.scenarios);
  if (!scenarios.length) {
    throw new Error("Section practical sequence validation suite requires at least one scenario.");
  }
  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }
  const failed = results.filter((row) => row.ok !== true);
  const summary = {
    contract: "section_practical_sequence_validation_run_v1",
    version: "1.0",
    suitePath,
    scenarioCount: results.length,
    passedScenarioCount: results.length - failed.length,
    failedScenarioCount: failed.length,
    failedScenarioIds: failed.map((row) => row.scenarioId),
    failedScenarioLabels: failed.map((row) => row.scenarioLabel),
    ok: failed.length === 0,
    results
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed.length) process.exitCode = 1;
}

await main();
