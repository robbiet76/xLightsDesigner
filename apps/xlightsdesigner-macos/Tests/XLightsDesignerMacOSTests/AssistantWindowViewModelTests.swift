import Foundation
import Testing
@testable import XLightsDesignerMacOS

@MainActor
struct AssistantWindowViewModelTests {
    @Test func sendsDraftThroughExecutionServiceAndAppendsAssistantReply() async {
        let conversation = InMemoryAssistantConversationService()
        let execution = StubAssistantExecutionService(result: .success(.init(
            assistantMessage: "Real assistant reply",
            handledBy: "app_assistant",
            routeDecision: "general",
            responseID: "resp-1",
            displayDiscovery: nil,
            userPreferenceNotes: []
        )))
        let model = AssistantWindowViewModel(conversationService: conversation, executionService: execution)
        let context = AssistantContextModel(
            activeProjectName: "Christmas 2026",
            workflowName: "Audio",
            route: "audio",
            focusedSummary: "Candy Cane Lane",
            activeSequenceLoaded: false,
            planOnlyMode: false
        )
        model.loadConversationIfNeeded(context: context, project: nil)
        model.draft = "Help me"

        await model.sendDraft(
            context: context,
            project: nil
        )

        #expect(model.messages.count == 3)
        #expect(model.messages.last?.text == "Real assistant reply")
        #expect(model.previousResponseID == "resp-1")
        #expect(execution.lastUserMessage == "Help me")
        #expect(execution.lastContext?.route == "audio")
    }
}

private final class InMemoryAssistantConversationService: AssistantConversationService {
    var state = AssistantConversationState()

    func loadConversationState() throws -> AssistantConversationState { state }
    func saveConversationState(_ state: AssistantConversationState) throws { self.state = state }
    func clearConversationState() throws { state = AssistantConversationState() }
}

private final class StubAssistantExecutionService: AssistantExecutionService, @unchecked Sendable {
    let result: Result<AssistantExecutionResult, Error>
    private(set) var lastUserMessage = ""
    private(set) var lastContext: AssistantContextModel?

    init(result: Result<AssistantExecutionResult, Error>) {
        self.result = result
    }

    func sendConversation(
        userMessage: String,
        messages: [AssistantMessageModel],
        previousResponseID: String,
        context: AssistantContextModel
    ) async throws -> AssistantExecutionResult {
        lastUserMessage = userMessage
        lastContext = context
        return try result.get()
    }
}
