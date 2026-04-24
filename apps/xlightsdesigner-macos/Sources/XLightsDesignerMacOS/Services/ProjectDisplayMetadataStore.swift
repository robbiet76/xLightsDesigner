import Foundation

protocol DisplayMetadataStore: Sendable {
    func load(for project: ActiveProjectModel) throws -> PersistedDisplayMetadataDocument
    func createOrAssignTag(project: ActiveProjectModel, targetIDs: [String], tagName: String, description: String) throws
    func removeTag(project: ActiveProjectModel, targetIDs: [String], tagID: String) throws
    func updateTagDefinition(project: ActiveProjectModel, tagID: String?, name: String, description: String, colorName: String?) throws
    func deleteTagDefinition(project: ActiveProjectModel, tagID: String) throws
}

struct PersistedDisplayMetadataDocument: Codable, Sendable {
    var version: Int = 1
    var tags: [PersistedDisplayTagDefinition] = []
    var targetTags: [String: [String]] = [:]
    var preferencesByTargetId: [String: PersistedDisplayTargetPreference] = [:]
    var visualHintDefinitions: [PersistedVisualHintDefinition] = []
}

struct PersistedDisplayTagDefinition: Codable, Sendable {
    var id: String
    var name: String
    var description: String
    var colorName: String?
}

struct PersistedDisplayTargetPreference: Codable, Sendable, Equatable {
    var rolePreference: String?
    var semanticHints: [String]?
    var submodelHints: [String]?
    var effectAvoidances: [String]?
}

struct PersistedVisualHintDefinition: Codable, Sendable, Equatable {
    var name: String
    var status: String?
    var semanticClass: String?
    var behavioralIntent: String?
    var behavioralTags: [String]?
    var source: String?
    var definedBy: String?
}

enum DisplayMetadataStoreError: LocalizedError {
    case duplicateTagName

    var errorDescription: String? {
        switch self {
        case .duplicateTagName:
            return "A tag with that name already exists in this project."
        }
    }
}

struct LocalDisplayMetadataStore: DisplayMetadataStore {
    func load(for project: ActiveProjectModel) throws -> PersistedDisplayMetadataDocument {
        let fileURL = metadataFileURL(for: project)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return PersistedDisplayMetadataDocument()
        }
        let data = try Data(contentsOf: fileURL)
        var document = try JSONDecoder().decode(PersistedDisplayMetadataDocument.self, from: data)
        document.tags.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        return document
    }

    func createOrAssignTag(project: ActiveProjectModel, targetIDs: [String], tagName: String, description: String) throws {
        let normalizedName = tagName.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedName.isEmpty else { return }

        var document = try load(for: project)
        let tagID: String
        if let existingIndex = document.tags.firstIndex(where: { $0.name.caseInsensitiveCompare(normalizedName) == .orderedSame }) {
            tagID = document.tags[existingIndex].id
            if !normalizedDescription.isEmpty {
                document.tags[existingIndex].description = normalizedDescription
            }
        } else {
            let definition = PersistedDisplayTagDefinition(id: UUID().uuidString, name: normalizedName, description: normalizedDescription)
            document.tags.append(definition)
            tagID = definition.id
        }

        for targetID in targetIDs {
            var assigned = document.targetTags[targetID] ?? []
            if !assigned.contains(tagID) {
                assigned.append(tagID)
                assigned.sort()
                document.targetTags[targetID] = assigned
            }
        }

        try save(document, for: project)
    }

    func removeTag(project: ActiveProjectModel, targetIDs: [String], tagID: String) throws {
        var document = try load(for: project)
        for targetID in targetIDs {
            guard var assigned = document.targetTags[targetID] else { continue }
            assigned.removeAll { $0 == tagID }
            if assigned.isEmpty {
                document.targetTags.removeValue(forKey: targetID)
            } else {
                document.targetTags[targetID] = assigned
            }
        }
        try save(document, for: project)
    }

    func updateTagDefinition(project: ActiveProjectModel, tagID: String?, name: String, description: String, colorName: String?) throws {
        let normalizedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedDescription = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedName.isEmpty else { return }

        var document = try load(for: project)
        if let tagID {
            guard let index = document.tags.firstIndex(where: { $0.id == tagID }) else { return }
            if document.tags.enumerated().contains(where: { $0.offset != index && $0.element.name.caseInsensitiveCompare(normalizedName) == .orderedSame }) {
                throw DisplayMetadataStoreError.duplicateTagName
            }
            document.tags[index].name = normalizedName
            document.tags[index].description = normalizedDescription
            document.tags[index].colorName = colorName
        } else {
            if document.tags.contains(where: { $0.name.caseInsensitiveCompare(normalizedName) == .orderedSame }) {
                throw DisplayMetadataStoreError.duplicateTagName
            }
            document.tags.append(PersistedDisplayTagDefinition(id: UUID().uuidString, name: normalizedName, description: normalizedDescription, colorName: colorName))
        }
        try save(document, for: project)
    }

    func deleteTagDefinition(project: ActiveProjectModel, tagID: String) throws {
        var document = try load(for: project)
        document.tags.removeAll { $0.id == tagID }
        for key in document.targetTags.keys {
            var assigned = document.targetTags[key] ?? []
            assigned.removeAll { $0 == tagID }
            if assigned.isEmpty {
                document.targetTags.removeValue(forKey: key)
            } else {
                document.targetTags[key] = assigned
            }
        }
        try save(document, for: project)
    }

    private func metadataFileURL(for project: ActiveProjectModel) -> URL {
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        return projectDir.appendingPathComponent("layout/layout-metadata.json", isDirectory: false)
    }

    private func save(_ document: PersistedDisplayMetadataDocument, for project: ActiveProjectModel) throws {
        let fileURL = metadataFileURL(for: project)
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        var normalized = document
        normalized.tags.sort { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(normalized)
        try data.write(to: fileURL, options: .atomic)
    }
}
