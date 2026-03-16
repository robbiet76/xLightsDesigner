function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

export function buildSettingsDashboardState({
  state = {},
  helpers = {}
} = {}) {
  const {
    getAgentApplyRolloutMode = () => "full",
    getManualLockedXdTracks = () => [],
    getTeamChatIdentities = () => ({})
  } = helpers;
  const rolloutMode = getAgentApplyRolloutMode();
  const manualXdLocks = getManualLockedXdTracks();
  const teamChatIdentities = getTeamChatIdentities();
  const planOnlyToggleForced = Boolean(state.flags?.planOnlyForcedByConnectivity || state.flags?.planOnlyForcedByRollout);
  const planOnlyToggleTitle = state.flags?.planOnlyForcedByConnectivity
    ? "Forced while xLights is unavailable"
    : state.flags?.planOnlyForcedByRollout
      ? "Forced by rollout policy"
      : "";

  return {
    contract: "settings_dashboard_state_v1",
    version: "1.0",
    page: "settings",
    title: "Settings",
    summary: "Application configuration, cloud settings, safety controls, and operator toggles.",
    status: "active",
    readiness: {
      ok: true,
      level: "ready",
      reasons: []
    },
    warnings: [],
    validationIssues: [],
    refs: {},
    data: {
      rolloutMode,
      manualXdLocks: manualXdLocks.map((row) => ({
        sourceTrack: str(row?.sourceTrack)
      })),
      manualXdLockText: manualXdLocks.length
        ? manualXdLocks.map((row) => str(row?.sourceTrack)).filter(Boolean).join(", ")
        : "none",
      planOnlyToggleForced,
      planOnlyToggleTitle,
      teamChatIdentities: {
        app_assistant: str(teamChatIdentities.app_assistant?.nickname),
        audio_analyst: str(teamChatIdentities.audio_analyst?.nickname),
        designer_dialog: str(teamChatIdentities.designer_dialog?.nickname),
        sequence_agent: str(teamChatIdentities.sequence_agent?.nickname)
      },
      health: {
        agentConfigSource: str(state.health?.agentConfigSource || "none"),
        agentHasStoredApiKey: Boolean(state.health?.agentHasStoredApiKey),
        agentConfigured: Boolean(state.health?.agentConfigured),
        runtimeReady: Boolean(state.health?.runtimeReady),
        desktopFileDialogReady: Boolean(state.health?.desktopFileDialogReady),
        agentProvider: str(state.health?.agentProvider || "openai"),
        agentModel: str(state.health?.agentModel || "(default env model)")
      }
    }
  };
}
