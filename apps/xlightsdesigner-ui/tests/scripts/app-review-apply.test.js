import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildAppApplyVerification,
  buildAppRenderEvidenceTargetIds,
  buildReviewIntentHandoff,
  createSequenceBackup,
  hydrateAnalysisSectionsFromSelectedTimingTrack,
  hydrateAppApplyTimingContext,
  normalizeCommandsForAppApply,
  persistAppTargetBehaviorLearning,
  renderCurrentSummary,
  summarizePracticalValidation
} from "../../../../scripts/sequencing/app/apply-app-review.mjs";
import { buildSubmodelsByIdFromModelIndexTargetRecords } from "../../runtime/model-index-scene-graph-runtime.js";
import { buildSequenceAgentPlan } from "../../agent/sequence-agent/sequence-agent.js";
import { buildEffectDefinitionCatalog } from "../../agent/sequence-agent/effect-definition-catalog.js";

test("buildSubmodelsByIdFromModelIndexTargetRecords preserves persisted submodel identity", () => {
  const submodelsById = buildSubmodelsByIdFromModelIndexTargetRecords([
    {
      targetId: "CustomFace/@Mouth",
      targetKind: "submodel",
      identity: {
        displayName: "CustomFace / @Mouth",
        canonicalType: "submodel",
        fingerprint: "tmf1:mouth001",
        fingerprintVersion: "target-metadata-fingerprint-v1",
        parentId: "CustomFace",
        parentName: "CustomFace"
      },
      structure: {
        nodeCount: 12,
        submodelMetadata: {
          name: "@Mouth",
          parentId: "CustomFace",
          type: "ranges",
          siblingCount: 4,
          siblingIds: ["CustomFace/@Eye"],
          nodeCoverage: { nodeCount: 12, parentNodeCount: 200, ratio: 0.06 },
          structureHints: ["feature_mouth"]
        }
      }
    }
  ]);

  assert.equal(submodelsById["CustomFace/@Mouth"].parentId, "CustomFace");
  assert.equal(submodelsById["CustomFace/@Mouth"].nodeCoverage.nodeCount, 12);
  assert.deepEqual(submodelsById["CustomFace/@Mouth"].structureHints, ["feature_mouth"]);
  assert.equal(submodelsById["CustomFace/@Mouth"].identity.fingerprint, "tmf1:mouth001");
});

test("buildAppRenderEvidenceTargetIds includes applied effect command targets", () => {
  const out = buildAppRenderEvidenceTargetIds({
    selectedTargetIds: ["AllModels"],
    commands: [
      { cmd: "effects.create", params: { modelName: "CustomFace/@Mouth", effectName: "On" } },
      { cmd: "timing.insertMarks", params: { trackName: "XD: Song Structure" } },
      { cmd: "effects.update", params: { targetId: "CustomFace/@Eye", effectName: "Bars" } }
    ]
  });

  assert.deepEqual(out, ["AllModels", "CustomFace/@Mouth", "CustomFace/@Eye"]);
});

test("createSequenceBackup copies xsq into project artifact backups", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-app-review-"));
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

test("normalizeCommandsForAppApply preserves display-order and layer edit commands", () => {
  const commands = [
    { id: "timing.1", cmd: "timing.createTrack", params: { trackName: "XD: Beats" } },
    {
      id: "display.order.1",
      dependsOn: ["timing.1"],
      cmd: "sequencer.setDisplayElementOrder",
      params: { orderedIds: ["Lyrics", "AllModels", "MegaTree"] }
    },
    {
      id: "layer.reorder.1",
      dependsOn: ["display.order.1"],
      cmd: "effects.reorderLayer",
      params: { modelName: "MegaTree", fromLayerIndex: 1, toLayerIndex: 0 }
    }
  ];

  const out = normalizeCommandsForAppApply(commands);

  assert.deepEqual(out.map((row) => row.cmd), [
    "timing.createTrack",
    "sequencer.setDisplayElementOrder",
    "effects.reorderLayer"
  ]);
  assert.deepEqual(out[1].dependsOn, ["timing.1"]);
  assert.deepEqual(out[2].dependsOn, ["display.order.1"]);
});

test("normalizeCommandsForAppApply collapses exact duplicate write commands and rewires dependencies", () => {
  const commands = [
    {
      id: "effect.1",
      cmd: "effects.create",
      params: {
        modelName: "MegaTree",
        layerIndex: 0,
        effectName: "On",
        startMs: 0,
        endMs: 1000,
        settings: {},
        palette: {}
      }
    },
    {
      id: "effect.2",
      cmd: "effects.create",
      params: {
        modelName: "MegaTree",
        layerIndex: 0,
        effectName: "On",
        startMs: 0,
        endMs: 1000,
        settings: {},
        palette: {}
      }
    },
    {
      id: "align.1",
      dependsOn: ["effect.2"],
      cmd: "effects.alignToTiming",
      params: {
        modelName: "MegaTree",
        layerIndex: 0,
        startMs: 0,
        endMs: 1000,
        timingTrackName: "XD: Song Structure",
        mode: "nearest"
      }
    }
  ];

  const out = normalizeCommandsForAppApply(commands);

  assert.equal(out.length, 2);
  assert.deepEqual(out.map((row) => row.id), ["effect.1", "align.1"]);
  assert.deepEqual(out[1].dependsOn, ["effect.1"]);
});

test("buildAppApplyVerification attaches practical validation from readback", async () => {
  const commands = [
    {
      cmd: "timing.insertMarks",
      params: {
        trackName: "XD: Song Structure",
        marks: [{ startMs: 0, endMs: 1000, label: "Chorus 1" }]
      }
    },
    {
      cmd: "effects.create",
      anchor: {
        kind: "timing_track",
        trackName: "XD: Song Structure",
        markLabel: "Chorus 1",
        startMs: 0,
        endMs: 1000,
        boundarySide: "start"
      },
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

  const result = await buildAppApplyVerification({
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

test("buildAppApplyVerification wires display-order readback dependency", async () => {
  const result = await buildAppApplyVerification({
    endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
    commands: [
      {
        cmd: "sequencer.setDisplayElementOrder",
        params: { orderedIds: ["Lyrics", "AllModels", "MegaTree"] }
      }
    ],
    planHandoff: { metadata: {} },
    applyResult: { currentRevision: "rev-1", nextRevision: "rev-2" },
    submodelsById: {
      "CustomFace/@Mouth": { id: "CustomFace/@Mouth", parentId: "CustomFace" }
    },
    readDisplayElementOrder: async () => ({
      data: {
        elements: ["Lyrics", "AllModels", "MegaTree"]
      }
    }),
    verifyReadback: async (_commands, deps) => {
      assert.equal(typeof deps.getDisplayElementOrder, "function");
      assert.equal(deps.submodelsById["CustomFace/@Mouth"].parentId, "CustomFace");
      const order = await deps.getDisplayElementOrder(deps.endpoint);
      assert.deepEqual(order.data.elements, ["Lyrics", "AllModels", "MegaTree"]);
      return {
        expectedMutationsPresent: true,
        lockedTracksUnchanged: true,
        checks: [{ kind: "display-order", target: "master-view", ok: true, detail: "display element order matched" }],
        designChecks: [],
        designContext: {},
        designAlignment: {}
      };
    }
  });

  assert.equal(result.verification.revisionAdvanced, true);
  assert.equal(result.verification.expectedMutationsPresent, true);
  assert.equal(result.verification.checks[0].kind, "display-order");
});

test("hydrateAppApplyTimingContext expands scoped timing mark to full live track context", async () => {
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

  const hydrated = await hydrateAppApplyTimingContext({
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

test("hydrateAppApplyTimingContext replaces full created timing tracks instead of appending", async () => {
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

  const hydrated = await hydrateAppApplyTimingContext({
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
    },
    sequencingDesignHandoff: {
      artifactType: "sequencing_design_handoff_v2",
      artifactId: "sequencing_design_handoff_v2-test",
      designSummary: "Designer says MegaTree should carry the chorus lead.",
      scope: {
        targetIds: ["MegaTree"],
        tagNames: ["lead"],
        sections: ["Chorus 1"]
      }
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
  assert.equal(reviewIntentHandoff.sequencingDesignHandoff.artifactId, "sequencing_design_handoff_v2-test");
  assert.equal(out.metadata.sequencingDesignHandoffSummary, "Designer says MegaTree should carry the chorus lead.");
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

test("persistAppTargetBehaviorLearning writes project target behavior for custom submodel apply", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-target-behavior-"));
  const projectDir = path.join(root, "Project");
  const displayDir = path.join(projectDir, "display");
  fs.mkdirSync(displayDir, { recursive: true });
  const projectFile = path.join(projectDir, "Project.xdproj");
  fs.writeFileSync(projectFile, JSON.stringify({ projectName: "Project" }), "utf8");
  fs.writeFileSync(path.join(displayDir, "model-index.json"), JSON.stringify({
    artifactType: "target_metadata_index_v1",
    records: [
      {
        targetId: "CustomFace",
        targetKind: "model",
        identity: {
          displayName: "Custom Face",
          rawType: "Custom",
          canonicalType: "custom",
          fingerprint: "tmf1:custom-face",
          fingerprintVersion: "target-metadata-fingerprint-v1"
        },
        structure: {
          customStructure: {
            profile: "custom_face_like",
            traits: ["custom_face_like", "face_submodels"],
            confidence: 0.8,
            nodeCount: 143,
            submodels: { count: 8 },
            construction: {
              source: "layout.getModelNodes",
              dimensions: { width: 16, height: 12, layers: 1 }
            }
          }
        }
      },
      {
        targetId: "CustomFace/@Mouth1",
        targetKind: "submodel",
        identity: {
          displayName: "CustomFace / @Mouth1",
          canonicalType: "submodel",
          fingerprint: "tmf1:mouth001",
          fingerprintVersion: "target-metadata-fingerprint-v1",
          parentId: "CustomFace",
          parentName: "CustomFace"
        },
        structure: {
          submodelMetadata: {
            parentId: "CustomFace",
            parentName: "CustomFace",
            siblingCount: 7,
            overlappingSiblingIds: ["CustomFace/@Mouth2"],
            nodeCoverage: { nodeCount: 12, parentNodeCount: 143, ratio: 0.0839 },
            structureHints: ["feature_mouth"]
          }
        }
      }
    ]
  }, null, 2), "utf8");

  const write = await persistAppTargetBehaviorLearning({
    projectFile,
    commands: [
      {
        id: "effect-mouth",
        cmd: "effects.create",
        params: {
          modelName: "CustomFace/@Mouth1",
          effectName: "On",
          startMs: 0,
          endMs: 1000
        }
      }
    ],
    renderObservation: {
      artifactId: "render-custom-submodel",
      macro: { coverageRead: "partial", temporalRead: "flat", activeCoverageRatio: 0.08 }
    },
    renderValidationEvidence: {
      renderObservationRef: "render-custom-submodel",
      submodelEvidence: [
        {
          targetId: "CustomFace/@Mouth1",
          siblingCount: 7,
          nodeCoverage: { nodeCount: 12, parentNodeCount: 143, ratio: 0.0839 },
          structureHints: ["feature_mouth"]
        }
      ]
    },
    renderCritiqueContext: {
      observed: { coverageRead: "partial", temporalRead: "flat", activeCoverageRatio: 0.08 },
      quality: { band: "acceptable", issues: [] }
    },
    planHandoff: { artifactId: "plan-custom-submodel" },
    applyResult: { artifactId: "apply-custom-submodel" }
  });

  assert.equal(write.ok, true);
  assert.equal(write.skipped, false);
  assert.equal(write.recordCount, 1);
  assert.equal(write.artifactPath, path.join(displayDir, "target-behavior.json"));

  const document = JSON.parse(fs.readFileSync(write.artifactPath, "utf8"));
  assert.equal(document.artifactType, "project_target_behavior_learning_v1");
  assert.equal(document.records.length, 1);
  assert.equal(document.records[0].targetId, "CustomFace/@Mouth1");
  assert.equal(document.records[0].targetKind, "submodel");
  assert.equal(document.records[0].targetFingerprint, "tmf1:mouth001");
  assert.equal(document.records[0].effectName, "On");
  assert.equal(document.records[0].probeScope, "submodel");
  assert.equal(document.records[0].submodelContext.nodeCoverage.nodeCount, 12);
  assert.equal(document.records[0].parentContext.targetId, "CustomFace");
  assert.equal(document.records[0].parentContext.customStructure.profile, "custom_face_like");
  assert.equal(document.records[0].parentContext.customStructure.submodelCount, 8);
  assert.equal(document.records[0].stats.sampleCount, 1);
  assert.equal(document.records[0].stats.positiveCount, 1);
});
