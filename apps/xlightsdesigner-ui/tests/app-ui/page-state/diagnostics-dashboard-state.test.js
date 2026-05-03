import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildDiagnosticsDashboardState } from "../../../app-ui/page-state/diagnostics-dashboard-state.js";
import { buildDiagnosticsDrawer } from "../../../app-ui/operator-panels.js";

test("diagnostics dashboard state summarizes counts, rows, and recent applies", () => {
  const dashboard = buildDiagnosticsDashboardState({
    state: {
      ui: {
        diagnosticsOpen: true,
        diagnosticsFilter: "warning"
      },
      sceneGraph: {
        modelsById: {
          CustomA: { id: "CustomA", displayAs: "Custom" },
          CustomB: { id: "CustomB", displayAs: "Custom" },
          CustomC: { id: "CustomC", displayAs: "Custom" },
          Tree: { id: "Tree", displayAs: "Tree 360" }
        },
        submodelsById: {
          "CustomA/@Part": { id: "CustomA/@Part", parentId: "CustomA" },
          "CustomB/@Part": { id: "CustomB/@Part", parentId: "CustomB" }
        }
      },
      diagnostics: [
        { level: "warning", text: "Scene graph partial", ts: "2026-03-16T13:00:00.000Z" },
        { level: "info", text: "Connected", ts: "2026-03-16T13:01:00.000Z" }
      ],
      applyHistory: [
        { status: "completed", commandCount: 3, createdAt: "2026-03-16T13:10:00.000Z", summary: "Applied test plan" }
      ],
      sequenceAgentRuntime: {
        targetBehaviorLearning: {
          artifactPath: "/project/display/target-behavior.json",
          records: [
            {
              targetId: "CustomA/@Part",
              targetKind: "submodel",
              targetFingerprint: "tmf1:custom-part",
              effectName: "On",
              probeScope: "submodel",
              stats: {
                sampleCount: 3,
                positiveCount: 2,
                negativeCount: 1,
                lastObservedAt: "2026-03-16T13:05:00.000Z"
              },
              submodelContext: {
                nodeCoverage: { ratio: 0.2 }
              },
              parentContext: {
                customStructure: { profile: "custom_face_like" }
              }
            },
            {
              targetId: "Tree",
              targetKind: "model"
            }
          ]
        }
      },
      agentPlan: {
        handoff: {
          metadata: {
            generativeSummary: {
              targetContext: {
                targetBehaviorAvailable: true,
                targetBehaviorMatchedRecordIds: ["tbl1:custom-part-on"],
                targetBehaviorEvidenceCandidateIds: ["candidate-focused"],
                targetFingerprints: ["tmf1:custom-part"],
                targetBehaviorStats: {
                  sampleCount: 3,
                  positiveCount: 2,
                  negativeCount: 1
                }
              }
            }
          }
        }
      },
      health: {
        lastCheckedAt: "2026-03-16T13:20:00.000Z",
        runtimeReady: true,
        appFileDialogReady: true,
        appBridgeApiCount: 12,
        xlightsVersion: "2026.10",
        compatibilityStatus: "ok",
        agentRegistryValid: true
      }
    },
    helpers: {
      getDiagnosticsCounts: () => ({ total: 2, warning: 1, actionRequired: 0 }),
      buildLabel: "Build: test"
    }
  });

  assert.equal(dashboard.page, "diagnostics");
  assert.equal(dashboard.status, "open");
  assert.equal(dashboard.data.counts.warning, 1);
  assert.equal(dashboard.data.filteredRows.length, 1);
  assert.equal(dashboard.data.recentApplies.length, 1);
  assert.equal(dashboard.data.health.buildLabel, "Build: test");
  assert.equal(dashboard.data.health.customModelCount, 3);
  assert.equal(dashboard.data.health.customModelsWithSubmodels, 2);
  assert.equal(dashboard.data.health.targetBehaviorLearningCount, 2);
  assert.equal(dashboard.data.health.targetBehaviorLearningSubmodelCount, 1);
  assert.equal(dashboard.data.health.targetBehaviorLearningCustomParentCount, 1);
  assert.equal(dashboard.data.health.targetBehaviorLearningArtifactPath, "/project/display/target-behavior.json");
  assert.equal(dashboard.data.targetBehaviorEvidence.stats.sampleCount, 3);
  assert.equal(dashboard.data.targetBehaviorEvidence.records[0].targetFingerprint, "tmf1:custom-part");
  assert.equal(dashboard.data.targetBehaviorEvidence.records[0].nodeCoverageRatio, 0.2);
  assert.deepEqual(dashboard.data.targetBehaviorEvidence.planContext.targetBehaviorMatchedRecordIds, ["tbl1:custom-part-on"]);
  assert.deepEqual(dashboard.data.targetBehaviorEvidence.planContext.targetBehaviorEvidenceCandidateIds, ["candidate-focused"]);
});

test("diagnostics drawer renders compact target behavior evidence", () => {
  const html = buildDiagnosticsDrawer({
    state: {
      ui: { diagnosticsOpen: true, diagnosticsFilter: "all" }
    },
    helpers: {
      getDiagnosticsCounts: () => ({ total: 0, warning: 0, actionRequired: 0 }),
      escapeHtml: (value) => String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;"),
      buildLabel: "Build: test",
      pageStates: {
        diagnostics: {
          data: {
            counts: { total: 0, warning: 0, actionRequired: 0 },
            filter: "all",
            filteredRows: [],
            recentApplies: [],
            health: {
              targetBehaviorLearningCount: 1,
              targetBehaviorLearningSubmodelCount: 1,
              targetBehaviorLearningCustomParentCount: 1
            },
            targetBehaviorEvidence: {
              artifactPath: "/project/display/target-behavior.json",
              stats: { sampleCount: 3, positiveCount: 2, negativeCount: 1 },
              planContext: {
                targetBehaviorAvailable: true,
                targetBehaviorMatchedRecordIds: ["tbl1:custom-part-on"],
                targetBehaviorEvidenceCandidateIds: ["candidate-focused"]
              },
              records: [
                {
                  targetId: "CustomA/@Part",
                  targetKind: "submodel",
                  targetFingerprint: "tmf1:custom-part",
                  effectName: "On",
                  probeScope: "submodel",
                  sampleCount: 3,
                  positiveCount: 2,
                  negativeCount: 1,
                  nodeCoverageRatio: 0.2
                }
              ]
            }
          }
        }
      }
    }
  });

  assert.match(html, /Behavior Artifact/);
  assert.match(html, /Matched Behavior/);
  assert.match(html, /tbl1:custom-part-on/);
  assert.match(html, /Influenced Candidates/);
  assert.match(html, /candidate-focused/);
  assert.match(html, /CustomA\/@Part/);
});

test("diagnostics dashboard state summarizes compact target behavior write status", () => {
  const dashboard = buildDiagnosticsDashboardState({
    state: {
      ui: { diagnosticsOpen: true, diagnosticsFilter: "all" },
      sceneGraph: {},
      sequenceAgentRuntime: {
        targetBehaviorLearning: {
          recordCount: 3,
          submodelRecordCount: 2,
          customParentRecordCount: 1,
          artifactPath: "/project/display/target-behavior.json"
        }
      },
      diagnostics: [],
      applyHistory: [],
      health: {}
    }
  });

  assert.equal(dashboard.data.health.targetBehaviorLearningCount, 3);
  assert.equal(dashboard.data.health.targetBehaviorLearningSubmodelCount, 2);
  assert.equal(dashboard.data.health.targetBehaviorLearningCustomParentCount, 1);
});

test("diagnostics dashboard state summarizes persisted target behavior records", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "xld-diagnostics-target-behavior-"));
  const artifactPath = path.join(root, "Project", "display", "target-behavior.json");
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify({
    artifactType: "project_target_behavior_learning_v1",
    artifactVersion: "1.0",
    records: [
      {
        targetId: "CustomFace/@Mouth1",
        targetKind: "submodel",
        parentContext: {
          targetId: "CustomFace",
          customStructure: { profile: "custom_face_like" }
        }
      }
    ]
  }, null, 2), "utf8");
  const persisted = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const dashboard = buildDiagnosticsDashboardState({
    state: {
      ui: { diagnosticsOpen: true, diagnosticsFilter: "all" },
      sceneGraph: {},
      sequenceAgentRuntime: {
        targetBehaviorLearning: {
          artifactPath,
          records: persisted.records
        }
      },
      diagnostics: [],
      applyHistory: [],
      health: {}
    }
  });

  assert.equal(dashboard.data.health.targetBehaviorLearningCount, 1);
  assert.equal(dashboard.data.health.targetBehaviorLearningSubmodelCount, 1);
  assert.equal(dashboard.data.health.targetBehaviorLearningCustomParentCount, 1);
  assert.equal(dashboard.data.health.targetBehaviorLearningArtifactPath, artifactPath);
});
