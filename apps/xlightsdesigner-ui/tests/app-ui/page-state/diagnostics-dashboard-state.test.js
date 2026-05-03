import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildDiagnosticsDashboardState } from "../../../app-ui/page-state/diagnostics-dashboard-state.js";

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
