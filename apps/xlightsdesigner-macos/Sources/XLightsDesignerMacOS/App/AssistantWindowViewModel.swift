import Foundation
import Observation

@MainActor
@Observable
final class AssistantWindowViewModel {
    private let conversationService: AssistantConversationService

    var messages: [AssistantMessageModel] = []
    var draft = ""

    init(conversationService: AssistantConversationService = LocalAssistantConversationService()) {
        self.conversationService = conversationService
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

    func sendDraft(context: AssistantContextModel) {
        let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        let userMessage = AssistantMessageModel(
            id: UUID().uuidString,
            role: .user,
            text: trimmed,
            timestamp: isoNow()
        )
        let assistantMessage = AssistantMessageModel(
            id: UUID().uuidString,
            role: .assistant,
            text: stubResponse(for: trimmed, context: context),
            timestamp: isoNow()
        )
        messages.append(userMessage)
        messages.append(assistantMessage)
        draft = ""
        try? conversationService.saveMessages(messages)
    }

    func clearConversation() {
        messages = [seedAssistantMessage()]
        draft = ""
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

    private func stubResponse(for prompt: String, context: AssistantContextModel) -> String {
        let project = context.activeProjectName.isEmpty ? "No active project" : context.activeProjectName
        let focused = context.focusedSummary.isEmpty ? "No focused item" : context.focusedSummary
        return """
        Context:
        Project: \(project)
        Workflow: \(context.workflowName)
        Focus: \(focused)

        Assistant runtime is not connected yet in the native shell. This window is the persistent native utility surface. The next step is to wire it to the shared app-assistant backend instead of the current local stub.
        """
    }

    private func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
