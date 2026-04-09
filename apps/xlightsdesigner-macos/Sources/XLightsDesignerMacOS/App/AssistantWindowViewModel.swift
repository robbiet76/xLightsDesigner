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
                        displayName: message.displayName ?? displayName(for: message.handledBy ?? "app_assistant")
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
                routeDecision: "app_assistant",
                displayName: "App Assistant"
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
            messages.append(AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: result.assistantMessage,
                timestamp: isoNow(),
                handledBy: result.handledBy,
                routeDecision: result.routeDecision,
                displayName: displayName(for: result.handledBy)
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
                    openQuestions: discovery.openQuestions,
                    resolvedQuestions: discovery.resolvedQuestions,
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
                displayName: "App Assistant"
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
            let observation = "I can already see your layout, and I’ve started reviewing the model list for likely focal props, repeated families, and larger structural patterns before we push into design."
            return AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: "Welcome. I'm the Designer, and I’d like to start by getting to know your display so we can create useful metadata for design and sequencing. \(observation) Tell me which models feel most focal, which are mostly supporting or repeating elements, and whether any named props have a special role in the show.",
                timestamp: isoNow(),
                handledBy: "designer_dialog",
                routeDecision: "designer_dialog",
                displayName: "Designer"
            )
        }

        return AssistantMessageModel(
            id: UUID().uuidString,
            role: .assistant,
            text: "Welcome. I guide the overall workflow and bring in the right specialist as needed: Designer for display and creative direction, Audio Analyst for track structure, and Sequencer for technical sequence work. Start anywhere. I will help you move through the process and adapt to your working style as we go.",
            timestamp: isoNow(),
            handledBy: "app_assistant",
            routeDecision: "app_assistant",
            displayName: "App Assistant"
        )
    }

    private func shouldKickOffDisplayDiscovery(context: AssistantContextModel) -> Bool {
        context.displayTargetCount > 0 &&
        context.displayLabeledTargetCount == 0 &&
        context.displayDiscoveryTranscriptCount == 0 &&
        context.displayDiscoveryStatus.caseInsensitiveCompare("not_started") == .orderedSame
    }

    private func displayName(for handledBy: String) -> String {
        switch handledBy {
        case "designer_dialog":
            return "Designer"
        case "sequence_agent":
            return "Sequencer"
        case "audio_analyst":
            return "Audio Analyst"
        case "app_assistant":
            return "App Assistant"
        default:
            return "Assistant"
        }
    }

    private func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
