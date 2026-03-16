import { buildAudioDashboardState } from "./audio-dashboard-state.js";
import { buildDesignDashboardState } from "./design-dashboard-state.js";
import { buildReviewDashboardState } from "./review-dashboard-state.js";
import { buildSequenceDashboardState } from "./sequence-dashboard-state.js";

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
    review: buildReviewDashboardState({
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
