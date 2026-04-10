export const APP_ASSISTANT_ROLE = "app_assistant";
export const APP_ASSISTANT_CONTRACT_VERSION = "1.0";
export const TEAM_CHAT_ROLE_IDS = [
  APP_ASSISTANT_ROLE,
  "audio_analyst",
  "designer_dialog",
  "sequence_agent"
];

export const DEFAULT_TEAM_CHAT_IDENTITIES = {
  app_assistant: { roleId: "app_assistant", displayName: "App Assistant", nickname: "Clover" },
  audio_analyst: { roleId: "audio_analyst", displayName: "Audio Analyst", nickname: "Lyric" },
  designer_dialog: { roleId: "designer_dialog", displayName: "Designer", nickname: "Mira" },
  sequence_agent: { roleId: "sequence_agent", displayName: "Sequencer", nickname: "Patch" }
};

const ROUTES = new Set([
  "setup_help",
  "audio_analyst",
  "designer_dialog",
  "sequence_agent",
  "general"
]);

const ACTION_REQUEST_TYPES = new Set([
  "select_workflow",
  "refresh_current_workflow",
  "refresh_all",
  "refresh_xlights_session",
  "open_settings"
]);

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidRoleId(value = "") {
  return TEAM_CHAT_ROLE_IDS.includes(str(value));
}

export function buildTeamChatIdentities(overrides = {}) {
  const out = {};
  for (const roleId of TEAM_CHAT_ROLE_IDS) {
    const base = DEFAULT_TEAM_CHAT_IDENTITIES[roleId];
    const override = isPlainObject(overrides?.[roleId]) ? overrides[roleId] : {};
    const overrideDisplayName = str(override.displayName);
    const overrideNickname = str(override.nickname);
    out[roleId] = {
      roleId,
      displayName: overrideDisplayName || base.displayName,
      nickname: overrideNickname || base.nickname
    };
  }
  return out;
}

export function resolveTeamChatIdentity(roleId = "", identities = {}) {
  const key = isValidRoleId(roleId) ? roleId : APP_ASSISTANT_ROLE;
  return buildTeamChatIdentities(identities)[key];
}

export function validateAppAssistantInput(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};
  if (str(obj.agentRole) !== APP_ASSISTANT_ROLE) errors.push(`agentRole must be ${APP_ASSISTANT_ROLE}`);
  if (str(obj.contractVersion) !== APP_ASSISTANT_CONTRACT_VERSION) errors.push(`contractVersion must be ${APP_ASSISTANT_CONTRACT_VERSION}`);
  if (!str(obj.userMessage)) errors.push("userMessage is required");
  if (!isPlainObject(obj.context)) errors.push("context is required");
  if (!Array.isArray(obj.messages)) errors.push("messages is required");
  return errors;
}

export function validateAppAssistantResult(payload = {}) {
  const errors = [];
  const obj = isPlainObject(payload) ? payload : {};
  if (str(obj.agentRole) !== APP_ASSISTANT_ROLE) errors.push(`agentRole must be ${APP_ASSISTANT_ROLE}`);
  if (str(obj.contractVersion) !== APP_ASSISTANT_CONTRACT_VERSION) errors.push(`contractVersion must be ${APP_ASSISTANT_CONTRACT_VERSION}`);
  if (!str(obj.assistantMessage)) errors.push("assistantMessage is required");
  if (!ROUTES.has(str(obj.routeDecision))) errors.push("routeDecision must be setup_help|audio_analyst|designer_dialog|sequence_agent|general");
  if (obj.handledBy != null && !isValidRoleId(obj.handledBy)) errors.push("handledBy must be app_assistant|audio_analyst|designer_dialog|sequence_agent");
  if (obj.addressedTo != null && !isValidRoleId(obj.addressedTo)) errors.push("addressedTo must be app_assistant|audio_analyst|designer_dialog|sequence_agent");
  if (obj.diagnostics != null && !isPlainObject(obj.diagnostics)) errors.push("diagnostics must be an object when provided");
  if (obj.identities != null && !isPlainObject(obj.identities)) errors.push("identities must be an object when provided");
  if (obj.phaseTransition != null && !isPlainObject(obj.phaseTransition)) errors.push("phaseTransition must be an object when provided");
  if (obj.actionRequest != null && !isPlainObject(obj.actionRequest)) errors.push("actionRequest must be an object when provided");
  if (isPlainObject(obj.actionRequest)) {
    const actionType = str(obj.actionRequest.actionType);
    if (!ACTION_REQUEST_TYPES.has(actionType)) errors.push("actionRequest.actionType must be select_workflow|refresh_current_workflow|refresh_all|refresh_xlights_session|open_settings");
    if (obj.actionRequest.payload != null && !isPlainObject(obj.actionRequest.payload)) errors.push("actionRequest.payload must be an object when provided");
  }
  return errors;
}

export function buildAppAssistantInput({
  userMessage = "",
  messages = [],
  previousResponseId = "",
  context = {}
} = {}) {
  return {
    agentRole: APP_ASSISTANT_ROLE,
    contractVersion: APP_ASSISTANT_CONTRACT_VERSION,
    userMessage: str(userMessage),
    messages: arr(messages).map((row) => ({
      role: str(row?.role || row?.who),
      content: str(row?.content || row?.text)
    })).filter((row) => row.role && row.content),
    previousResponseId: str(previousResponseId),
    context: isPlainObject(context) ? context : {}
  };
}

export function buildAppAssistantResult({
  assistantMessage = "",
  routeDecision = "general",
  responseId = "",
  provider = "",
  model = "",
  handledBy = APP_ASSISTANT_ROLE,
  addressedTo = "",
  identities = {},
  shouldGenerateProposal = false,
  proposalIntent = "",
  diagnostics = null,
  warnings = [],
  displayDiscovery = null,
  projectMission = null,
  phaseTransition = null,
  actionRequest = null,
  userPreferenceNotes = []
} = {}) {
  return {
    agentRole: APP_ASSISTANT_ROLE,
    contractVersion: APP_ASSISTANT_CONTRACT_VERSION,
    assistantMessage: str(assistantMessage),
    routeDecision: str(routeDecision || "general"),
    responseId: str(responseId),
    provider: str(provider),
    model: str(model),
    handledBy: isValidRoleId(handledBy) ? handledBy : APP_ASSISTANT_ROLE,
    addressedTo: isValidRoleId(addressedTo) ? addressedTo : undefined,
    identities: buildTeamChatIdentities(identities),
    shouldGenerateProposal: Boolean(shouldGenerateProposal),
    proposalIntent: str(proposalIntent),
    displayDiscovery: isPlainObject(displayDiscovery) ? displayDiscovery : undefined,
    projectMission: isPlainObject(projectMission) ? projectMission : undefined,
    phaseTransition: isPlainObject(phaseTransition) ? phaseTransition : undefined,
    actionRequest: isPlainObject(actionRequest) ? actionRequest : undefined,
    userPreferenceNotes: arr(userPreferenceNotes).map((row) => str(row)).filter(Boolean),
    diagnostics: isPlainObject(diagnostics) ? diagnostics : undefined,
    warnings: arr(warnings).map((row) => str(row)).filter(Boolean)
  };
}
