import Foundation
import Observation

@MainActor
@Observable
final class AssistantWindowViewModel {
    private let conversationService: AssistantConversationService
    private let executionService: AssistantExecutionService
    private let displayDiscoveryStore: DisplayDiscoveryStateStore
    private let userProfileStore: AssistantUserProfileStore

    var messages: [AssistantMessageModel] = []
    var draft = ""
    var isSending = false
    var previousResponseID = ""
    var rollingConversationSummary = ""

    init(
        conversationService: AssistantConversationService = LocalAssistantConversationService(),
        executionService: AssistantExecutionService = LocalAssistantExecutionService(),
        displayDiscoveryStore: DisplayDiscoveryStateStore = LocalDisplayDiscoveryStateStore(),
        userProfileStore: AssistantUserProfileStore = LocalAssistantUserProfileStore()
    ) {
        self.conversationService = conversationService
        self.executionService = executionService
        self.displayDiscoveryStore = displayDiscoveryStore
        self.userProfileStore = userProfileStore
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

    func sendDraft(context: AssistantContextModel, project: ActiveProjectModel?) async {
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
            previousResponseID = result.responseID
            let introRole = result.handledBy
            if shouldIntroduce(roleID: introRole) {
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
            if !result.userPreferenceNotes.isEmpty {
                try? userProfileStore.addPreferenceNotes(result.userPreferenceNotes, recordedAt: isoNow())
            }
            if
                let project,
                let discovery = result.displayDiscovery,
                discovery.shouldCaptureTurn,
                let assistantMessage = messages.last
            {
                try? displayDiscoveryStore.recordConversationTurn(
                    project: project,
                    status: discovery.status,
                    scope: discovery.scope,
                    candidateProps: discovery.candidateProps,
                    insights: discovery.insights,
                    unresolvedBranches: discovery.unresolvedBranches,
                    resolvedBranches: discovery.resolvedBranches,
                    tagProposals: discovery.tagProposals,
                    userMessage: userMessage,
                    assistantMessage: assistantMessage
                )
                NotificationCenter.default.post(name: .displayDiscoveryDidChange, object: nil)
            }
        } catch {
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

    private func shouldIntroduce(roleID: String) -> Bool {
        !messages.contains { $0.role == .assistant && $0.handledBy == roleID }
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
        if nickname.isEmpty {
            return "I'm \(identity.displayName). \(roleSummary) What would you like me to call you?"
        }
        return "I'm \(displayName(for: roleID, context: context)). \(roleSummary) You can call me \(nickname) if you'd like. What would you like me to call you?"
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
            return "I focus on display understanding, creative direction, and design intent."
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
}
