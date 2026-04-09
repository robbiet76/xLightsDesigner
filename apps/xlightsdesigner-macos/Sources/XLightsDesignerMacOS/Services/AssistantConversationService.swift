import Foundation

protocol AssistantConversationService {
    func loadConversationState() throws -> AssistantConversationState
    func saveConversationState(_ state: AssistantConversationState) throws
}

struct LocalAssistantConversationService: AssistantConversationService {
    private let fileManager = FileManager.default
    private let maxRecentMessages = 16
    private let storageRootURL: URL

    init(storageRootURL: URL = URL(fileURLWithPath: AppEnvironment.desktopStateRoot, isDirectory: true)) {
        self.storageRootURL = storageRootURL
    }

    func loadConversationState() throws -> AssistantConversationState {
        let url = storageURL()
        guard fileManager.fileExists(atPath: url.path) else {
            return AssistantConversationState()
        }
        let data = try Data(contentsOf: url)
        if let state = try? JSONDecoder().decode(AssistantConversationState.self, from: data) {
            return state
        }
        let messages = try JSONDecoder().decode([AssistantMessageModel].self, from: data)
        return AssistantConversationState(messages: messages)
    }

    func saveConversationState(_ state: AssistantConversationState) throws {
        let url = storageURL()
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let normalized = compact(state: state)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(normalized)
        try data.write(to: url, options: .atomic)
    }

    private func compact(state: AssistantConversationState) -> AssistantConversationState {
        guard state.messages.count > maxRecentMessages else { return state }
        let retained = Array(state.messages.suffix(maxRecentMessages))
        let archived = Array(state.messages.dropLast(maxRecentMessages))
        let addition = summarize(messages: archived)
        let mergedSummary = [state.rollingSummary.trimmingCharacters(in: .whitespacesAndNewlines), addition]
            .filter { !$0.isEmpty }
            .joined(separator: "\n")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return AssistantConversationState(
            rollingSummary: mergedSummary,
            messages: retained
        )
    }

    private func summarize(messages: [AssistantMessageModel]) -> String {
        guard !messages.isEmpty else { return "" }
        let recentUserTopics = messages
            .filter { $0.role == .user }
            .suffix(4)
            .map { "- User discussed: " + compactLine($0.text) }
        let recentAssistantOutcomes = messages
            .filter { $0.role == .assistant }
            .suffix(4)
            .map {
                let speaker = $0.displayName ?? ($0.handledBy?.isEmpty == false ? $0.handledBy! : "Assistant")
                return "- \(speaker): " + compactLine($0.text)
            }
        let lines = Array(recentUserTopics + recentAssistantOutcomes)
        guard !lines.isEmpty else { return "" }
        return (["Conversation summary:"] + lines).joined(separator: "\n")
    }

    private func compactLine(_ text: String) -> String {
        let squashed = text
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if squashed.count <= 180 { return squashed }
        let index = squashed.index(squashed.startIndex, offsetBy: 177)
        return String(squashed[..<index]) + "..."
    }

    private func storageURL() -> URL {
        storageRootURL
            .appendingPathComponent("assistant", isDirectory: true)
            .appendingPathComponent("conversation.json", isDirectory: false)
    }
}
