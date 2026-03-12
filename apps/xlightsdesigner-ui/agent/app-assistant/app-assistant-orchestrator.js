import {
  APP_ASSISTANT_ROLE,
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

function inferRouteDecision({ userMessage = "", context = {}, response = {} } = {}) {
  const text = `${str(userMessage)} ${str(response.assistantMessage)}`.toLowerCase();
  if (/(show folder|project root|media path|open project|save project|project setup|metadata)/.test(text)) {
    return "setup_help";
  }
  if (/(analyz|analysis|tempo|beats|bars|lyrics|chords|re-analy|reanaly)/.test(text)) {
    return "audio_analyst";
  }
  if (/(apply|generate plan|regenerate|refresh proposal|rebase draft|sequence|timing track|xlights apply)/.test(text)) {
    return "sequence_agent";
  }
  if (
    /(feel|mood|nostalg|cinematic|punchy|smooth|warm|cool|design|chorus|verse|bridge|look|story|inspiration)/.test(text) ||
    context?.route === "design"
  ) {
    return "designer_dialog";
  }
  return "general";
}

function buildDiagnostics({ routeDecision = "general", bridgeOk = false, responseCode = "", context = {} } = {}) {
  return {
    artifactType: "app_assistant_diagnostics_v1",
    role: APP_ASSISTANT_ROLE,
    routeDecision,
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
  const inputErrors = validateAppAssistantInput(input);
  if (inputErrors.length) {
    return {
      ok: false,
      result: buildAppAssistantResult({
        assistantMessage: "App assistant input is incomplete.",
        routeDecision: "general",
        diagnostics: buildDiagnostics({ routeDecision: "general", bridgeOk: false, responseCode: "INPUT_INVALID", context }),
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
        diagnostics: buildDiagnostics({ routeDecision: "general", bridgeOk: false, responseCode: "DESKTOP_REQUIRED", context }),
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
        diagnostics: buildDiagnostics({
          routeDecision,
          bridgeOk: true,
          responseCode: str(response?.code || "AGENT_ERROR"),
          context
        }),
        warnings: [str(response?.error || "Cloud agent request failed.")]
      }),
      error: str(response?.error || "Cloud agent request failed.")
    };
  }

  const routeDecision = inferRouteDecision({ userMessage, context, response });
  const allowDesignerProposal = routeDecision === "designer_dialog" && (Boolean(context?.sequenceOpen) || Boolean(context?.planOnlyMode));
  return {
    ok: true,
    result: buildAppAssistantResult({
      assistantMessage: str(response.assistantMessage || ""),
      routeDecision,
      responseId: str(response.responseId || ""),
      provider: str(response.provider || ""),
      model: str(response.model || ""),
      shouldGenerateProposal: allowDesignerProposal && Boolean(response.shouldGenerateProposal),
      proposalIntent: str(response.proposalIntent || userMessage),
      diagnostics: buildDiagnostics({
        routeDecision,
        bridgeOk: true,
        responseCode: "OK",
        context
      }),
      warnings: []
    })
  };
}
