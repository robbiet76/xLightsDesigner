import test from "node:test";
import assert from "node:assert/strict";

import { buildSamplingAudit } from "./build-effect-sampling-audit.mjs";

test("effect sampling audit separates focused anchors from interaction-only evidence", () => {
  const registry = {
    effects: {
      Bars: {
        parameters: {
          barCount: {
            type: "numeric",
            anchors: [1, 3, 5],
            importance: "high",
            practicalPriority: "high",
            stopRule: "stop_when_regions_stabilize"
          },
          cycles: {
            type: "numeric",
            anchors: [2, 5, 10],
            importance: "high",
            practicalPriority: "high",
            stopRule: "refine_only_near_breakpoints"
          },
          gradient: {
            type: "boolean",
            anchors: [false, true],
            importance: "medium",
            practicalPriority: "medium",
            stopRule: "all_meaningful_options"
          }
        }
      }
    }
  };
  const trainingSet = {
    effects: [
      {
        effectName: "Bars",
        parameterLearning: {
          derivedPriors: {
            priors: [
              {
                parameterName: "barCount",
                paletteMode: "rgb_primary",
                distinctAnchorCount: 3,
                sampleCount: 3,
                behaviorDimensions: {
                  behaviorRules: [
                    { dimension: "coverage", direction: "decreases", magnitude: 1, summary: "barCount decreases coverage" }
                  ]
                },
                anchorProfiles: [
                  { parameterValue: 1, behaviorHints: ["behavior_anchor"] },
                  { parameterValue: 3, behaviorHints: ["behavior_anchor"] },
                  { parameterValue: 5, behaviorHints: ["behavior_anchor"] }
                ]
              },
              {
                parameterName: "cycles",
                paletteMode: "rgb_primary",
                distinctAnchorCount: 3,
                sampleCount: 3,
                behaviorDimensions: {
                  behaviorRules: [
                    { dimension: "motion", direction: "increases", magnitude: 0.1, summary: "cycles increases motion" }
                  ]
                },
                anchorProfiles: [
                  { parameterValue: 2, behaviorHints: ["interaction_sweep"] },
                  { parameterValue: 5, behaviorHints: ["interaction_sweep"] },
                  { parameterValue: 10, behaviorHints: ["interaction_sweep"] }
                ]
              }
            ]
          }
        }
      }
    ]
  };
  const audit = buildSamplingAudit({ registry, trainingSet, records: [] });
  const bars = audit.effects.find((row) => row.effectName === "Bars");
  const byParam = Object.fromEntries(bars.parameters.map((row) => [row.parameterName, row]));

  assert.equal(byParam.barCount.status, "causal_ready");
  assert.equal(byParam.cycles.status, "needs_causal_anchor_confirmation");
  assert.equal(byParam.gradient.status, "missing");
  assert.equal(audit.nextSamplingQueue[0].parameterName, "cycles");
  assert.equal(audit.nextSamplingQueue.some((row) => row.parameterName === "cycles"), true);
  assert.equal(audit.nextSamplingQueue.some((row) => row.parameterName === "gradient"), true);
  assert.equal(audit.currentEffectQueue[0].parameterName, "cycles");
  assert.equal(audit.newEffectExpansionQueue[0].parameterName, "gradient");
});

test("effect sampling audit flags blank-heavy focused ranges for repair", () => {
  const registry = {
    effects: {
      Marquee: {
        parameters: {
          skipSize: {
            type: "numeric",
            anchors: [0, 4, 8],
            importance: "high",
            practicalPriority: "high"
          }
        }
      }
    }
  };
  const trainingSet = {
    effects: [
      {
        effectName: "Marquee",
        parameterLearning: {
          derivedPriors: {
            priors: [
              {
                parameterName: "skipSize",
                paletteMode: "mono_white",
                distinctAnchorCount: 3,
                sampleCount: 3,
                behaviorDimensions: {
                  behaviorRules: [
                    { dimension: "coverage", direction: "decreases", magnitude: 0.4, summary: "skipSize decreases coverage" }
                  ]
                },
                anchorProfiles: [
                  { parameterValue: 0, behaviorHints: ["behavior_anchor"] },
                  { parameterValue: 4, behaviorHints: ["behavior_anchor"] },
                  { parameterValue: 8, behaviorHints: ["behavior_anchor"] }
                ]
              }
            ]
          }
        }
      }
    ]
  };
  const records = [
    {
      recordVersion: "1.0",
      effectName: "Marquee",
      trainingContext: { screenedParameterName: "skipSize", screeningPaletteMode: "mono_white" },
      effectSettings: { skipSize: 0 },
      observations: { labels: ["decoded_fseq"] }
    },
    {
      recordVersion: "1.0",
      effectName: "Marquee",
      trainingContext: { screenedParameterName: "skipSize", screeningPaletteMode: "mono_white" },
      effectSettings: { skipSize: 4 },
      observations: { labels: ["decoded_fseq", "blank_sampled_frame"] }
    }
  ];
  const audit = buildSamplingAudit({ registry, trainingSet, records });
  const skipSize = audit.effects[0].parameters[0];

  assert.equal(skipSize.status, "needs_range_repair");
  assert.equal(skipSize.recommendation.includes("repair sampled range"), true);
  assert.equal(skipSize.paletteSummaries[0].blankRecordShare, 0.5);
});
