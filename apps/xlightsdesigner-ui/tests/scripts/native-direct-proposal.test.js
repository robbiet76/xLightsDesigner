import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildAnalysisHandoffFromArtifact } from "../../agent/audio-analyst/audio-analyst-runtime.js";
import { buildEffectDefinitionCatalog } from "../../agent/sequence-agent/effect-definition-catalog.js";
import { executeDirectSequenceRequestOrchestration } from "../../agent/sequence-agent/direct-sequence-orchestrator.js";
import { writeProjectArtifacts } from "../../storage/project-artifact-store.mjs";
import { runNativeDirectProposal } from "../../../../scripts/sequencing/native/generate-native-direct-proposal.mjs";

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

test("native direct proposal writes intent and proposal artifacts from project context", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-native-proposal-"));
  const appRoot = path.join(root, "app-root");
  const projectDir = path.join(root, "project");
  const projectFile = path.join(projectDir, "Native Proposal Test.xdproj");
  const audioPath = path.join(root, "show", "song.mp3");
  const sequencePath = path.join(root, "show", "Native Proposal Test.xsq");

  writeJson(projectFile, {
    projectName: "Native Proposal Test",
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

  const result = await runNativeDirectProposal(
    {
      projectFile,
      appRoot,
      endpoint: "http://127.0.0.1:49915/xlightsdesigner/api",
      prompt: "Put an On effect on MegaTree during Chorus 1.",
      selectedSections: ["Chorus 1"],
      selectedTargetIds: ["MegaTree"]
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
  assert.match(result.proposalArtifactId, /^proposal_bundle_v1-/);
  assert.match(result.intentArtifactId, /^intent_handoff_v1-/);
  assert.equal(result.rows.length, 2);

  const proposalPath = path.join(projectDir, "artifacts", "proposals", `${result.proposalArtifactId}.json`);
  const intentPath = path.join(projectDir, "artifacts", "intent-handoffs", `${result.intentArtifactId}.json`);
  assert.equal(fs.existsSync(proposalPath), true);
  assert.equal(fs.existsSync(intentPath), true);

  const proposal = JSON.parse(fs.readFileSync(proposalPath, "utf8"));
  const intent = JSON.parse(fs.readFileSync(intentPath, "utf8"));
  assert.equal(proposal.artifactType, "proposal_bundle_v1");
  assert.equal(intent.artifactType, "intent_handoff_v1");
  assert.deepEqual(proposal.scope.sections, ["Chorus 1"]);
  assert.deepEqual(intent.scope.targetIds, ["MegaTree"]);
  assert.equal(proposal.guidedQuestions.length, 0);
  assert.match(proposal.proposalLines.join("\n"), /On effect/i);
});
