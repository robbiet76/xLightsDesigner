import Foundation
import Observation

@MainActor
@Observable
final class AssistantWindowViewModel {
    private let conversationService: AssistantConversationService
    private let executionService: AssistantExecutionService

    var messages: [AssistantMessageModel] = []
    var draft = ""
    var isSending = false
    var previousResponseID = ""

    init(
        conversationService: AssistantConversationService = LocalAssistantConversationService(),
        executionService: AssistantExecutionService = LocalAssistantExecutionService()
    ) {
        self.conversationService = conversationService
        self.executionService = executionService
    }

    func loadConversationIfNeeded() {
        guard messages.isEmpty else { return }
        do {
            let loaded = try conversationService.loadMessages()
            if loaded.isEmpty {
                messages = [seedAssistantMessage()]
                try? conversationService.saveMessages(messages)
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

    func sendDraft(context: AssistantContextModel) async {
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
        try? conversationService.saveMessages(messages)

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
        try? conversationService.saveMessages(messages)
    }

    func clearConversation() {
        messages = [seedAssistantMessage()]
        draft = ""
        previousResponseID = ""
        isSending = false
        try? conversationService.saveMessages(messages)
    }

    private func seedAssistantMessage() -> AssistantMessageModel {
        AssistantMessageModel(
            id: UUID().uuidString,
            role: .assistant,
            text: "App Assistant here. I coordinate guidance across Project, Layout, Audio, Design, Sequence, Review, and History.",
            timestamp: isoNow(),
            handledBy: "app_assistant",
            routeDecision: "app_assistant",
            displayName: "App Assistant"
        )
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
