import { buildAudioDashboardState } from "./audio-dashboard-state.js";
import { buildDesignDashboardState } from "./design-dashboard-state.js";
import { buildDiagnosticsDashboardState } from "./diagnostics-dashboard-state.js";
import { buildHistoryDashboardState } from "./history-dashboard-state.js";
import { buildMetadataDashboardState } from "./metadata-dashboard-state.js";
import { buildProjectDashboardState } from "./project-dashboard-state.js";
import { buildReviewDashboardState } from "./review-dashboard-state.js";
import { buildSequenceDashboardState } from "./sequence-dashboard-state.js";
import { buildSettingsDashboardState } from "./settings-dashboard-state.js";

export function buildPageStates({
  state = {},
  handoffs = {},
  helpers = {}
} = {}) {
  return {
    audio: buildAudioDashboardState({
      state,
      analysisHandoff: handoffs.analysisHandoff || null,
      basenameOfPath: helpers.basenameOfPath
    }),
    design: buildDesignDashboardState({
      state
    }),
    diagnostics: buildDiagnosticsDashboardState({
      state,
      helpers
    }),
    history: buildHistoryDashboardState({
      state
    }),
    metadata: buildMetadataDashboardState({
      state,
      helpers
    }),
    project: buildProjectDashboardState({
      state
    }),
    review: buildReviewDashboardState({
      state,
      helpers
    }),
    settings: buildSettingsDashboardState({
      state,
      helpers
    }),
    sequence: buildSequenceDashboardState({
      state,
      intentHandoff: handoffs.intentHandoff || null,
      planHandoff: handoffs.planHandoff || null
    })
  };
}
