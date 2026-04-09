import Foundation

protocol DisplayDiscoveryStateStore: Sendable {
    func load(for project: ActiveProjectModel) throws -> DisplayDiscoveryDocument
    func summary(for project: ActiveProjectModel?) -> DisplayDiscoverySummaryModel
    func clear(for project: ActiveProjectModel?) throws
    func recordConversationTurn(
        project: ActiveProjectModel,
        status: DisplayDiscoveryStatus,
        scope: String,
        candidateProps: [DisplayDiscoveryCandidateModel],
        userMessage: AssistantMessageModel,
        assistantMessage: AssistantMessageModel
    ) throws
}

struct LocalDisplayDiscoveryStateStore: DisplayDiscoveryStateStore {
    func load(for project: ActiveProjectModel) throws -> DisplayDiscoveryDocument {
        let fileURL = storageURL(for: project)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return DisplayDiscoveryDocument()
        }
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(DisplayDiscoveryDocument.self, from: data)
    }

    func summary(for project: ActiveProjectModel?) -> DisplayDiscoverySummaryModel {
        guard let project, let document = try? load(for: project) else {
            return .empty
        }
        return DisplayDiscoverySummaryModel(
            status: document.status,
            scope: document.scope,
            startedAt: document.startedAt ?? "",
            updatedAt: document.updatedAt ?? "",
            transcriptCount: document.transcript.count,
            candidateProps: document.candidateProps
        )
    }

    func clear(for project: ActiveProjectModel?) throws {
        guard let project else { return }
        let fileURL = storageURL(for: project)
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        try FileManager.default.removeItem(at: fileURL)
    }

    func recordConversationTurn(
        project: ActiveProjectModel,
        status: DisplayDiscoveryStatus,
        scope: String,
        candidateProps: [DisplayDiscoveryCandidateModel],
        userMessage: AssistantMessageModel,
        assistantMessage: AssistantMessageModel
    ) throws {
        var document = (try? load(for: project)) ?? DisplayDiscoveryDocument()
        let timestamp = assistantMessage.timestamp
        if document.startedAt == nil {
            document.startedAt = userMessage.timestamp
        }
        document.status = status
        document.scope = scope
        document.updatedAt = timestamp
        if !candidateProps.isEmpty {
            document.candidateProps = candidateProps
        }
        appendIfNeeded(entry: userMessage, into: &document.transcript)
        appendIfNeeded(entry: assistantMessage, into: &document.transcript)
        try save(document, for: project)
    }

    private func appendIfNeeded(entry: AssistantMessageModel, into transcript: inout [DisplayDiscoveryTranscriptEntry]) {
        guard !entry.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if transcript.last?.id == entry.id { return }
        transcript.append(DisplayDiscoveryTranscriptEntry(
            id: entry.id,
            role: entry.role,
            text: entry.text,
            timestamp: entry.timestamp,
            handledBy: entry.handledBy
        ))
    }

    private func storageURL(for project: ActiveProjectModel) -> URL {
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        return projectDir.appendingPathComponent("layout/display-discovery.json", isDirectory: false)
    }

    private func save(_ document: DisplayDiscoveryDocument, for project: ActiveProjectModel) throws {
        let fileURL = storageURL(for: project)
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(document)
        try data.write(to: fileURL, options: .atomic)
    }
}
