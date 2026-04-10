import Foundation
import Observation

@MainActor
@Observable
final class AssistantWindowViewModel {
    private weak var workspace: ProjectWorkspace?
    private let conversationService: AssistantConversationService
    private let executionService: AssistantExecutionService
    private let displayDiscoveryStore: DisplayDiscoveryStateStore
    private let userProfileStore: AssistantUserProfileStore
    private let projectService: ProjectService

    var messages: [AssistantMessageModel] = []
    var draft = ""
    var isSending = false
    var previousResponseID = ""
    var rollingConversationSummary = ""
    var lastDiagnostics: AssistantDiagnosticsResult?
    var lastActionRequest: AssistantActionRequestResult?

    init(
        conversationService: AssistantConversationService = LocalAssistantConversationService(),
        executionService: AssistantExecutionService = LocalAssistantExecutionService(),
        displayDiscoveryStore: DisplayDiscoveryStateStore = LocalDisplayDiscoveryStateStore(),
        userProfileStore: AssistantUserProfileStore = LocalAssistantUserProfileStore(),
        projectService: ProjectService = LocalProjectService(),
        workspace: ProjectWorkspace? = nil
    ) {
        self.workspace = workspace
        self.conversationService = conversationService
        self.executionService = executionService
        self.displayDiscoveryStore = displayDiscoveryStore
        self.userProfileStore = userProfileStore
        self.projectService = projectService
    }

    func loadConversationIfNeeded(context: AssistantContextModel, project: ActiveProjectModel?) {
        guard messages.isEmpty else { return }
        do {
            let state = try conversationService.loadConversationState()
            rollingConversationSummary = state.rollingSummary
            let loaded = state.messages
            if loaded.isEmpty {
                messages = [seedAssistantMessage(context: context)]
                try? persistConversation()
            } else {
                messages = loaded.map { message in
                    guard message.role == .assistant else { return message }
                    return AssistantMessageModel(
                        id: message.id,
                        role: message.role,
                        text: message.text,
                        timestamp: message.timestamp,
                        handledBy: message.handledBy,
                        routeDecision: message.routeDecision,
                        displayName: message.displayName ?? displayName(for: message.handledBy ?? "app_assistant", context: context)
                    )
                }
                try? persistConversation()
            }
        } catch {
            messages = [AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: "Assistant history could not be loaded. A new conversation has started.",
                timestamp: isoNow(),
                handledBy: "app_assistant",
                routeDecision: "general",
                displayName: displayName(for: "app_assistant", context: context)
            )]
        }
    }

    func sendDraft(
        context: AssistantContextModel,
        project: ActiveProjectModel?,
        onPhaseTransition: ((AssistantPhaseTransitionResult) -> Void)? = nil,
        onActionRequest: ((AssistantActionRequestResult) -> Void)? = nil,
        onPhaseStarted: (() -> Void)? = nil
    ) async {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }

        let userMessage = AssistantMessageModel(
            id: UUID().uuidString,
            role: .user,
            text: trimmed,
            timestamp: isoNow(),
            handledBy: nil,
            routeDecision: nil,
            displayName: nil
        )
        messages.append(userMessage)
        draft = ""
        isSending = true
        try? persistConversation()

        do {
            let result = try await executionService.sendConversation(
                userMessage: trimmed,
                messages: messages,
                previousResponseID: previousResponseID,
                context: context
            )
            lastDiagnostics = result.diagnostics
            lastActionRequest = result.actionRequest
            previousResponseID = result.responseID
            let introRole = result.handledBy
            if shouldIntroduce(roleID: introRole, context: context, userMessage: trimmed) {
                messages.append(roleIntroductionMessage(for: introRole, context: context))
            }
            messages.append(AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: result.assistantMessage,
                timestamp: isoNow(),
                handledBy: result.handledBy,
                routeDecision: result.routeDecision,
                displayName: displayName(for: result.handledBy, context: context)
            ))
            if context.workflowPhaseStatus == WorkflowPhaseStatus.notStarted.rawValue &&
                result.handledBy == context.workflowPhaseOwnerRole {
                onPhaseStarted?()
            }
            if !result.userPreferenceNotes.isEmpty {
                try? userProfileStore.addPreferenceNotes(result.userPreferenceNotes, recordedAt: isoNow())
            }
            if let mission = result.projectMission {
                try? saveProjectMission(mission, project: project)
            }
            if let transition = result.phaseTransition {
                onPhaseTransition?(transition)
            }
            if let actionRequest = result.actionRequest {
                onActionRequest?(actionRequest)
            }
            if
                let project,
                let assistantMessage = messages.last,
                let capture = displayDiscoveryCapturePayload(result: result, context: context)
            {
                try? displayDiscoveryStore.recordConversationTurn(
                    project: project,
                    status: capture.status,
                    scope: capture.scope,
                    candidateProps: capture.candidateProps,
                    insights: capture.insights,
                    unresolvedBranches: capture.unresolvedBranches,
                    resolvedBranches: capture.resolvedBranches,
                    tagProposals: capture.tagProposals,
                    userMessage: userMessage,
                    assistantMessage: assistantMessage
                )
                NotificationCenter.default.post(name: .displayDiscoveryDidChange, object: nil)
            }
        } catch {
            lastDiagnostics = nil
            lastActionRequest = nil
            messages.append(AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: "Assistant unavailable: \(String(error.localizedDescription))",
                timestamp: isoNow(),
                handledBy: "app_assistant",
                routeDecision: "app_assistant",
                displayName: displayName(for: "app_assistant", context: context)
            ))
        }

        isSending = false
        try? persistConversation()
    }

    func clearConversation(context: AssistantContextModel) {
        messages = [seedAssistantMessage(context: context)]
        draft = ""
        previousResponseID = ""
        isSending = false
        rollingConversationSummary = ""
        lastDiagnostics = nil
        lastActionRequest = nil
        try? persistConversation()
    }

    func resetMemory(project: ActiveProjectModel?, contextProvider: () -> AssistantContextModel) {
        try? conversationService.clearConversationState()
        try? userProfileStore.clear()
        try? displayDiscoveryStore.clear(for: project)
        clearConversation(context: contextProvider())
    }

    private func persistConversation() throws {
        let state = AssistantConversationState(
            rollingSummary: rollingConversationSummary,
            messages: messages
        )
        try conversationService.saveConversationState(state)
        let normalized = try conversationService.loadConversationState()
        rollingConversationSummary = normalized.rollingSummary
        messages = normalized.messages
    }

    private func seedAssistantMessage(context: AssistantContextModel) -> AssistantMessageModel {
        if shouldKickOffProjectMission(context: context) {
            let observation = "We can start at the show level and shape what this project is meant to feel like before we get into display details or sequencing."
            return AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: "Welcome. \(introductionPrompt(for: "designer_dialog", context: context)) \(observation)",
                timestamp: isoNow(),
                handledBy: "designer_dialog",
                routeDecision: "designer_dialog",
                displayName: displayName(for: "designer_dialog", context: context)
            )
        }
        if shouldKickOffDisplayDiscovery(context: context) {
            let observation = "I can already see your layout, and I’m starting with a broad review of the display structure so we can build useful metadata through conversation."
            return AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: "Welcome. \(introductionPrompt(for: "designer_dialog", context: context)) \(observation) We can begin at a high level and narrow down naturally from there.",
                timestamp: isoNow(),
                handledBy: "designer_dialog",
                routeDecision: "designer_dialog",
                displayName: displayName(for: "designer_dialog", context: context)
            )
        }

        return AssistantMessageModel(
            id: UUID().uuidString,
            role: .assistant,
                text: "Welcome. \(introductionPrompt(for: "app_assistant", context: context)) I guide the overall workflow and bring in the right specialist as needed: Designer for display and creative direction, Audio Analyst for track structure, and Sequencer for technical sequence work. Start anywhere.",
                timestamp: isoNow(),
                handledBy: "app_assistant",
                routeDecision: "general",
                displayName: displayName(for: "app_assistant", context: context)
        )
    }

    private func shouldKickOffDisplayDiscovery(context: AssistantContextModel) -> Bool {
        context.displayTargetCount > 0 &&
        context.displayLabeledTargetCount == 0 &&
        context.displayDiscoveryTranscriptCount == 0 &&
        context.displayDiscoveryStatus.caseInsensitiveCompare("not_started") == .orderedSame
    }

    private func shouldKickOffProjectMission(context: AssistantContextModel) -> Bool {
        context.route.caseInsensitiveCompare("project") == .orderedSame &&
        !context.activeProjectName.isEmpty &&
        context.projectMissionDocument.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func displayName(for handledBy: String, context: AssistantContextModel) -> String {
        let identity = contextIdentity(for: handledBy, context: context)
        let nickname = identity.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        if nickname.isEmpty {
            return identity.displayName
        }
        return "\(nickname) (\(identity.displayName))"
    }

    private func contextIdentity(for handledBy: String, context: AssistantContextModel) -> SettingsAgentIdentityModel {
        let base = SettingsTeamChatIdentitiesModel.default.identity(for: handledBy)
        guard let row = context.teamChatIdentities[handledBy] else {
            return base
        }
        let nickname = String(row["nickname"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let displayName = String(row["displayName"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let bubbleColorHex = String(row["bubbleColor"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return SettingsAgentIdentityModel(
            roleID: handledBy,
            displayName: displayName.isEmpty ? base.displayName : displayName,
            nickname: nickname,
            bubbleColorHex: bubbleColorHex
        )
    }

    private func shouldIntroduce(roleID: String, context: AssistantContextModel, userMessage: String) -> Bool {
        guard !roleID.isEmpty else { return false }
        guard !messages.contains(where: { $0.role == .assistant && $0.handledBy == roleID }) else { return false }

        let interactionStyle = context.interactionStyle.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if interactionStyle == "direct", roleID != "app_assistant" {
            return false
        }

        let lowered = userMessage.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let identity = contextIdentity(for: roleID, context: context)
        let tokens = [
            identity.displayName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            identity.nickname.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        ].filter { !$0.isEmpty }
        if tokens.contains(where: { token in
            lowered.range(of: "(^|\\b)(hey\\s+)?\(NSRegularExpression.escapedPattern(for: token))(\\b|[,:])", options: .regularExpression) != nil
        }) {
            return false
        }

        return true
    }

    private func displayDiscoveryCapturePayload(
        result: AssistantExecutionResult,
        context: AssistantContextModel
    ) -> AssistantDisplayDiscoveryResult? {
        if let discovery = result.displayDiscovery, discovery.shouldCaptureTurn {
            return discovery
        }

        let currentPhase = context.workflowPhaseID.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let transitionedIntoDisplay = result.phaseTransition?.phaseID == .displayDiscovery
        let activeDisplayPhase = currentPhase == WorkflowPhaseID.displayDiscovery.rawValue

        guard result.handledBy == "designer_dialog", activeDisplayPhase || transitionedIntoDisplay else {
            return nil
        }

        return AssistantDisplayDiscoveryResult(
            status: .inProgress,
            scope: "groups_models_v1",
            shouldCaptureTurn: true,
            candidateProps: [],
            insights: [],
            unresolvedBranches: [],
            resolvedBranches: [],
            tagProposals: []
        )
    }

    private func roleIntroductionMessage(for roleID: String, context: AssistantContextModel) -> AssistantMessageModel {
        return AssistantMessageModel(
            id: UUID().uuidString,
            role: .assistant,
            text: followUpIntroduction(for: roleID, context: context),
            timestamp: isoNow(),
            handledBy: roleID,
            routeDecision: roleID == "app_assistant" ? "general" : roleID,
            displayName: displayName(for: roleID, context: context)
        )
    }

    private func introductionPrompt(for roleID: String, context: AssistantContextModel) -> String {
        let identity = contextIdentity(for: roleID, context: context)
        let nickname = identity.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        let roleSummary = roleSummaryText(for: roleID)
        let userPreferredName = context.userPreferredName.trimmingCharacters(in: .whitespacesAndNewlines)
        if nickname.isEmpty {
            if userPreferredName.isEmpty {
                return "I'm \(identity.displayName). \(roleSummary) What would you like me to call you?"
            }
            return "I'm \(identity.displayName). \(roleSummary) I’ll call you \(userPreferredName) unless you want something else."
        }
        if userPreferredName.isEmpty {
            return "I'm \(displayName(for: roleID, context: context)). \(roleSummary) You can call me \(nickname) if you'd like. What would you like me to call you?"
        }
        return "I'm \(displayName(for: roleID, context: context)). \(roleSummary) You can call me \(nickname) if you'd like. I’ll call you \(userPreferredName) unless you want something else."
    }

    private func followUpIntroduction(for roleID: String, context: AssistantContextModel) -> String {
        let identity = contextIdentity(for: roleID, context: context)
        let nickname = identity.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
        let roleSummary = roleSummaryText(for: roleID)
        if nickname.isEmpty {
            return "I'm \(identity.displayName). \(roleSummary)"
        }
        return "I'm \(displayName(for: roleID, context: context)). \(roleSummary) You can call me \(nickname) if you'd like."
    }

    private func roleSummaryText(for roleID: String) -> String {
        switch roleID {
        case "app_assistant":
            return "I handle workflow coordination, routing, and setup questions."
        case "designer_dialog":
            return "I focus on project mission, display understanding, creative direction, and design intent."
        case "audio_analyst":
            return "I focus on music structure, timing, and analysis details."
        case "sequence_agent":
            return "I focus on turning intent into concrete sequence changes."
        default:
            return "I am part of the design team."
        }
    }

    private func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    private func saveProjectMission(_ mission: AssistantProjectMissionResult, project: ActiveProjectModel?) throws {
        guard var project else { return }
        let payload: [String: Any] = [
            "document": mission.document,
            "updatedAt": isoNow()
        ]
        project.snapshot["projectBrief"] = AnyCodable(payload)
        let saved = try projectService.saveProject(project)
        workspace?.setProject(saved)
    }
}
