import {
  APP_ASSISTANT_ROLE,
  DEFAULT_TEAM_CHAT_IDENTITIES,
  buildAppAssistantInput,
  buildAppAssistantResult,
  validateAppAssistantInput
} from "./app-assistant-contracts.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function inferAddressedRole({ userMessage = "", context = {} } = {}) {
  const text = str(userMessage).toLowerCase();
  const identities = context?.teamChat?.identities || context?.teamIdentities || DEFAULT_TEAM_CHAT_IDENTITIES;
  const candidates = [];
  for (const [roleId, row] of Object.entries(identities || {})) {
    const displayName = str(row?.displayName).toLowerCase();
    const nickname = str(row?.nickname).toLowerCase();
    if (displayName) candidates.push({ roleId, token: displayName });
    if (nickname) candidates.push({ roleId, token: nickname });
  }
  for (const candidate of candidates) {
    const token = candidate.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|\\b)(hey\\s+)?${token}(\\b|[,:])`, "i").test(text)) {
      return candidate.roleId;
    }
  }
  return "";
}

function inferRouteDecision({ userMessage = "", context = {}, response = {} } = {}) {
  const userText = str(userMessage).toLowerCase();
  const assistantText = str(response.assistantMessage).toLowerCase();
  const addressedRole = inferAddressedRole({ userMessage, context });
  const currentRoute = str(context?.route);
  const directSequencingRequest =
    (
      /\b(add|put|place|apply|set|make|use)\b/.test(userText) &&
      /\b(on|to|during|from|for)\b/.test(userText) &&
      (
        /\beffect\b/.test(userText) ||
        /\bcolor wash\b/.test(userText) ||
        /\bshimmer\b/.test(userText) ||
        /\bon\b/.test(userText)
      )
    ) ||
    (
      /\b(during|from|for)\b/.test(userText) &&
      /\b(chorus|verse|intro|bridge|outro|section)\b/.test(userText) &&
      (
        /\bcolor wash\b/.test(userText) ||
        /\beffect\b/.test(userText)
      )
    );
  if (/(show folder|project root|media path|open project|save project|project setup|metadata)/.test(userText)) {
    return "setup_help";
  }
  if (/(analyz|analysis|tempo|beats|bars|lyrics|chords|re-analy|reanaly)/.test(userText)) {
    return "audio_analyst";
  }
  if (directSequencingRequest) {
    return "sequence_agent";
  }
  if (/(apply|generate plan|regenerate|refresh proposal|rebase draft|timing track|xlights apply)/.test(userText)) {
    return "sequence_agent";
  }
  if (
    /(feel|mood|nostalg|cinematic|punchy|smooth|warm|cool|design|chorus|verse|bridge|look|story|inspiration)/.test(userText) ||
    currentRoute === "design"
  ) {
    if (addressedRole === "sequence_agent" && /(change|less|more|reduce|increase|make|adjust|revise|rework|chorus|verse|bridge)/.test(userText)) {
      return "sequence_agent";
    }
    return "designer_dialog";
  }
  if (/(sequence|sequenc|timing track|xlights apply|apply)/.test(userText)) {
    return "sequence_agent";
  }
  if (/(show folder|project root|media path|open project|save project|project setup|metadata)/.test(assistantText)) {
    return "setup_help";
  }
  if (/(analyz|analysis|tempo|beats|bars|lyrics|chords|re-analy|reanaly)/.test(assistantText)) {
    return "audio_analyst";
  }
  if (/(feel|mood|nostalg|cinematic|punchy|smooth|warm|cool|design|chorus|verse|bridge|look|story|inspiration)/.test(assistantText)) {
    return "designer_dialog";
  }
  if (/(apply|generate plan|regenerate|refresh proposal|rebase draft|sequence|timing track|xlights apply)/.test(assistantText)) {
    return "sequence_agent";
  }
  if (currentRoute === "project") {
    return addressedRole || "setup_help";
  }
  if (currentRoute === "audio") {
    return addressedRole && addressedRole !== "designer_dialog" ? addressedRole : "audio_analyst";
  }
  if (currentRoute === "review") {
    return addressedRole && addressedRole !== "audio_analyst" ? addressedRole : "sequence_agent";
  }
  if (currentRoute === "sequence") {
    return addressedRole || "sequence_agent";
  }
  if (addressedRole === "audio_analyst" || addressedRole === "designer_dialog" || addressedRole === "sequence_agent") {
    return addressedRole;
  }
  return "general";
}

function buildDiagnostics({ routeDecision = "general", bridgeOk = false, responseCode = "", context = {}, addressedTo = "" } = {}) {
  return {
    artifactType: "app_assistant_diagnostics_v1",
    role: APP_ASSISTANT_ROLE,
    routeDecision,
    addressedTo: str(addressedTo),
    bridgeOk: Boolean(bridgeOk),
    responseCode: str(responseCode),
    sequenceOpen: Boolean(context?.sequenceOpen),
    planOnlyMode: Boolean(context?.planOnlyMode),
    generatedAt: new Date().toISOString()
  };
}

export async function executeAppAssistantConversation({
  userMessage = "",
  messages = [],
  previousResponseId = "",
  context = {},
  bridge = null
} = {}) {
  const input = buildAppAssistantInput({
    userMessage,
    messages,
    previousResponseId,
    context
  });
  const addressedTo = inferAddressedRole({ userMessage: input.userMessage, context: input.context });
  const inputErrors = validateAppAssistantInput(input);
  if (inputErrors.length) {
    return {
      ok: false,
      result: buildAppAssistantResult({
        assistantMessage: "App assistant input is incomplete.",
        routeDecision: "general",
        handledBy: APP_ASSISTANT_ROLE,
        addressedTo,
        identities: input.context?.teamChat?.identities || input.context?.teamIdentities || DEFAULT_TEAM_CHAT_IDENTITIES,
        diagnostics: buildDiagnostics({ routeDecision: "general", bridgeOk: false, responseCode: "INPUT_INVALID", context, addressedTo }),
        warnings: inputErrors
      }),
      error: inputErrors.join("; ")
    };
  }
  if (!bridge || typeof bridge.runAgentConversation !== "function") {
    return {
      ok: false,
      result: buildAppAssistantResult({
        assistantMessage: "Cloud agent is available only in desktop runtime.",
        routeDecision: "general",
        handledBy: APP_ASSISTANT_ROLE,
        addressedTo,
        identities: input.context?.teamChat?.identities || input.context?.teamIdentities || DEFAULT_TEAM_CHAT_IDENTITIES,
        diagnostics: buildDiagnostics({ routeDecision: "general", bridgeOk: false, responseCode: "DESKTOP_REQUIRED", context, addressedTo }),
        warnings: ["Desktop runtime required for app assistant conversation."]
      }),
      error: "Desktop runtime required"
    };
  }

  const response = await bridge.runAgentConversation({
    userMessage: input.userMessage,
    messages: input.messages,
    previousResponseId: input.previousResponseId,
    context: input.context
  });

  if (!response?.ok) {
    const routeDecision = inferRouteDecision({ userMessage, context, response: {} });
    return {
      ok: false,
      result: buildAppAssistantResult({
        assistantMessage: `Agent unavailable: ${str(response?.error || "Cloud agent request failed.")}`,
        routeDecision,
        handledBy: APP_ASSISTANT_ROLE,
        addressedTo,
        identities: input.context?.teamChat?.identities || input.context?.teamIdentities || DEFAULT_TEAM_CHAT_IDENTITIES,
        diagnostics: buildDiagnostics({
          routeDecision,
          bridgeOk: true,
          responseCode: str(response?.code || "AGENT_ERROR"),
          context,
          addressedTo
        }),
        warnings: [str(response?.error || "Cloud agent request failed.")]
      }),
      error: str(response?.error || "Cloud agent request failed.")
    };
  }

  const routeDecision = inferRouteDecision({ userMessage, context, response });
  const allowProposalGeneration =
    (routeDecision === "designer_dialog" || routeDecision === "sequence_agent") &&
    (Boolean(context?.sequenceOpen) || Boolean(context?.planOnlyMode));
  return {
    ok: true,
    result: buildAppAssistantResult({
      assistantMessage: str(response.assistantMessage || ""),
      routeDecision,
      responseId: str(response.responseId || ""),
      provider: str(response.provider || ""),
      model: str(response.model || ""),
      handledBy: routeDecision === "general" || routeDecision === "setup_help" ? APP_ASSISTANT_ROLE : routeDecision,
      addressedTo,
      identities: input.context?.teamChat?.identities || input.context?.teamIdentities || DEFAULT_TEAM_CHAT_IDENTITIES,
      shouldGenerateProposal: allowProposalGeneration && Boolean(response.shouldGenerateProposal),
      proposalIntent: str(response.proposalIntent || userMessage),
      diagnostics: buildDiagnostics({
        routeDecision,
        bridgeOk: true,
        responseCode: "OK",
        context,
        addressedTo
      }),
      warnings: []
    })
  };
}
