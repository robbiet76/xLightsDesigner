import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct AssistantConversationServiceTests {
    @Test func legacyMessageArrayLoadsIntoConversationState() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let assistantDir = root.appendingPathComponent("assistant", isDirectory: true)
        try FileManager.default.createDirectory(at: assistantDir, withIntermediateDirectories: true)
        let file = assistantDir.appendingPathComponent("conversation.json")
        let encoder = JSONEncoder()
        let payload = [
            AssistantMessageModel(
                id: "1",
                role: .assistant,
                text: "Welcome",
                timestamp: "2026-04-08T00:00:00Z",
                handledBy: "app_assistant",
                routeDecision: "general",
                displayName: "App Assistant"
            )
        ]
        try encoder.encode(payload).write(to: file)

        let service = LocalAssistantConversationService(storageRootURL: root)
        let state = try service.loadConversationState()
        #expect(state.rollingSummary.isEmpty)
        #expect(state.messages.count == 1)
    }

    @Test func saveCompactsOlderMessagesIntoRollingSummary() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let service = LocalAssistantConversationService(storageRootURL: root)
        let messages = (0..<20).map { index in
            AssistantMessageModel(
                id: "\(index)",
                role: index.isMultiple(of: 2) ? .user : .assistant,
                text: "Message \(index) with enough content to be summarized clearly for future continuity.",
                timestamp: "2026-04-08T00:00:\(String(format: "%02d", index))Z",
                handledBy: index.isMultiple(of: 2) ? nil : "app_assistant",
                routeDecision: index.isMultiple(of: 2) ? nil : "general",
                displayName: index.isMultiple(of: 2) ? nil : "App Assistant"
            )
        }
        try service.saveConversationState(AssistantConversationState(messages: messages))
        let state = try service.loadConversationState()
        #expect(state.messages.count == 16)
        #expect(!state.rollingSummary.isEmpty)
        #expect(state.rollingSummary.contains("Conversation summary:"))
    }
}
