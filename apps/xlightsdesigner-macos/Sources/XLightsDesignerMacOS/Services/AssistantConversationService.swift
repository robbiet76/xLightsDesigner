import Foundation

protocol AssistantConversationService {
    func loadMessages() throws -> [AssistantMessageModel]
    func saveMessages(_ messages: [AssistantMessageModel]) throws
}

struct LocalAssistantConversationService: AssistantConversationService {
    private let fileManager = FileManager.default

    func loadMessages() throws -> [AssistantMessageModel] {
        let url = storageURL()
        guard fileManager.fileExists(atPath: url.path) else {
            return []
        }
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode([AssistantMessageModel].self, from: data)
    }

    func saveMessages(_ messages: [AssistantMessageModel]) throws {
        let url = storageURL()
        try fileManager.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(messages)
        try data.write(to: url, options: .atomic)
    }

    private func storageURL() -> URL {
        URL(fileURLWithPath: AppEnvironment.desktopStateRoot, isDirectory: true)
            .appendingPathComponent("assistant", isDirectory: true)
            .appendingPathComponent("conversation.json", isDirectory: false)
    }
}
