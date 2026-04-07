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
                messages = loaded
            }
        } catch {
            messages = [AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: "Assistant history could not be loaded. A new conversation has started.",
                timestamp: isoNow()
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
            timestamp: isoNow()
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
                timestamp: isoNow()
            ))
        } catch {
            messages.append(AssistantMessageModel(
                id: UUID().uuidString,
                role: .assistant,
                text: "Assistant unavailable: \(String(error.localizedDescription))",
                timestamp: isoNow()
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
            timestamp: isoNow()
        )
    }

    private func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
