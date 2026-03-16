import test from "node:test";
import assert from "node:assert/strict";

import { buildDiagnosticsDashboardState } from "../../../app-ui/page-state/diagnostics-dashboard-state.js";

test("diagnostics dashboard state summarizes counts, rows, and recent applies", () => {
  const dashboard = buildDiagnosticsDashboardState({
    state: {
      ui: {
        diagnosticsOpen: true,
        diagnosticsFilter: "warning"
      },
      diagnostics: [
        { level: "warning", text: "Scene graph partial", ts: "2026-03-16T13:00:00.000Z" },
        { level: "info", text: "Connected", ts: "2026-03-16T13:01:00.000Z" }
      ],
      applyHistory: [
        { status: "completed", commandCount: 3, createdAt: "2026-03-16T13:10:00.000Z", summary: "Applied test plan" }
      ],
      health: {
        lastCheckedAt: "2026-03-16T13:20:00.000Z",
        runtimeReady: true,
        desktopFileDialogReady: true,
        desktopBridgeApiCount: 12,
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
});
