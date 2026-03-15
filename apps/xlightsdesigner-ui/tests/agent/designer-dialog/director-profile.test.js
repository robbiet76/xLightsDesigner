import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAcceptedProposalToDirectorProfile,
  applyExplicitPreferenceNoteToDirectorProfile,
  buildDefaultDirectorProfile,
  normalizeDirectorProfile
} from "../../../agent/designer-dialog/director-profile.js";

test("normalizeDirectorProfile returns canonical default shape", () => {
  const profile = normalizeDirectorProfile(null, {
    directorId: "rob-terry",
    displayName: "Rob Terry"
  });

  assert.equal(profile.artifactType, "director_profile_v1");
  assert.equal(profile.directorId, "rob-terry");
  assert.equal(profile.displayName, "Rob Terry");
  assert.deepEqual(profile.evidence.acceptedProposalIds, []);
});

test("applyAcceptedProposalToDirectorProfile records accepted proposal evidence and learned signals", () => {
  const base = buildDefaultDirectorProfile({
    directorId: "rob-terry",
    displayName: "Rob Terry"
  });

  const next = applyAcceptedProposalToDirectorProfile(base, {
    proposalBundle: {
      proposalId: "proposal-1",
      scope: { targetIds: ["MegaTree"] },
      constraints: { changeTolerance: "low" },
      proposalLines: ["Chorus / MegaTree / refine contrast"],
      impact: { estimatedImpact: 12 },
      traceability: {
        designSceneSignals: {
          focalCandidates: ["MegaTree", "Roofline"]
        }
      }
    }
  });

  assert.deepEqual(next.evidence.acceptedProposalIds, ["proposal-1"]);
  assert.ok(next.preferences.focusBias.weight > 0);
  assert.ok(next.preferences.changeTolerance.weight < 0);
  assert.ok(next.preferences.complexityTolerance.weight < 0);
  assert.ok(typeof next.summary === "string");
});

test("single accepted proposal remains weak evidence and does not dominate summary", () => {
  const base = buildDefaultDirectorProfile({
    directorId: "rob-terry",
    displayName: "Rob Terry"
  });

  const next = applyAcceptedProposalToDirectorProfile(base, {
    proposalBundle: {
      proposalId: "proposal-weak-1",
      scope: { targetIds: ["Snowman"] },
      constraints: { changeTolerance: "low" },
      proposalLines: ["Chorus 1 / Snowman / refine contrast"],
      impact: { estimatedImpact: 12 },
      traceability: {
        designSceneSignals: {
          focalCandidates: ["Snowman", "NorthPoleMatrix"]
        }
      }
    }
  });

  assert.equal(next.preferences.focusBias.evidenceCount, 1);
  assert.equal(next.summary, "");
});

test("repeated accepted evidence strengthens preference signals gradually", () => {
  let profile = buildDefaultDirectorProfile({
    directorId: "rob-terry",
    displayName: "Rob Terry"
  });

  for (const proposalId of ["proposal-repeat-1", "proposal-repeat-2", "proposal-repeat-3"]) {
    profile = applyAcceptedProposalToDirectorProfile(profile, {
      proposalBundle: {
        proposalId,
        scope: { targetIds: ["Snowman"] },
        constraints: { changeTolerance: "low" },
        proposalLines: ["Chorus 1 / Snowman / refine contrast"],
        impact: { estimatedImpact: 12 },
        traceability: {
          designSceneSignals: {
            focalCandidates: ["Snowman", "NorthPoleMatrix"]
          }
        }
      }
    });
  }

  assert.ok(profile.preferences.focusBias.evidenceCount >= 3);
  assert.ok(profile.preferences.focusBias.confidence >= 0.2);
  assert.match(profile.summary, /prefers focusBias|prefers changeTolerance|prefers complexityTolerance|tends to avoid/i);
});

test("explicit broad preference notes weigh more than one accepted local proposal", () => {
  let profile = buildDefaultDirectorProfile({
    directorId: "rob-terry",
    displayName: "Rob Terry"
  });

  profile = applyAcceptedProposalToDirectorProfile(profile, {
    proposalBundle: {
      proposalId: "proposal-local-1",
      scope: { targetIds: ["Snowman"] },
      constraints: { changeTolerance: "low" },
      proposalLines: ["Chorus 1 / Snowman / refine contrast"],
      impact: { estimatedImpact: 12 },
      traceability: {
        designSceneSignals: {
          focalCandidates: ["Snowman", "NorthPoleMatrix"]
        }
      }
    }
  });

  profile = applyExplicitPreferenceNoteToDirectorProfile(profile, {
    note: "In general, keep things cleaner and more focused.",
    scope: "project",
    strength: "strong"
  });

  assert.ok(profile.evidence.explicitPreferenceNotes.length === 1);
  assert.ok(profile.preferences.focusBias.evidenceCount >= 2);
  assert.ok(profile.preferences.complexityTolerance.evidenceCount >= 2);
  assert.match(profile.summary, /prefers focusBias|tends to avoid complexityTolerance|prefers complexityTolerance|tends to avoid/i);
});

test("sequence-local exception notes do not rewrite broader baseline summary", () => {
  let profile = buildDefaultDirectorProfile({
    directorId: "rob-terry",
    displayName: "Rob Terry"
  });

  profile = applyExplicitPreferenceNoteToDirectorProfile(profile, {
    note: "In general, keep things cleaner and more focused.",
    scope: "project",
    strength: "strong"
  });
  const summaryBefore = profile.summary;

  profile = applyExplicitPreferenceNoteToDirectorProfile(profile, {
    note: "For this sequence only, let the final chorus get denser.",
    scope: "sequence",
    strength: "strong"
  });

  assert.equal(profile.summary, summaryBefore);
  assert.equal(profile.evidence.explicitPreferenceNotes.length, 2);
});
