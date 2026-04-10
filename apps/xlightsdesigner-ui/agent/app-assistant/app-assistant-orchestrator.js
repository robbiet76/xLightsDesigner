import {
  APP_ASSISTANT_ROLE,
  DEFAULT_TEAM_CHAT_IDENTITIES,
  buildAppAssistantInput,
  buildAppAssistantResult,
  validateAppAssistantInput
} from "./app-assistant-contracts.js";
import {
  hasMeaningfulDisplayMetadata,
  shouldContinueDisplayDiscovery,
  shouldStartDisplayDiscovery
} from "../designer-dialog/display-discovery.js";

function str(value = "") {
  return String(value || "").trim();
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function currentWorkflowPhase(context = {}) {
  const phase = context?.workflowPhase;
  if (!phase || typeof phase !== "object") {
    return {
      phaseId: "",
      ownerRole: "",
      status: "",
      entryReason: "",
      nextRecommendedPhases: []
    };
  }
  return {
    phaseId: str(phase.phaseId).toLowerCase(),
    ownerRole: str(phase.ownerRole),
    status: str(phase.status).toLowerCase(),
    entryReason: str(phase.entryReason),
    nextRecommendedPhases: arr(phase.nextRecommendedPhases).map((value) => str(value).toLowerCase()).filter(Boolean)
  };
}

function isExplicitPhaseSwitchIntent(text = "") {
  const lower = str(text).toLowerCase();
  if (!lower) return false;
  const verbs = /\b(switch|move|go|jump|continue|start|begin|head|transition)\b/;
  const phases = /\b(setup|project mission|mission|audio|audio analysis|display|display discovery|design|sequencing|sequence|review)\b/;
  return verbs.test(lower) && phases.test(lower);
}

function isDirectSequencingRequest(text = "") {
  const userText = str(text).toLowerCase();
  return (
    (
      /\b(add|put|place|apply|set|make|use|turn|bring|drop|reduce|increase|raise|lower|dim|brighten|adjust)\b/.test(userText) &&
      /\b(on|to|during|from|for)\b/.test(userText) &&
      (
        /\beffect\b/.test(userText) ||
        /\bcolor wash\b/.test(userText) ||
        /\bshimmer\b/.test(userText) ||
        /\bon\b/.test(userText) ||
        /\bbrightness\b/.test(userText) ||
        /\bintensity\b/.test(userText) ||
        /\blevel\b/.test(userText)
      )
    ) ||
    (
      /\b(during|from|for)\b/.test(userText) &&
      /\b(chorus|verse|intro|bridge|outro|section)\b/.test(userText) &&
      (
        /\bcolor wash\b/.test(userText) ||
        /\beffect\b/.test(userText) ||
        /\bbrightness\b/.test(userText) ||
        /\bintensity\b/.test(userText) ||
        /\blevel\b/.test(userText)
      )
    )
  );
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

function inferRouteDecisionWithoutPhase({ userMessage = "", context = {}, response = {} } = {}) {
  const userText = str(userMessage).toLowerCase();
  const assistantText = str(response.assistantMessage).toLowerCase();
  const addressedRole = inferAddressedRole({ userMessage, context });
  const currentRoute = str(context?.route);
  const displayDiscoveryActive =
    shouldStartDisplayDiscovery({ context, userMessage }) ||
    shouldContinueDisplayDiscovery({ context }) ||
    currentRoute === "display";
  const displayMetadataIntent =
    /(display|layout|metadata|tag|tags|models|props)/.test(userText) ||
    (
      displayDiscoveryActive &&
      /\b(apply|update|set|make|mark|treat|label|classify|use)\b/.test(userText)
    );
  const directSequencingRequest = isDirectSequencingRequest(userText);
  const explicitWorkflowSwitch =
    /\b(sequence|sequencing|sequence planning|move to sequencing|sequencer|patch)\b/.test(userText) ||
    /\b(audio analysis|analyze audio|audio analyst)\b/.test(userText) ||
    /\b(project setup|show folder|open project|save project)\b/.test(userText);

  const projectMissionIntent =
    /\b(mission|vision|goals|goal|inspiration|theme|themes|cohesive|cohesion|overall feel|overall direction|what kind of show|what should it feel like)\b/.test(userText);

  if (addressedRole) {
    return addressedRole === APP_ASSISTANT_ROLE ? "general" : addressedRole;
  }

  if (displayDiscoveryActive && !explicitWorkflowSwitch) {
    return "designer_dialog";
  }

  if (currentRoute === "project" && projectMissionIntent) {
    return "designer_dialog";
  }

  const addressedAudioQuestion =
    addressedRole === "audio_analyst" &&
    (
      /(main sections|section|first real lift|first lift|beats|bars|tempo|lyrics|chords|analysis|analyz)/.test(userText) ||
      (/\b(where does|tell me where|what parts)\b/.test(userText) && /\b(chorus|verse|bridge|intro|outro|lift|hold back|open up)\b/.test(userText))
    );
  if (displayMetadataIntent) {
    return "designer_dialog";
  }
  if (/(show folder|project root|media path|open project|save project|project setup)/.test(userText)) {
    return "setup_help";
  }
  if (addressedAudioQuestion) {
    return "audio_analyst";
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
  if (
    /(display|layout|metadata|tag|tags|models|props)/.test(assistantText) ||
    (displayDiscoveryActive && /(focal|support|repeating|family|group|model)/.test(assistantText))
  ) {
    return "designer_dialog";
  }
  if (/(show folder|project root|media path|open project|save project|project setup)/.test(assistantText)) {
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

function inferRouteDecision({ userMessage = "", context = {}, response = {} } = {}) {
  const addressedRole = inferAddressedRole({ userMessage, context });
  const phase = currentWorkflowPhase(context);
  const userText = str(userMessage).toLowerCase();

  if (addressedRole === APP_ASSISTANT_ROLE) {
    return "general";
  }

  if (phase.phaseId) {
    if (phase.status === "handoff_pending") {
      if (isDirectSequencingRequest(userText)) {
        return "sequence_agent";
      }
      if (addressedRole === APP_ASSISTANT_ROLE || !addressedRole || isExplicitPhaseSwitchIntent(userText)) {
        return "general";
      }
      return "general";
    }

    if (isExplicitPhaseSwitchIntent(userText)) {
      return "general";
    }

    if (isDirectSequencingRequest(userText)) {
      return "sequence_agent";
    }

    if (phase.phaseId === "setup") {
      return "setup_help";
    }

    if (addressedRole && addressedRole === phase.ownerRole) {
      return addressedRole;
    }

    if (addressedRole && addressedRole !== phase.ownerRole) {
      return "general";
    }

    if (phase.ownerRole === "designer_dialog" || phase.ownerRole === "audio_analyst" || phase.ownerRole === "sequence_agent") {
      return phase.ownerRole;
    }
  }

  return inferRouteDecisionWithoutPhase({ userMessage, context, response });
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

function phaseTitle(phaseId = "") {
  switch (str(phaseId).toLowerCase()) {
  case "setup":
    return "Setup";
  case "project_mission":
    return "Project Mission";
  case "audio_analysis":
    return "Audio Analysis";
  case "display_discovery":
    return "Display Discovery";
  case "design":
    return "Design";
  case "sequencing":
    return "Sequencing";
  case "review":
    return "Review";
  default:
    return "the next phase";
  }
}

function roleLabel(roleId = "") {
  switch (str(roleId)) {
  case "app_assistant":
    return "App Assistant";
  case "designer_dialog":
    return "Designer";
  case "audio_analyst":
    return "Audio Analyst";
  case "sequence_agent":
    return "Sequencer";
  default:
    return "Team";
  }
}

function transitionOwnerRole(phaseId = "") {
  switch (str(phaseId).toLowerCase()) {
  case "setup":
    return "app_assistant";
  case "project_mission":
  case "display_discovery":
  case "design":
    return "designer_dialog";
  case "audio_analysis":
    return "audio_analyst";
  case "sequencing":
  case "review":
    return "sequence_agent";
  default:
    return "app_assistant";
  }
}

function buildPhaseTransitionMessage(phaseTransition = {}) {
  const phaseId = str(phaseTransition?.phaseId);
  if (!phaseId) return "";
  const title = phaseTitle(phaseId);
  const owner = roleLabel(transitionOwnerRole(phaseId));
  const reason = str(phaseTransition?.reason);
  if (reason) {
    return `We can move into ${title} next. ${owner} will take the lead there. ${reason}`;
  }
  return `We can move into ${title} next. ${owner} will take the lead there.`;
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
  const normalizedPhaseTransition = response?.phaseTransition && typeof response.phaseTransition === "object"
    ? {
        phaseId: str(response.phaseTransition.phaseId || ""),
        reason: str(response.phaseTransition.reason || "")
      }
    : null;
  const discoveryShouldStart = shouldStartDisplayDiscovery({ context, userMessage });
  const discoveryShouldContinue = shouldContinueDisplayDiscovery({ context });
  const discoveryActive =
    routeDecision === "designer_dialog" &&
    !hasMeaningfulDisplayMetadata(context) &&
    (discoveryShouldStart || discoveryShouldContinue);
  const allowProposalGeneration =
    (routeDecision === "designer_dialog" || routeDecision === "sequence_agent") &&
    (Boolean(context?.sequenceOpen) || Boolean(context?.planOnlyMode));
  const explicitSwitch = isExplicitPhaseSwitchIntent(userMessage);
  const shouldUseAppAssistantTransitionMessage =
    explicitSwitch &&
    normalizedPhaseTransition?.phaseId &&
    routeDecision === "general";

  return {
    ok: true,
    result: buildAppAssistantResult({
      assistantMessage: shouldUseAppAssistantTransitionMessage
        ? buildPhaseTransitionMessage(normalizedPhaseTransition)
        : str(response.assistantMessage || ""),
      routeDecision,
      responseId: str(response.responseId || ""),
      provider: str(response.provider || ""),
      model: str(response.model || ""),
      handledBy: routeDecision === "general" || routeDecision === "setup_help" ? APP_ASSISTANT_ROLE : routeDecision,
      addressedTo,
      identities: input.context?.teamChat?.identities || input.context?.teamIdentities || DEFAULT_TEAM_CHAT_IDENTITIES,
      shouldGenerateProposal: allowProposalGeneration && Boolean(response.shouldGenerateProposal),
      proposalIntent: str(response.proposalIntent || userMessage),
      displayDiscovery: discoveryActive
        ? {
            status: str(response?.displayDiscoveryCapture?.status || "in_progress"),
            scope: "groups_models_v1",
            shouldCaptureTurn: true,
            insights: Array.isArray(response?.displayDiscoveryCapture?.insights)
              ? response.displayDiscoveryCapture.insights
              : [],
            unresolvedBranches: Array.isArray(response?.displayDiscoveryCapture?.unresolvedBranches)
              ? response.displayDiscoveryCapture.unresolvedBranches
              : [],
            resolvedBranches: Array.isArray(response?.displayDiscoveryCapture?.resolvedBranches)
              ? response.displayDiscoveryCapture.resolvedBranches
              : [],
            tagProposals: Array.isArray(response?.displayDiscoveryCapture?.tagProposals)
              ? response.displayDiscoveryCapture.tagProposals
              : [],
            candidateProps: Array.isArray(context?.display?.displayDiscoveryCandidates)
              ? context.display.displayDiscoveryCandidates
              : []
          }
        : undefined,
      projectMission: response?.projectMission && typeof response.projectMission === "object"
        ? {
            document: str(response.projectMission.document || "")
          }
        : undefined,
      phaseTransition: normalizedPhaseTransition?.phaseId ? normalizedPhaseTransition : undefined,
      userPreferenceNotes: Array.isArray(response.userPreferenceNotes) ? response.userPreferenceNotes : [],
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
