import test from "node:test";
import assert from "node:assert/strict";

import { buildPriorPassMemory } from "../../../agent/sequence-agent/revision-memory.js";

test("buildPriorPassMemory summarizes unresolved signals from the previous applied snapshot", () => {
  const out = buildPriorPassMemory({
    historySnapshot: {
      renderCritiqueContext: {
        observed: {
          leadModel: "Roofline",
          breadthRead: "tight",
          temporalRead: "flat",
          coverageRead: "sparse"
        },
        comparison: {
          leadMatchesPrimaryFocus: false,
          renderCoverageTooSparse: true,
          adjacentWindowComparisons: [
            { windowsReadSimilarly: true, sameLeadModel: true }
          ]
        }
      },
      sequenceRevisionObjective: {
        ladderLevel: "section",
        scope: {
          nextOwner: "shared",
          revisionRoles: ["strengthen_lead", "increase_section_contrast"],
          revisionTargets: ["MegaTree", "Verse"]
        }
      }
    }
  });

  assert.equal(out.artifactType, "sequencer_prior_pass_memory_v1");
  assert.equal(out.previousRevisionLevel, "section");
  assert.equal(out.previousOwner, "shared");
  assert.deepEqual(out.previousRevisionRoles, ["strengthen_lead", "increase_section_contrast"]);
  assert.deepEqual(out.previousRevisionTargets, ["MegaTree", "Verse"]);
  assert.deepEqual(out.unresolvedSignals, ["lead_mismatch", "flat_development", "weak_section_contrast", "under_coverage"]);
});
