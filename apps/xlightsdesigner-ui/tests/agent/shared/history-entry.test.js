import test from "node:test";
import assert from "node:assert/strict";

import {
  buildArtifactRefs,
  buildHistoryEntry,
  buildHistorySnapshotSummary
} from "../../../agent/shared/history-entry.js";

test("buildArtifactRefs captures artifact ids only", () => {
  const refs = buildArtifactRefs({
    analysisArtifact: { artifactId: "analysis-1", foo: "bar" },
    designSceneContext: { artifactId: "scene-1" },
    musicDesignContext: { artifactId: "music-1" },
    directorProfile: { artifactId: "profile-1" },
    creativeBrief: { artifactId: "brief-1" },
    proposalBundle: { artifactId: "proposal-1" },
    intentHandoff: { artifactId: "intent-1" },
    planHandoff: { artifactId: "plan-1" },
    applyResult: { artifactId: "apply-1" },
    renderObservation: { artifactId: "render-1" },
    renderCritiqueContext: { artifactId: "critique-1" }
  });

  assert.deepEqual(refs, {
    analysisArtifactId: "analysis-1",
    sceneContextId: "scene-1",
    musicContextId: "music-1",
    directorProfileId: "profile-1",
    briefId: "brief-1",
    proposalId: "proposal-1",
    intentHandoffId: "intent-1",
    planId: "plan-1",
    applyResultId: "apply-1",
    renderObservationId: "render-1",
    renderCritiqueContextId: "critique-1"
  });
});

test("buildHistorySnapshotSummary compacts current design and sequence state", () => {
  const summary = buildHistorySnapshotSummary({
    creativeBrief: {
      title: "Snowfall chorus focus",
      goals: ["Center the snowman", "Keep roofline supportive"]
    },
    proposalBundle: {
      proposalLines: [
        "Chorus / Snowman / central reveal",
        "Chorus / Roofline / supportive shimmer"
      ],
      assumptions: ["Chorus should feel celebratory"]
    },
    planHandoff: {
      targetIds: ["Snowman", "Roofline"],
      selectedSections: ["Chorus 1", "Chorus 2"],
      warnings: ["Review density on roofline"],
      impactCount: 2,
      graph: { nodeCount: 5 }
    },
    applyResult: {
      status: "success",
      verification: {
        ok: true,
        checked: ["effects_present"],
        failures: []
      }
    }
  });

  assert.equal(summary.designSummary.title, "Snowfall chorus focus");
  assert.deepEqual(summary.sequenceSummary.targets, ["Snowman", "Roofline"]);
  assert.equal(summary.applySummary.commandCount, 5);
  assert.equal(summary.verificationSummary.ok, true);
});

test("buildHistoryEntry produces deterministic history ids from entry content", () => {
  const artifactRefs = {
    analysisArtifactId: "analysis-1",
    sceneContextId: "scene-1",
    musicContextId: "music-1",
    directorProfileId: "profile-1",
    briefId: "brief-1",
    proposalId: "proposal-1",
    intentHandoffId: "intent-1",
    planId: "plan-1",
    applyResultId: "apply-1",
    renderObservationId: "render-1",
    renderCritiqueContextId: "critique-1"
  };
  const snapshotSummary = {
    designSummary: { title: "Brief" },
    sequenceSummary: { proposalLines: ["Line 1"] },
    applySummary: { status: "success" },
    verificationSummary: null
  };

  const entryA = buildHistoryEntry({
    projectId: "project-1",
    projectKey: "Christmas 2026",
    sequencePath: "/Show/HolidayRoad.xsq",
    xlightsRevisionBefore: "rev-a",
    xlightsRevisionAfter: "rev-b",
    status: "success",
    summary: "Applied chorus focus pass",
    artifactRefs,
    snapshotSummary,
    applyStage: "commit",
    commandCount: 4,
    impactCount: 2,
    verification: { ok: true },
    createdAt: "2026-03-13T15:00:00.000Z"
  });
  const entryB = buildHistoryEntry({
    projectId: "project-1",
    projectKey: "Christmas 2026",
    sequencePath: "/Show/HolidayRoad.xsq",
    xlightsRevisionBefore: "rev-a",
    xlightsRevisionAfter: "rev-b",
    status: "success",
    summary: "Applied chorus focus pass",
    artifactRefs,
    snapshotSummary,
    applyStage: "commit",
    commandCount: 4,
    impactCount: 2,
    verification: { ok: true },
    createdAt: "2026-03-13T15:00:00.000Z"
  });

  assert.equal(entryA.artifactType, "history_entry_v1");
  assert.equal(entryA.historyEntryId, entryB.historyEntryId);
  assert.equal(entryA.projectId, "project-1");
});
