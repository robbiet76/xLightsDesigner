import test from "node:test";
import assert from "node:assert/strict";

import { validateComparativeLiveDesignState } from "../xlights-validation.mjs";

function buildDiagnose({ sections = [], targets = [], goal = "" } = {}) {
  return {
    activeSequence: "Validation-Clean-Phase1",
    proposedCount: 1,
    rawPlan: [],
    proposalScope: {
      sections,
      targetIds: targets
    },
    executionPlanSummary: {
      passScope: "single_section",
      implementationMode: "section_patch",
      primarySections: sections,
      effectPlacementCount: 4
    },
    intentHandoffSummary: {
      goal,
      scope: {
        sections,
        targetIds: targets
      },
      executionStrategy: {
        passScope: "single_section",
        implementationMode: "section_patch",
        primarySections: sections,
        effectPlacementCount: 4
      }
    }
  };
}

function buildPageStates({ section = "Chorus 1", targets = ["Snowman", "Star"] } = {}) {
  return {
    design: {
      data: {
        executionPlan: {
          conceptRows: [
            {
              anchor: section,
              focus: targets,
              effectFamilies: ["Bars", "Wave"]
            }
          ]
        }
      }
    },
    sequence: {
      data: {
        rows: targets.map((target, idx) => ({
          target,
          section,
          summary: idx === 0 ? "Bars" : "Wave",
          designLabel: "D1.0"
        }))
      }
    }
  };
}

test("comparative live validation accepts expectedStrong alias fields", () => {
  const strong = {
    diagnose: buildDiagnose({
      sections: ["Chorus 1"],
      targets: ["Snowman", "Star"],
      goal: "Keep Snowman and Star as the focal targets in Chorus 1."
    }),
    pageStates: buildPageStates({
      section: "Chorus 1",
      targets: ["Snowman", "Star"]
    })
  };

  const weak = {
    diagnose: buildDiagnose({
      sections: ["Chorus 1"],
      targets: [],
      goal: "Keep the whole yard visually even."
    }),
    pageStates: {
      design: {
        data: {
          executionPlan: {
            conceptRows: [
              {
                anchor: "Chorus 1",
                focus: ["Borders", "Wreathes", "Train"],
                effectFamilies: ["Bars", "Wave", "Shimmer", "Morph"]
              }
            ]
          }
        }
      },
      sequence: {
        data: {
          rows: [
            { target: "Borders", section: "Chorus 1", summary: "Bars" },
            { target: "Wreathes", section: "Chorus 1", summary: "Wave" },
            { target: "Train", section: "Chorus 1", summary: "Shimmer" },
            { target: "CandyCane-01", section: "Chorus 1", summary: "Morph" }
          ]
        }
      }
    }
  };

  const out = validateComparativeLiveDesignState({
    expected: {
      expectedStrong: {
        section: "Chorus 1",
        targets: ["Snowman", "Star"]
      }
    },
    strong,
    weak
  });

  assert.equal(out.ok, true);
  assert.ok(Number(out.metrics.strongScore) > Number(out.metrics.weakScore));
});
