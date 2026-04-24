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
            projectMission: nil,
            phaseTransition: nil,
            actionRequest: nil,
            diagnostics: nil,
            userPreferenceNotes: []
        )))
        let model = AssistantWindowViewModel(conversationService: conversation, executionService: execution)
        let context = AssistantContextModel(
            activeProjectName: "Christmas 2026",
            workflowName: "Audio",
            route: "audio",
            focusedSummary: "Candy Cane Lane",
            designIntentGoal: "Make the chorus feel like a clean red and white canopy.",
            designIntentMood: "Warm, crisp, elegant.",
            activeSequenceLoaded: false,
            planOnlyMode: false,
            displayMetadataRows: [[
                "subject": "Snowflakes",
                "subjectType": "Tag",
                "category": "Semantic Tag",
                "value": "Repeated prop family useful for accents.",
                "status": "Confirmed",
                "linkedTargetCount": "10",
                "linkedTargetSample": "Snowflake-01, Snowflake-02"
            ]],
            displayTargetIntentRows: [[
                "subject": "MegaTree",
                "subjectType": "Model",
                "category": "Target Intent",
                "value": "Role: lead. Hints: centerpiece, sparkle. Avoid: Bars",
                "status": "Confirmed",
                "linkedTargetCount": "1",
                "linkedTargetSample": "MegaTree"
            ]]
        )
        model.loadConversationIfNeeded(context: context, project: nil as ActiveProjectModel?)
        model.draft = "Help me"

        await model.sendDraft(
            context: context,
            project: nil as ActiveProjectModel?
        )

        #expect(model.messages.count == 3)
        #expect(model.messages.last?.text == "Real assistant reply")
        #expect(model.previousResponseID == "resp-1")
        #expect(execution.lastUserMessage == "Help me")
        #expect(execution.lastContext?.route == "audio")
        let payload = execution.lastContext?.asPayload()
        let designIntent = payload?["designIntent"] as? [String: Any]
        #expect(designIntent?["goal"] as? String == "Make the chorus feel like a clean red and white canopy.")
        #expect(designIntent?["mood"] as? String == "Warm, crisp, elegant.")
        let display = payload?["display"] as? [String: Any]
        let metadataRows = display?["metadataRows"] as? [[String: String]]
        #expect(metadataRows?.first?["subject"] == "Snowflakes")
        #expect(metadataRows?.first?["linkedTargetCount"] == "10")
        let targetIntentRows = display?["targetIntentRows"] as? [[String: String]]
        #expect(targetIntentRows?.first?["subject"] == "MegaTree")
        #expect(targetIntentRows?.first?["value"]?.contains("Role: lead") == true)
    }

    @Test func skipsFollowUpIntroWhenUserDirectlyAddressesSpecialist() async {
        let conversation = InMemoryAssistantConversationService()
        let execution = StubAssistantExecutionService(result: .success(.init(
            assistantMessage: "I can handle that.",
            handledBy: "sequence_agent",
            routeDecision: "sequence_agent",
            responseID: "resp-2",
            displayDiscovery: nil,
            projectMission: nil,
            phaseTransition: nil,
            actionRequest: nil,
            diagnostics: nil,
            userPreferenceNotes: []
        )))
        let model = AssistantWindowViewModel(conversationService: conversation, executionService: execution)
        let context = AssistantContextModel(
            activeProjectName: "Christmas 2026",
            workflowName: "Sequence",
            route: "sequence",
            focusedSummary: "Current sequence",
            activeSequenceLoaded: true,
            planOnlyMode: false,
            teamChatIdentities: SettingsTeamChatIdentitiesModel.default.asPayload()
        )
        model.loadConversationIfNeeded(context: context, project: nil as ActiveProjectModel?)
        model.draft = "Hey Patch, bring the spinners down."

        await model.sendDraft(
            context: context,
            project: nil as ActiveProjectModel?
        )

        #expect(model.messages.count == 3)
        #expect(model.messages.last?.displayName == "Patch (Sequencer)")
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
