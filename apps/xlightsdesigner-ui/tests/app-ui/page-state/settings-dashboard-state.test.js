import test from "node:test";
import assert from "node:assert/strict";

import { buildSettingsDashboardState } from "../../../app-ui/page-state/settings-dashboard-state.js";

test("settings dashboard state summarizes rollout, locks, and nicknames", () => {
  const dashboard = buildSettingsDashboardState({
    state: {
      flags: {
        planOnlyForcedByRollout: true
      },
      health: {
        agentConfigSource: "desktop-store",
        agentHasStoredApiKey: true,
        agentConfigured: true,
        runtimeReady: true,
        desktopFileDialogReady: true,
        agentProvider: "openai",
        agentModel: "gpt-5"
      }
    },
    helpers: {
      getAgentApplyRolloutMode: () => "plan-only",
      getManualLockedXdTracks: () => [{ sourceTrack: "XD: Song Structure" }],
      getTeamChatIdentities: () => ({
        app_assistant: { nickname: "Clover" },
        audio_analyst: { nickname: "Lyric" },
        designer_dialog: { nickname: "Mira" },
        sequence_agent: { nickname: "Patch" }
      })
    }
  });

  assert.equal(dashboard.page, "settings");
  assert.equal(dashboard.data.rolloutMode, "plan-only");
  assert.equal(dashboard.data.manualXdLockText, "XD: Song Structure");
  assert.equal(dashboard.data.teamChatIdentities.designer_dialog, "Mira");
});
