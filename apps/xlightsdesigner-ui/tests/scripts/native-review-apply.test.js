import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildNativeApplyVerification,
  buildReviewIntentHandoff,
  createSequenceBackup,
  hydrateAnalysisSectionsFromSelectedTimingTrack,
  hydrateNativeApplyTimingContext,
  renderCurrentSummary,
  summarizePracticalValidation
} from "../../../../scripts/sequencing/native/apply-native-review.mjs";
import { buildSequenceAgentPlan } from "../../agent/sequence-agent/sequence-agent.js";
import { buildEffectDefinitionCatalog } from "../../agent/sequence-agent/effect-definition-catalog.js";

test("createSequenceBackup copies xsq into project artifact backups", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-native-review-"));
  const projectDir = path.join(root, "Project");
  const showDir = path.join(root, "Show");
  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(showDir, { recursive: true });
  const projectFile = path.join(projectDir, "Project.xdproj");
  const sequencePath = path.join(showDir, "HolidayRoad.xsq");
  fs.writeFileSync(projectFile, JSON.stringify({ projectName: "Project" }), "utf8");
  fs.writeFileSync(sequencePath, "<xsequence>before</xsequence>", "utf8");

  const backupPath = createSequenceBackup({
    projectFile,
    sequencePath,
    revision: "rev:1/unsafe"
  });

  assert.equal(path.dirname(backupPath), path.join(projectDir, "artifacts", "backups"));
  assert.match(path.basename(backupPath), /^HolidayRoad-preapply-/);
  assert.match(path.basename(backupPath), /rev-1-unsafe\.xsq$/);
  assert.equal(fs.readFileSync(backupPath, "utf8"), "<xsequence>before</xsequence>");
});

test("renderCurrentSummary prefers rendered sequence path", () => {
  assert.equal(
    renderCurrentSummary({
      data: {
        rendered: true,
        sequence: {
          path: "/show/HolidayRoad.xsq"
        }
      }
    }),
    "Rendered xLights sequence: /show/HolidayRoad.xsq"
  );
  assert.equal(renderCurrentSummary({ data: { rendered: true } }), "Rendered current xLights sequence.");
});

test("buildNativeApplyVerification attaches practical validation from readback", async () => {
  const commands = [
    {
      cmd: "effects.create",
      params: {
        modelName: "MegaTree",
        layerIndex: 0,
        effectName: "On",
        startMs: 0,
        endMs: 1000
      }
    }
  ];
  const planHandoff = {
    artifactId: "plan-1",
    commands,
    metadata: {
      executionStrategy: { passScope: "single_section" },
      sectionPlans: [{ section: "Chorus 1" }],
      effectPlacements: [{ sourceSectionLabel: "Chorus 1" }],
      sequenceSettings: { durationMs: 1000 },
      sequencingDesignHandoffSummary: "MegaTree chorus"
    }
  };

  const result = await buildNativeApplyVerification({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    commands,
    planHandoff,
    applyResult: {
      currentRevision: "rev-1",
      nextRevision: "rev-2"
    },
    verifyReadback: async () => ({
      expectedMutationsPresent: true,
      lockedTracksUnchanged: true,
      checks: [{ kind: "effect", target: "MegaTree@0", ok: true, detail: "On present" }],
      designChecks: [],
      designContext: { designSummary: "MegaTree chorus" },
      designAlignment: { observedTargets: ["MegaTree"], observedEffectNames: ["On"] }
    })
  });

  assert.equal(result.verification.revisionAdvanced, true);
  assert.equal(result.practicalValidation.artifactType, "practical_sequence_validation_v1");
  assert.equal(result.practicalValidation.summary.readbackChecks.passed, 1);
  assert.equal(result.practicalValidation.designSummary, "MegaTree chorus");
  assert.deepEqual(summarizePracticalValidation(result.practicalValidation), {
    artifactType: "practical_sequence_validation_v1",
    overallOk: true,
    designSummary: "MegaTree chorus",
    readbackPassed: 1,
    readbackFailed: 0,
    designPassed: 0,
    designFailed: 0
  });
});

test("hydrateNativeApplyTimingContext expands scoped timing mark to full live track context", async () => {
  const commands = [
    {
      id: "timing.marks.insert",
      cmd: "timing.insertMarks",
      params: {
        trackName: "User Timing",
        marks: [{ startMs: 2000, endMs: 3000, label: "Chorus 1" }]
      }
    },
    {
      id: "effect.1",
      cmd: "effects.create",
      params: { modelName: "MegaTree", layerIndex: 0, effectName: "On", startMs: 2000, endMs: 3000 }
    }
  ];

  const hydrated = await hydrateNativeApplyTimingContext({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    commands,
    readTimingMarks: async (_endpoint, trackName) => {
      assert.equal(trackName, "User Timing");
      return {
        data: {
          marks: [
            { startMs: 0, endMs: 1000, label: "Intro" },
            { startMs: 2000, endMs: 3000, label: "Chorus 1" }
          ]
        }
      };
    }
  });

  assert.equal(hydrated[0].cmd, "timing.replaceMarks");
  assert.deepEqual(hydrated[0].params.marks, [
    { startMs: 0, endMs: 1000, label: "Intro" },
    { startMs: 2000, endMs: 3000, label: "Chorus 1" }
  ]);
  assert.equal(hydrated[1], commands[1]);
});

test("hydrateNativeApplyTimingContext replaces full created timing tracks instead of appending", async () => {
  const commands = [
    {
      id: "timing.track.create",
      cmd: "timing.createTrack",
      params: { trackName: "User Timing", replaceIfExists: true }
    },
    {
      id: "timing.marks.insert",
      dependsOn: ["timing.track.create"],
      cmd: "timing.insertMarks",
      params: {
        trackName: "User Timing",
        marks: [
          { startMs: 0, endMs: 1000, label: "Intro" },
          { startMs: 1000, endMs: 2500, label: "Chorus 1" }
        ]
      }
    }
  ];

  const hydrated = await hydrateNativeApplyTimingContext({
    commands,
    readTimingMarks: async () => {
      throw new Error("full created timing tracks should not require live mark hydration");
    }
  });

  assert.equal(hydrated[0], commands[0]);
  assert.equal(hydrated[1].cmd, "timing.replaceMarks");
  assert.deepEqual(hydrated[1].params.marks, commands[1].params.marks);
});

test("hydrateAnalysisSectionsFromSelectedTimingTrack uses live marks for explicit section timing", async () => {
  const hydrated = await hydrateAnalysisSectionsFromSelectedTimingTrack({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    analysisHandoff: {
      structure: {
        sections: [{ label: "Analysis Chorus", startMs: 10000, endMs: 20000 }]
      }
    },
    intentHandoff: {
      scope: { sections: ["Chorus 1"] },
      executionStrategy: {
        timingTrackName: "User Timing",
        sectionPlans: [{ section: "Chorus 1", targetIds: ["MegaTree"] }]
      }
    },
    readTimingMarks: async (_endpoint, trackName) => {
      assert.equal(trackName, "User Timing");
      return {
        data: {
          marks: [
            { startMs: 0, endMs: 1000, label: "Intro" },
            { startMs: 1000, endMs: 2500, label: "Chorus 1" }
          ]
        }
      };
    }
  });

  assert.deepEqual(hydrated.structure.sections, [
    { label: "Intro", startMs: 0, endMs: 1000 },
    { label: "Chorus 1", startMs: 1000, endMs: 2500 }
  ]);
});

test("review apply handoff preserves metadata-resolved proposal targets for sequence planning", () => {
  const latestIntent = {
    artifactType: "intent_handoff_v1",
    goal: "Make the chorus read through the lead display element.",
    mode: "revise",
    scope: {
      targetIds: ["MegaTree"],
      tagNames: ["lead"],
      sections: ["Chorus 1"],
      timeRangeMs: null
    },
    constraints: {
      changeTolerance: "moderate",
      preserveTimingTracks: true,
      allowGlobalRewrite: false
    },
    directorPreferences: {
      styleDirection: "",
      energyArc: "hold",
      focusElements: ["MegaTree"],
      colorDirection: ""
    }
  };
  const proposalBundle = {
    bundleType: "proposal_bundle_v1",
    summary: "Make the chorus read through the lead display element.",
    createdAt: "2026-04-24T00:00:00.000Z",
    scope: {
      targetIds: ["MegaTree"],
      tagNames: ["lead"],
      sections: ["Chorus 1"]
    },
    constraints: {
      changeTolerance: "moderate",
      preserveTimingTracks: true,
      preserveDisplayOrder: true,
      allowGlobalRewrite: false
    },
    proposalLines: [
      "Chorus 1 / MegaTree / preserve this tagged focal element as the clearest lead read",
      "Chorus 1 / MegaTree / this target can support these visual treatments when they fit the section intent: centerpiece",
      "Chorus 1 / MegaTree / avoid these effect families or effects here unless explicitly requested: Bars"
    ],
    executionPlan: {
      passScope: "single_section",
      implementationMode: "single_section_pass",
      routePreference: "designer_to_sequence_agent",
      shouldUseFullSongStructureTrack: true,
      sectionCount: 1,
      targetCount: 1,
      primarySections: ["Chorus 1"],
      sectionPlans: [
        {
          designId: "DES-001",
          designRevision: 0,
          designAuthor: "user",
          section: "Chorus 1",
          energy: "",
          density: "",
          intentSummary: "Make the chorus read through the lead display element.",
          targetIds: ["MegaTree"],
          effectHints: []
        }
      ],
      effectPlacements: []
    }
  };
  const metadataAssignments = [
    {
      targetId: "MegaTree",
      tags: ["lead", "centerpiece"],
      semanticHints: ["centerpiece"],
      visualHintDefinitions: [],
      effectAvoidances: ["Bars"],
      rolePreference: "lead",
      source: "xlightsdesigner_project_display_metadata"
    }
  ];

  const reviewIntentHandoff = buildReviewIntentHandoff(latestIntent, proposalBundle);
  const out = buildSequenceAgentPlan({
    analysisHandoff: {
      trackIdentity: { title: "Track A", artist: "Artist A" },
      structure: {
        sections: [
          { label: "Chorus 1", startMs: 0, endMs: 1000, energy: "high", density: "medium" }
        ]
      }
    },
    intentHandoff: reviewIntentHandoff,
    sourceLines: proposalBundle.proposalLines,
    baseRevision: "rev-1",
    effectCatalog: buildEffectDefinitionCatalog([
      { effectName: "Bars", params: [] },
      { effectName: "Color Wash", params: [] },
      { effectName: "Shimmer", params: [] },
      { effectName: "On", params: [] }
    ]),
    metadataAssignments
  });

  assert.deepEqual(reviewIntentHandoff.scope.targetIds, ["MegaTree"]);
  assert.deepEqual(reviewIntentHandoff.scope.tagNames, ["lead"]);
  assert.deepEqual(out.metadata.scope.targetIds, ["MegaTree"]);
  assert.deepEqual(out.metadata.scope.tagNames, ["lead"]);
  assert.deepEqual(out.metadata.executionStrategy.sectionPlans[0].targetIds, ["MegaTree"]);
  assert.deepEqual(out.metadata.metadataAssignments, [
    {
      targetId: "MegaTree",
      tags: ["lead", "centerpiece"],
      semanticHints: ["centerpiece"],
      effectAvoidances: ["Bars"],
      rolePreference: "lead",
      visualHintDefinitions: []
    }
  ]);
  assert.match(out.executionLines.join("\n"), /MegaTree/i);
});
