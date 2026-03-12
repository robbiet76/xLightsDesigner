export const APP_ASSISTANT_ROLE = "app_assistant";
export const APP_ASSISTANT_CONTRACT_VERSION = "1.0";

const ROUTES = new Set([
  "setup_help",
  "audio_analyst",
  "designer_dialog",
  "sequence_agent",
  "general"
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
  if (obj.diagnostics != null && !isPlainObject(obj.diagnostics)) errors.push("diagnostics must be an object when provided");
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
  shouldGenerateProposal = false,
  proposalIntent = "",
  diagnostics = null,
  warnings = []
} = {}) {
  return {
    agentRole: APP_ASSISTANT_ROLE,
    contractVersion: APP_ASSISTANT_CONTRACT_VERSION,
    assistantMessage: str(assistantMessage),
    routeDecision: str(routeDecision || "general"),
    responseId: str(responseId),
    provider: str(provider),
    model: str(model),
    shouldGenerateProposal: Boolean(shouldGenerateProposal),
    proposalIntent: str(proposalIntent),
    diagnostics: isPlainObject(diagnostics) ? diagnostics : undefined,
    warnings: arr(warnings).map((row) => str(row)).filter(Boolean)
  };
}
