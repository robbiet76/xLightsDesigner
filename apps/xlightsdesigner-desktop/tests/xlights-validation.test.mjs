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

test("comparative live validation prefers restrained render discipline over a busier whole-song alternative", () => {
  const strong = {
    diagnose: {
      activeSequence: "API-Designer-WholePass-20260317-B",
      proposalScope: { sections: [] },
      executionPlanSummary: {
        passScope: "whole_sequence",
        implementationMode: "whole_sequence_pass",
        primarySections: ["Intro", "Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Bridge", "Final Chorus", "Outro"],
        effectPlacementCount: 41
      },
      intentHandoffSummary: {
        goal: "Design the full song with a restrained glowing base, smoother texture transitions, and selective sparkle only on the bigger lifts so the render feels polished instead of busy.",
        scope: { sections: [], targetIds: [] },
        executionStrategy: {
          passScope: "whole_sequence",
          implementationMode: "whole_sequence_pass",
          primarySections: ["Intro", "Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Bridge", "Final Chorus", "Outro"],
          effectPlacementCount: 41
        }
      },
      rawPlan: []
    },
    pageStates: {
      design: {
        data: {
          executionPlan: {
            conceptRows: [
              {
                anchor: "Intro",
                focus: [
                  "AllModels",
                  "AllModels_NoFloods",
                  "AllModels_NoMatrix",
                  "AllModels_NoMatrix_Floods",
                  "Border-01/Left",
                  "Border-01/Segments",
                  "Border-02/Left",
                  "Border_Segments",
                  "Borders",
                  "CandyCane-01/Diagonals",
                  "CandyCane-01/Fill",
                  "CandyCane-01/Outline",
                  "CandyCane-02/Diagonals",
                  "CandyCane-02/Rows",
                  "CandyCane-03/Little Canes",
                  "FrontHouse"
                ],
                effectFamilies: ["Bars", "Candle", "Color Wash", "Morph", "Pinwheel", "Shimmer", "Spirals", "Wave"]
              }
            ]
          }
        }
      },
      sequence: {
        data: {
          rows: Array.from({ length: 33 }, (_, idx) => ({
            target: `Target-${idx + 1}`,
            section: idx < 8 ? "Intro" : "Chorus 1",
            summary: "Color Wash"
          }))
        }
      }
    }
  };

  const weak = {
    diagnose: {
      activeSequence: "API-Designer-WholePass-20260317-B",
      proposalScope: { sections: [] },
      executionPlanSummary: {
        passScope: "whole_sequence",
        implementationMode: "whole_sequence_pass",
        primarySections: ["Intro", "Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Bridge", "Final Chorus", "Outro"],
        effectPlacementCount: 55
      },
      intentHandoffSummary: {
        goal: "Keep changing textures aggressively across the whole song with busier sparkle, harder texture swaps, and less restraint in the base look.",
        scope: { sections: [], targetIds: [] },
        executionStrategy: {
          passScope: "whole_sequence",
          implementationMode: "whole_sequence_pass",
          primarySections: ["Intro", "Verse 1", "Chorus 1", "Verse 2", "Chorus 2", "Bridge", "Final Chorus", "Outro"],
          effectPlacementCount: 55
        }
      },
      rawPlan: []
    },
    pageStates: {
      design: {
        data: {
          executionPlan: {
            conceptRows: [
              {
                anchor: "Intro",
                focus: [
                  "Border-01/Left",
                  "Border-01/Segments",
                  "Border-02/Left",
                  "Border_Segments",
                  "Borders",
                  "CandyCane-01/Diagonals",
                  "CandyCane-01/Fill",
                  "CandyCane-01/Outline",
                  "CandyCane-02/Diagonals",
                  "CandyCane-02/Rows",
                  "CandyCane-03/Little Canes",
                  "Floods Front",
                  "FrontHouse",
                  "SpiralTreeStars",
                  "SpiralTrees",
                  "Train",
                  "Train_Hubs",
                  "Train_NoMatrix",
                  "Wreathes",
                  "Wreathes_All"
                ],
                effectFamilies: ["Bars", "Candle", "Color Wash", "Morph", "Pinwheel", "Shimmer", "Spirals", "Wave"]
              }
            ]
          }
        }
      },
      sequence: {
        data: {
          rows: Array.from({ length: 36 }, (_, idx) => ({
            target: `Target-${idx + 1}`,
            section: idx < 8 ? "Intro" : "Chorus 1",
            summary: "Color Wash"
          }))
        }
      }
    }
  };

  const out = validateComparativeLiveDesignState({ strong, weak });

  assert.equal(out.ok, true);
  assert.ok(Number(out.metrics.strongScore) > Number(out.metrics.weakScore));
});
