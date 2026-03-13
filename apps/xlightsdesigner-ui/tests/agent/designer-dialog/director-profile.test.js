import test from "node:test";
import assert from "node:assert/strict";

import {
  applyAcceptedProposalToDirectorProfile,
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
