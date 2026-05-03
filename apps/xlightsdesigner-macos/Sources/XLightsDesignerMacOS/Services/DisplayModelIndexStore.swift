import Foundation

protocol DisplayModelIndexStore: Sendable {
    func load(for project: ActiveProjectModel?) throws -> DisplayModelIndexDocument
}

struct DisplayModelIndexDocument: Codable, Sendable {
    var artifactType: String?
    var records: [PersistedDisplayModelIndexRecord] = []
}

struct PersistedDisplayModelIndexRecord: Codable, Sendable {
    var targetId: String
    var targetKind: String?
    var identity: PersistedDisplayModelIndexIdentity?
    var structure: PersistedDisplayModelIndexStructure?
}

struct PersistedDisplayModelIndexIdentity: Codable, Sendable {
    var fingerprint: String?
    var fingerprintVersion: String?
    var displayName: String?
    var parentId: String?
    var parentName: String?
}

struct PersistedDisplayModelIndexStructure: Codable, Sendable {
    var submodelMetadata: PersistedDisplaySubmodelMetadata?
}

struct PersistedDisplaySubmodelMetadata: Codable, Sendable {
    var parentId: String?
    var parentName: String?
    var nodeCoverage: PersistedDisplaySubmodelNodeCoverage?
    var siblingIds: [String]?
    var overlappingSiblingIds: [String]?
    var structureHints: [String]?
}

struct PersistedDisplaySubmodelNodeCoverage: Codable, Sendable {
    var nodeCount: Int?
    var parentNodeCount: Int?
    var ratio: Double?
}

struct LocalDisplayModelIndexStore: DisplayModelIndexStore {
    func load(for project: ActiveProjectModel?) throws -> DisplayModelIndexDocument {
        guard let project else { return DisplayModelIndexDocument() }
        let fileURL = modelIndexFileURL(for: project)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return DisplayModelIndexDocument()
        }
        return try JSONDecoder().decode(DisplayModelIndexDocument.self, from: Data(contentsOf: fileURL))
    }

    private func modelIndexFileURL(for project: ActiveProjectModel) -> URL {
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        return projectDir.appendingPathComponent("display/model-index.json", isDirectory: false)
    }
}
