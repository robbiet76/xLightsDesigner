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
          drilldownTargetIds: ["MegaTree", "Roofline"],
          adjacentWindowComparisons: [
            { windowsReadSimilarly: true, sameLeadModel: true }
          ],
          drilldownTargetEvidence: [
            {
              targetId: "MegaTree",
              targetKind: "model_or_group",
              reasons: ["adjacent_windows_read_similarly"],
              windowLabels: ["Verse", "Chorus"]
            }
          ]
        },
        source: { samplingDetail: "section" }
      },
      sequenceRevisionObjective: {
        ladderLevel: "section",
        scope: {
          nextOwner: "shared",
          revisionRoles: ["strengthen_lead", "increase_section_contrast"],
          revisionTargets: ["MegaTree", "Verse"]
        }
      },
      planHandoff: {
        metadata: {
          effectStrategy: {
            seedRecommendations: [
              { effectName: "Shimmer", targetIds: ["MegaTree"] },
              { effectName: "Twinkle", targetIds: ["Roofline"] }
            ]
          }
        }
      },
      effectOutcomeRecords: [
        {
          effectName: "Bars",
          revisionRoles: ["strengthen_lead"],
          memoryKeys: ["section::section::strengthen_lead::lead_mismatch::Bars"],
          outcome: { status: "improved", improved: true }
        },
        {
          effectName: "Twinkle",
          revisionRoles: ["increase_section_contrast"],
          memoryKeys: ["section::section::increase_section_contrast::weak_section_contrast::Twinkle"],
          outcome: { status: "unchanged", improved: false }
        }
      ]
    }
  });

  assert.equal(out.artifactType, "sequencer_prior_pass_memory_v1");
  assert.equal(out.previousRevisionLevel, "section");
  assert.equal(out.previousOwner, "shared");
  assert.deepEqual(out.previousRevisionRoles, ["strengthen_lead", "increase_section_contrast"]);
  assert.deepEqual(out.previousRevisionTargets, ["MegaTree", "Verse"]);
  assert.deepEqual(out.unresolvedSignals, ["lead_mismatch", "flat_development", "weak_section_contrast", "under_coverage"]);
  assert.deepEqual(out.previousEffectNames, ["Shimmer", "Twinkle"]);
  assert.deepEqual(out.previousTargetIds, ["MegaTree", "Roofline"]);
  assert.deepEqual(out.effectOutcomeMemory.successfulEffects, ["Bars"]);
  assert.deepEqual(out.effectOutcomeMemory.failedEffects, ["Twinkle"]);
  assert.deepEqual(out.effectOutcomeMemory.successfulRevisionRoles, ["strengthen_lead"]);
  assert.deepEqual(out.effectOutcomeMemory.failedRevisionRoles, ["increase_section_contrast"]);
  assert.deepEqual(out.effectOutcomeMemory.tendencies.focus.successfulEffects, ["Bars"]);
  assert.deepEqual(out.effectOutcomeMemory.tendencies.section_contrast.failedEffects, ["Twinkle"]);
  assert.equal(out.drilldownMemory.heldAtSectionLevel, true);
  assert.equal(out.drilldownMemory.eligible, false);
  assert.deepEqual(out.drilldownMemory.targetIds, []);
  assert.deepEqual(out.drilldownMemory.withheldTargetIds, ["MegaTree", "Roofline"]);
  assert.deepEqual(out.drilldownMemory.withheldTargetEvidence[0].targetId, "MegaTree");
});

test("buildPriorPassMemory prefers revision delta current values when available", () => {
  const out = buildPriorPassMemory({
    historySnapshot: {
      renderCritiqueContext: {
        observed: {
          leadModel: "Snowman",
          breadthRead: "broad",
          temporalRead: "evolving",
          coverageRead: "balanced"
        },
        comparison: {}
      },
      sequenceRevisionObjective: {
        ladderLevel: "section",
        scope: {
          nextOwner: "shared"
        }
      },
      planHandoff: {
        metadata: {
          revisionDelta: {
            artifactType: "revision_delta_v1",
            current: {
              effectNames: ["Color Wash"],
              targetIds: ["Snowman"]
            }
          },
          effectStrategy: {
            seedRecommendations: [
              { effectName: "Shimmer", targetIds: ["MegaTree"] }
            ]
          }
        }
      }
    }
  });

  assert.deepEqual(out.previousEffectNames, ["Color Wash"]);
  assert.deepEqual(out.previousTargetIds, ["Snowman"]);
  assert.deepEqual(out.retryPressureSignals, []);
});

test("buildPriorPassMemory flags low-change retry when unresolved signals remain and revision delta changed nothing", () => {
  const out = buildPriorPassMemory({
    historySnapshot: {
      renderCritiqueContext: {
        observed: {
          leadModel: "Snowman",
          breadthRead: "tight",
          temporalRead: "flat",
          coverageRead: "balanced"
        },
        comparison: {
          leadMatchesPrimaryFocus: false
        }
      },
      sequenceRevisionObjective: {
        ladderLevel: "section",
        scope: {
          nextOwner: "shared"
        }
      },
      planHandoff: {
        metadata: {
          revisionDelta: {
            artifactType: "revision_delta_v1",
            current: {
              effectNames: ["Color Wash"],
              targetIds: ["Snowman"]
            },
            previous: {
              effectNames: ["Color Wash"],
              targetIds: ["Snowman"]
            },
            introduced: {
              effectNames: [],
              targetIds: []
            }
          }
        }
      }
    }
  });

  assert.deepEqual(out.retryPressureSignals, ["low_change_retry"]);
});

test("buildPriorPassMemory carries eligible drilldown targets only after drilldown sampling", () => {
  const out = buildPriorPassMemory({
    historySnapshot: {
      renderCritiqueContext: {
        source: { samplingDetail: "drilldown" },
        observed: {
          leadModel: "MegaTree",
          temporalRead: "flat"
        },
        comparison: {
          adjacentWindowComparisons: [
            { windowsReadSimilarly: true, sameLeadModel: true }
          ],
          drilldownTargetIds: ["MegaTree", "Roofline"],
          drilldownTargetEvidence: [
            {
              targetId: "MegaTree",
              targetKind: "model_or_group",
              reasons: ["adjacent_windows_read_similarly", "flat_drilldown_window"],
              windowLabels: ["Verse", "Chorus"]
            }
          ]
        }
      },
      sequenceRevisionObjective: {
        ladderLevel: "section",
        scope: {
          nextOwner: "shared"
        }
      }
    }
  });

  assert.equal(out.drilldownMemory.heldAtSectionLevel, false);
  assert.equal(out.drilldownMemory.eligible, true);
  assert.deepEqual(out.drilldownMemory.targetIds, ["MegaTree", "Roofline"]);
  assert.deepEqual(out.drilldownMemory.targetEvidence[0].targetId, "MegaTree");
  assert.deepEqual(out.drilldownMemory.sectionInstabilitySignals, ["flat_development", "weak_section_contrast"]);
});
