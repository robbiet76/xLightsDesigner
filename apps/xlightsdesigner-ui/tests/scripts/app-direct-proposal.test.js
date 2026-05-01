import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildAnalysisHandoffFromArtifact } from "../../agent/audio-analyst/audio-analyst-runtime.js";
import { buildEffectDefinitionCatalog } from "../../agent/sequence-agent/effect-definition-catalog.js";
import { executeDirectSequenceRequestOrchestration } from "../../agent/sequence-agent/direct-sequence-orchestrator.js";
import { writeProjectArtifacts } from "../../storage/project-artifact-store.mjs";
import { runAppDirectProposal } from "../../../../scripts/sequencing/app/generate-app-direct-proposal.mjs";
import { loadProjectDisplayMetadataAssignments } from "../../../../scripts/sequencing/app/project-display-metadata.mjs";

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function sampleAnalysisArtifact(audioPath) {
  return {
    artifactType: "analysis_artifact_v1",
    artifactId: "analysis-test-1",
    media: {
      fileName: path.basename(audioPath),
      durationMs: 90000
    },
    identity: {
      title: "Test Song",
      artist: "Test Artist",
      contentFingerprint: "fp-test-song"
    },
    structure: {
      sections: [
        { label: "Intro", startMs: 0, endMs: 12000 },
        { label: "Chorus 1", startMs: 12000, endMs: 36000 }
      ]
    },
    modules: {
      semanticStructure: {
        data: {
          sections: [
            { label: "Intro", startMs: 0, endMs: 12000 },
            { label: "Chorus 1", startMs: 12000, endMs: 36000 }
          ]
        }
      }
    }
  };
}

test("app direct proposal writes intent and proposal artifacts from project context", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-app-proposal-"));
  const appRoot = path.join(root, "app-root");
  const projectDir = path.join(root, "project");
  const projectFile = path.join(projectDir, "App Proposal Test.xdproj");
  const audioPath = path.join(root, "show", "song.mp3");
  const sequencePath = path.join(root, "show", "App Proposal Test.xsq");

  writeJson(projectFile, {
    projectName: "App Proposal Test",
    showFolder: path.dirname(sequencePath),
    snapshot: {
      audioPathInput: audioPath,
      sequencePathInput: sequencePath,
      inspiration: {
        paletteSwatches: ["#ffd36a", "#1f7a4a", "#c8324a"]
      }
    }
  });
  writeJson(path.join(appRoot, "library", "tracks", "song.json"), {
    track: {
      sourceMedia: { path: audioPath }
    },
    analyses: {
      profiles: {
        deep: sampleAnalysisArtifact(audioPath)
      }
    }
  });
  writeJson(path.join(projectDir, "display", "metadata.json"), {
    version: 1,
    tags: [
      {
        id: "tag-focal",
        name: "Focal Tree",
        description: "Primary visual anchor for chorus moments."
      }
    ],
    targetTags: {
      MegaTree: ["tag-focal"]
    },
    preferencesByTargetId: {
      MegaTree: {
        rolePreference: "lead",
        semanticHints: ["Sparkle"],
        effectAvoidances: ["Bars"]
      }
    },
    visualHintDefinitions: [
      {
        name: "Sparkle",
        status: "defined",
        semanticClass: "texture",
        behavioralIntent: "Use readable sparkle texture on chorus hits.",
        behavioralTags: ["twinkle"]
      }
    ]
  });
  writeJson(path.join(projectDir, "artifacts", "sequence-reference-patterns", "sequence_reference_patterns_v1-test.json"), {
    artifactType: "sequence_reference_patterns_v1",
    artifactId: "sequence_reference_patterns_v1-test",
    source: {
      mode: "read_only_reference_patterns",
      analyzedSequenceCount: 3
    },
    aggregate: {
      sequenceCount: 3,
      averageEffectsPerSequence: 1200,
      averageActiveTargets: 32,
      averageLayeredTargets: 9,
      densityPerMinute: { median: 240 },
      commonEffects: [
        { name: "SingleStrand", count: 90 },
        { name: "Color Wash", count: 40 }
      ],
      targetRoleMix: [
        { name: "accent", count: 100 }
      ],
      bucketEffectPatterns: {
        opening: [{ name: "Color Wash", count: 20 }]
      }
    }
  });

  let capturedMetadataAssignments = [];
  let capturedDisplayElements = [];

  const result = await runAppDirectProposal(
    {
      projectFile,
      appRoot,
      endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
      prompt: "Put an On effect on MegaTree during Chorus 1.",
      selectedSections: ["Chorus 1"],
      selectedTimingTrackName: "User Structure",
      selectedTargetIds: ["MegaTree"]
    },
    {
      getRevision: async () => ({ data: { revision: "rev-test-1" } }),
      getModels: async () => ({
        data: {
          models: [{
            id: "MegaTree",
            name: "MegaTree",
            type: "Model",
            transform: { position: { x: 42, y: 18, z: 3 } },
            width: 12,
            height: 24
          }]
        }
      }),
      getDisplayElements: async () => ({ data: { elements: [{ id: "MegaTree", name: "MegaTree", type: "model" }] } }),
      getEffectDefinitions: async () => ({ data: { effects: [] } }),
      buildAnalysisHandoffFromArtifact,
      buildEffectDefinitionCatalog,
      executeDirectSequenceRequestOrchestration: (input) => {
        capturedMetadataAssignments = input.metadataAssignments;
        capturedDisplayElements = input.displayElements;
        return executeDirectSequenceRequestOrchestration(input);
      },
      writeProjectArtifacts
    }
  );

  assert.equal(result.ok, true);
  assert.match(result.proposalArtifactId, /^proposal_bundle_v1-/);
  assert.match(result.intentArtifactId, /^intent_handoff_v1-/);
  assert.match(result.sequencingDesignHandoffArtifactId, /^sequencing_design_handoff_v2-/);
  assert.equal(result.metadataAssignmentCount, 1);
  assert.deepEqual(capturedMetadataAssignments, [
    {
      targetId: "MegaTree",
      tags: ["Focal Tree", "lead", "Primary visual anchor for chorus moments.", "Sparkle"],
      semanticHints: ["Primary visual anchor for chorus moments.", "Sparkle"],
      visualHintDefinitions: [
        {
          name: "Sparkle",
          status: "defined",
          semanticClass: "texture",
          behavioralIntent: "Use readable sparkle texture on chorus hits.",
          behavioralTags: ["twinkle"],
          source: "",
          definedBy: ""
        }
      ],
      effectAvoidances: ["Bars"],
      rolePreference: "lead",
      source: "xlightsdesigner_project_display_metadata"
    }
  ]);
  assert.equal(capturedDisplayElements[0].positionX, 42);
  assert.equal(capturedDisplayElements[0].positionY, 18);
  assert.equal(capturedDisplayElements[0].positionZ, 3);
  assert.equal(result.rows.length, 3);

  const proposalPath = path.join(projectDir, "artifacts", "proposals", `${result.proposalArtifactId}.json`);
  const intentPath = path.join(projectDir, "artifacts", "intent-handoffs", `${result.intentArtifactId}.json`);
  const designHandoffPath = path.join(projectDir, "artifacts", "sequencing-design-handoffs", `${result.sequencingDesignHandoffArtifactId}.json`);
  assert.equal(fs.existsSync(proposalPath), true);
  assert.equal(fs.existsSync(intentPath), true);
  assert.equal(fs.existsSync(designHandoffPath), true);

  const proposal = JSON.parse(fs.readFileSync(proposalPath, "utf8"));
  const intent = JSON.parse(fs.readFileSync(intentPath, "utf8"));
  const designHandoff = JSON.parse(fs.readFileSync(designHandoffPath, "utf8"));
  assert.equal(proposal.artifactType, "proposal_bundle_v1");
  assert.equal(intent.artifactType, "intent_handoff_v1");
  assert.equal(designHandoff.artifactType, "sequencing_design_handoff_v2");
  assert.equal(intent.sequencingDesignHandoff.artifactId, designHandoff.artifactId);
  assert.equal(proposal.sequencingDesignHandoffRef, designHandoff.artifactId);
  assert.match(designHandoff.designSummary, /Put an On effect/i);
  assert.equal(designHandoff.propRoleAssignments[0].targetId, "MegaTree");
  assert.equal(designHandoff.propRoleAssignments[0].role, "lead");
  assert.deepEqual(proposal.scope.sections, ["Chorus 1"]);
  assert.equal(proposal.executionPlan.timingTrackName, "User Structure");
  assert.equal(proposal.executionPlan.shouldUseFullSongStructureTrack, false);
  assert.equal(proposal.executionPlan.sectionPlans[0].sectionTimingTrackName, "User Structure");
  assert.deepEqual(intent.scope.targetIds, ["MegaTree"]);
  assert.equal(intent.sequencingDesignHandoff.scope.targetIds[0], "MegaTree");
  assert.equal(intent.sequencingDesignHandoff.referenceSequencePatterns.artifactId, "sequence_reference_patterns_v1-test");
  assert.equal(intent.sequencingDesignHandoff.referenceSequencePatterns.densityPerMinute.median, 240);
  assert.equal(intent.sequencingDesignHandoff.referenceSequencePatterns.commonEffects[0].name, "SingleStrand");
  assert.deepEqual(intent.sequencingDesignHandoff.paletteRoles.map((row) => row.hex), ["#ffd36a", "#1f7a4a", "#c8324a"]);
  assert.equal(proposal.guidedQuestions.length, 0);
  assert.match(proposal.proposalLines.join("\n"), /On effect/i);
});

test("app project display metadata loader includes preference-only target intent", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-app-metadata-"));
  const projectDir = path.join(root, "project");
  const projectFile = path.join(projectDir, "Metadata Loader Test.xdproj");
  writeJson(projectFile, {});
  writeJson(path.join(projectDir, "layout", "layout-metadata.json"), {
    version: 1,
    preferencesByTargetId: {
      Roofline: {
        rolePreference: "support",
        semanticHints: ["Outline", "Linear"],
        trainingBuckets: ["single line"]
      }
    }
  });

  assert.deepEqual(loadProjectDisplayMetadataAssignments(projectFile), [
    {
      targetId: "Roofline",
      tags: ["support", "Outline", "Linear", "single_line"],
      semanticHints: ["Outline", "Linear"],
      trainingBuckets: ["single_line"],
      visualHintDefinitions: [],
      effectAvoidances: [],
      rolePreference: "support",
      source: "xlightsdesigner_project_display_metadata"
    }
  ]);
});

test("app project display metadata loader promotes display discovery insights to group members", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-app-discovery-metadata-"));
  const projectDir = path.join(root, "project");
  const projectFile = path.join(projectDir, "Discovery Metadata Loader Test.xdproj");
  writeJson(projectFile, {});
  writeJson(path.join(projectDir, "layout", "layout-metadata.json"), {
    version: 1,
    preferencesByTargetId: {}
  });
  writeJson(path.join(projectDir, "display", "discovery.json"), {
    insights: [
      {
        subject: "Presents",
        category: "focal_hierarchy",
        value: "Secondary focal family for chorus reveals.",
        targetNames: ["Presents"]
      }
    ]
  });

  const assignments = loadProjectDisplayMetadataAssignments(projectFile, {
    layoutRows: [
      { name: "Presents", displayAs: "ModelGroup" },
      { name: "Present-01", displayAs: "Custom" },
      { name: "Present-02", displayAs: "Custom" }
    ],
    groupMemberships: {
      data: {
        groups: [
          {
            groupName: "Presents",
            directMembers: [{ name: "Present-01" }, { name: "Present-02" }],
            activeMembers: [{ name: "Present-01" }, { name: "Present-02" }],
            flattenedMembers: [{ name: "Present-01" }, { name: "Present-02" }]
          }
        ]
      }
    }
  });

  assert.deepEqual(assignments.map((row) => row.targetId), ["Present-01", "Present-02", "Presents"]);
  assert.equal(assignments.find((row) => row.targetId === "Present-01").rolePreference, "lead");
  assert.deepEqual(assignments.find((row) => row.targetId === "Present-01").tags, ["Presents", "focal_hierarchy", "lead"]);
});

test("app project display metadata loader includes custom model structure hints", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-custom-metadata-"));
  const projectDir = path.join(root, "project");
  const projectFile = path.join(projectDir, "Custom Metadata.xdproj");
  writeJson(projectFile, { projectName: "Custom Metadata", showFolder: path.join(root, "show") });
  writeJson(path.join(projectDir, "display", "model-index.json"), {
    artifactType: "target_metadata_index_v1",
    records: [
      {
        targetId: "CustomTargetA",
        identity: { displayName: "Custom Target A", canonicalType: "custom" },
        structure: {
          customStructure: {
            profile: "custom_face_like",
            traits: ["custom_grid", "face_submodels", "custom_face_like"],
            trainingBuckets: [],
            construction: {
              dimensions: { width: 56, height: 123, layers: 1 },
              nodeMap: { nodeCount: 153 }
            },
            nodeOrder: { nodeCount: 153 },
            submodels: { count: 11 }
          }
        }
      },
      {
        targetId: "CustomTargetB",
        identity: { displayName: "Custom Target B", canonicalType: "custom" },
        structure: {
          customStructure: {
            profile: "custom_radial_like",
            traits: ["custom_grid", "radial_like"],
            trainingBuckets: ["spinner"],
            construction: {
              dimensions: { width: 21, height: 21, layers: 1 },
              nodeMap: { nodeCount: 90 }
            },
            submodels: { count: 6 }
          }
        }
      }
    ]
  });

  const assignments = loadProjectDisplayMetadataAssignments(projectFile);
  const byTarget = new Map(assignments.map((row) => [row.targetId, row]));

  assert.ok(byTarget.get("CustomTargetA").tags.includes("custom model"));
  assert.ok(byTarget.get("CustomTargetA").tags.includes("custom_face_like"));
  assert.ok(byTarget.get("CustomTargetA").semanticHints.includes("custom face like"));
  assert.ok(byTarget.get("CustomTargetA").semanticHints.includes("11 custom submodels captured"));
  assert.ok(byTarget.get("CustomTargetA").semanticHints.includes("153 custom model nodes mapped"));
  assert.ok(byTarget.get("CustomTargetB").tags.includes("spinner"));
  assert.deepEqual(byTarget.get("CustomTargetB").trainingBuckets, ["spinner"]);
  assert.ok(byTarget.get("CustomTargetB").semanticHints.includes("spinner compatible custom model"));
});

test("app project display metadata loader can synthesize benchmark assignments for plain display fixtures", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-app-benchmark-metadata-"));
  const projectDir = path.join(root, "project");
  const projectFile = path.join(projectDir, "Benchmark Metadata Loader Test.xdproj");
  writeJson(projectFile, {});

  const assignments = loadProjectDisplayMetadataAssignments(projectFile, {
    allowSyntheticBenchmarkMetadata: true,
    layoutRows: [
      { name: "MegaTree", displayAs: "Tree" },
      { name: "ArchLeft", displayAs: "Arch" },
      { name: "Roofline", displayAs: "Custom" },
      { name: "All Props", displayAs: "ModelGroup" }
    ]
  });

  assert.deepEqual(assignments.map((row) => row.targetId), ["ArchLeft", "MegaTree", "Roofline"]);
  assert.equal(assignments.find((row) => row.targetId === "MegaTree").rolePreference, "lead");
  assert.equal(assignments.find((row) => row.targetId === "ArchLeft").rolePreference, "accent");
  assert.equal(assignments.find((row) => row.targetId === "Roofline").rolePreference, "support");
  assert.equal(assignments.every((row) => row.source === "xlightsdesigner_benchmark_synthetic_metadata"), true);
  assert.equal(assignments.find((row) => row.targetId === "MegaTree").tags.includes("benchmark"), true);
  assert.equal(assignments.find((row) => row.targetId === "MegaTree").tags.includes("tree"), true);
  assert.equal(assignments.find((row) => row.targetId === "Roofline").tags.includes("line"), true);
});

test("app direct proposal resolves app metadata tags into proposal target scope", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-app-proposal-metadata-"));
  const appRoot = path.join(root, "app-root");
  const projectDir = path.join(root, "project");
  const projectFile = path.join(projectDir, "App Metadata Scope Test.xdproj");
  const audioPath = path.join(root, "show", "song.mp3");
  const sequencePath = path.join(root, "show", "App Metadata Scope Test.xsq");

  writeJson(projectFile, {
    projectName: "App Metadata Scope Test",
    showFolder: path.dirname(sequencePath),
    snapshot: {
      audioPathInput: audioPath,
      sequencePathInput: sequencePath
    }
  });
  writeJson(path.join(appRoot, "library", "tracks", "song.json"), {
    track: {
      sourceMedia: { path: audioPath }
    },
    analyses: {
      profiles: {
        deep: sampleAnalysisArtifact(audioPath)
      }
    }
  });
  writeJson(path.join(projectDir, "layout", "layout-metadata.json"), {
    version: 1,
    preferencesByTargetId: {
      MegaTree: {
        rolePreference: "lead",
        semanticHints: ["centerpiece"],
        effectAvoidances: ["Bars"]
      }
    }
  });

  const result = await runAppDirectProposal(
    {
      projectFile,
      appRoot,
      endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
      prompt: "Make the chorus read through the lead display element.",
      selectedSections: ["Chorus 1"],
      selectedTagNames: ["lead"]
    },
    {
      getRevision: async () => ({ data: { revision: "rev-test-1" } }),
      getModels: async () => ({ data: { models: [{ id: "MegaTree", name: "MegaTree", type: "Model" }] } }),
      getDisplayElements: async () => ({ data: { elements: [{ id: "MegaTree", name: "MegaTree", type: "model" }] } }),
      getEffectDefinitions: async () => ({ data: { effects: [] } }),
      buildAnalysisHandoffFromArtifact,
      buildEffectDefinitionCatalog,
      executeDirectSequenceRequestOrchestration,
      writeProjectArtifacts
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.metadataAssignmentCount, 1);

  const proposalPath = path.join(projectDir, "artifacts", "proposals", `${result.proposalArtifactId}.json`);
  const intentPath = path.join(projectDir, "artifacts", "intent-handoffs", `${result.intentArtifactId}.json`);
  const proposal = JSON.parse(fs.readFileSync(proposalPath, "utf8"));
  const intent = JSON.parse(fs.readFileSync(intentPath, "utf8"));

  assert.deepEqual(proposal.scope.targetIds, ["MegaTree"]);
  assert.deepEqual(proposal.scope.tagNames, ["lead"]);
  assert.deepEqual(proposal.executionPlan.sectionPlans[0].targetIds, ["MegaTree"]);
  assert.equal(proposal.executionPlan.targetCount, 1);
  assert.deepEqual(intent.scope.targetIds, ["MegaTree"]);
  assert.match(proposal.proposalLines.join("\n"), /lead read/i);
  assert.match(proposal.proposalLines.join("\n"), /centerpiece/i);
  assert.match(proposal.proposalLines.join("\n"), /Bars/i);
});
