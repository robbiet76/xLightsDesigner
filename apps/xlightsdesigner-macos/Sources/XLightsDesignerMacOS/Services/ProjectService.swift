import CryptoKit
import Foundation

protocol ProjectService: Sendable {
    func listProjects() throws -> [ProjectReferenceModel]
    func loadMostRecentProject() throws -> ActiveProjectModel?
    func openProject(filePath: String) throws -> ActiveProjectModel
    func createProject(draft: ProjectDraftModel) throws -> ActiveProjectModel
    func saveProject(_ project: ActiveProjectModel) throws -> ActiveProjectModel
}

struct LocalProjectService: ProjectService {
    private let projectsRootPath: String

    init(projectsRootPath: String = AppEnvironment.projectsRootPath) {
        self.projectsRootPath = projectsRootPath
    }

    func listProjects() throws -> [ProjectReferenceModel] {
        try allProjects().map { project in
            let folderPath = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent().path
            return ProjectReferenceModel(
                id: project.id,
                projectName: project.projectName,
                projectFolderPath: folderPath,
                projectFilePath: project.projectFilePath
            )
        }
        .sorted {
            $0.projectName.localizedCaseInsensitiveCompare($1.projectName) == .orderedAscending
        }
    }

    func loadMostRecentProject() throws -> ActiveProjectModel? {
        try allProjects().max(by: { $0.updatedAt < $1.updatedAt })
    }

    func openProject(filePath: String) throws -> ActiveProjectModel {
        try readProject(from: resolveProjectFilePath(from: filePath))
    }

    func createProject(draft: ProjectDraftModel) throws -> ActiveProjectModel {
        let normalized = normalizeProjectName(draft.projectName)
        guard !normalized.isEmpty else { throw ProjectServiceError.invalidProjectName }
        let dir = URL(fileURLWithPath: projectsRootPath).appendingPathComponent(normalized, isDirectory: true)
        let fileURL = dir.appendingPathComponent("\(normalized).xdproj")
        if FileManager.default.fileExists(atPath: fileURL.path) || FileManager.default.fileExists(atPath: dir.path) {
            throw ProjectServiceError.projectAlreadyExists(normalized)
        }
        if draft.migrateMetadata {
            let sourcePath = draft.migrationSourceProjectPath.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !sourcePath.isEmpty else { throw ProjectServiceError.migrationSourceRequired }
            let projectsRoot = URL(fileURLWithPath: projectsRootPath).standardizedFileURL.path
            let standardizedSource = URL(fileURLWithPath: sourcePath).standardizedFileURL.path
            guard standardizedSource == projectsRoot || standardizedSource.hasPrefix(projectsRoot + "/") else {
                throw ProjectServiceError.invalidMigrationSource(sourcePath)
            }
            let sourceProjectFile = try resolveProjectFilePath(from: sourcePath)
            let sourceDir = URL(fileURLWithPath: sourceProjectFile).deletingLastPathComponent()
            try FileManager.default.copyItem(at: sourceDir, to: dir)
            let copiedSourceProjectFile = dir.appendingPathComponent(URL(fileURLWithPath: sourceProjectFile).lastPathComponent)
            if copiedSourceProjectFile.path != fileURL.path, FileManager.default.fileExists(atPath: copiedSourceProjectFile.path) {
                try FileManager.default.moveItem(at: copiedSourceProjectFile, to: fileURL)
            }
        } else {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        let now = isoNow()
        let doc = ProjectDocument(
            version: 1,
            projectName: normalized,
            showFolder: draft.showFolder.trimmingCharacters(in: .whitespacesAndNewlines),
            mediaPath: draft.mediaPath.trimmingCharacters(in: .whitespacesAndNewlines),
            key: projectKey(projectName: normalized, showFolder: draft.showFolder),
            id: projectID(projectName: normalized, showFolder: draft.showFolder),
            createdAt: now,
            updatedAt: now,
            snapshot: buildSnapshot(projectName: normalized, projectFilePath: fileURL.path, mediaPath: draft.mediaPath)
        )
        try writeDocument(doc, to: fileURL)
        return try readProject(from: fileURL.path)
    }

    func saveProject(_ project: ActiveProjectModel) throws -> ActiveProjectModel {
        let doc = projectDocument(from: project, projectName: project.projectName, projectFilePath: project.projectFilePath)
        try writeDocument(doc, to: URL(fileURLWithPath: project.projectFilePath))
        return try readProject(from: project.projectFilePath)
    }

    private func allProjects() throws -> [ActiveProjectModel] {
        let root = URL(fileURLWithPath: projectsRootPath)
        guard FileManager.default.fileExists(atPath: root.path) else { return [] }
        let files = try FileManager.default.subpathsOfDirectory(atPath: root.path)
            .filter { $0.hasSuffix(".xdproj") }
            .map { root.appendingPathComponent($0) }
        return files
            .compactMap { try? readProject(from: $0.path) }
            .filter { !isGeneratedTestProject($0) }
    }

    private func resolveProjectFilePath(from selectionPath: String) throws -> String {
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: selectionPath, isDirectory: &isDirectory)
        guard exists else { throw ProjectServiceError.projectNotFound(selectionPath) }
        if !isDirectory.boolValue {
            guard selectionPath.hasSuffix(".xdproj") else {
                throw ProjectServiceError.invalidProjectSelection(selectionPath)
            }
            return selectionPath
        }
        let folderName = URL(fileURLWithPath: selectionPath).lastPathComponent
        let canonical = URL(fileURLWithPath: selectionPath).appendingPathComponent("\(folderName).xdproj").path
        if FileManager.default.fileExists(atPath: canonical) {
            return canonical
        }
        let entries = try FileManager.default.contentsOfDirectory(atPath: selectionPath)
            .filter { $0.hasSuffix(".xdproj") }
        if entries.count == 1 {
            return URL(fileURLWithPath: selectionPath).appendingPathComponent(entries[0]).path
        }
        throw ProjectServiceError.invalidProjectSelection(selectionPath)
    }

    private func readProject(from filePath: String) throws -> ActiveProjectModel {
        let data = try Data(contentsOf: URL(fileURLWithPath: filePath))
        let doc = try JSONDecoder().decode(ProjectDocument.self, from: data)
        let snapshot = doc.snapshot ?? ProjectSnapshot(
            projectMetadataRoot: AppEnvironment.canonicalAppRoot,
            projectFilePath: filePath,
            route: "project",
            mediaPath: doc.mediaPath,
            projectConcept: "",
            sequencePathInput: "",
            audioPathInput: "",
            recentSequences: [],
            projectCreatedAt: doc.createdAt,
            projectUpdatedAt: doc.updatedAt,
            ui: nil,
            flags: nil,
            safety: nil
        )
        return ActiveProjectModel(
            id: doc.id,
            projectName: doc.projectName,
            projectFilePath: filePath,
            showFolder: doc.showFolder,
            mediaPath: doc.mediaPath,
            appRootPath: AppEnvironment.canonicalAppRoot,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            snapshot: snapshot.asDictionary()
        )
    }

    private func writeDocument(_ doc: ProjectDocument, to url: URL) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(doc)
        try data.write(to: url, options: .atomic)
    }

    private func projectDocument(from project: ActiveProjectModel, projectName: String, projectFilePath: String) -> ProjectDocument {
        let createdAt = project.createdAt.isEmpty ? isoNow() : project.createdAt
        let updatedAt = isoNow()
        let showFolder = project.showFolder.trimmingCharacters(in: .whitespacesAndNewlines)
        let mediaPath = project.mediaPath.trimmingCharacters(in: .whitespacesAndNewlines)
        let snapshot = buildSnapshot(projectName: projectName, projectFilePath: projectFilePath, mediaPath: mediaPath, existing: project.snapshot, createdAt: createdAt, updatedAt: updatedAt)
        return ProjectDocument(
            version: 1,
            projectName: projectName,
            showFolder: showFolder,
            mediaPath: mediaPath,
            key: projectKey(projectName: projectName, showFolder: showFolder),
            id: projectID(projectName: projectName, showFolder: showFolder),
            createdAt: createdAt,
            updatedAt: updatedAt,
            snapshot: snapshot
        )
    }

    private func buildSnapshot(
        projectName: String,
        projectFilePath: String,
        mediaPath: String,
        existing: [String: AnyCodable] = [:],
        createdAt: String? = nil,
        updatedAt: String? = nil
    ) -> ProjectSnapshot {
        let route = (existing["route"]?.value as? String) ?? "project"
        let projectConcept = (existing["projectConcept"]?.value as? String) ?? ""
        let sequencePathInput = (existing["sequencePathInput"]?.value as? String) ?? ""
        let audioPathInput = (existing["audioPathInput"]?.value as? String) ?? ""
        let recentSequences = (existing["recentSequences"]?.value as? [Any])?.compactMap { $0 as? String } ?? []
        let resolvedCreatedAt = createdAt ?? isoNow()
        let resolvedUpdatedAt = updatedAt ?? isoNow()
        return ProjectSnapshot(
            projectMetadataRoot: AppEnvironment.canonicalAppRoot,
            projectFilePath: projectFilePath,
            route: route,
            mediaPath: mediaPath,
            projectConcept: projectConcept,
            sequencePathInput: sequencePathInput,
            audioPathInput: audioPathInput,
            recentSequences: recentSequences,
            projectCreatedAt: resolvedCreatedAt,
            projectUpdatedAt: resolvedUpdatedAt,
            ui: ["sequenceMode": AnyCodable("existing")],
            flags: ["planOnlyMode": AnyCodable(false)],
            safety: [
                "applyConfirmMode": AnyCodable("large-only"),
                "largeChangeThreshold": AnyCodable(60),
                "sequenceSwitchUnsavedPolicy": AnyCodable("discard-unsaved"),
                "agentApplyRollout": AnyCodable("full")
            ]
        )
    }

    private func projectKey(projectName: String, showFolder: String) -> String {
        "\(projectName.trimmingCharacters(in: .whitespacesAndNewlines))::\(showFolder.trimmingCharacters(in: .whitespacesAndNewlines))"
    }

    private func projectID(projectName: String, showFolder: String) -> String {
        let input = Data(projectKey(projectName: projectName, showFolder: showFolder).utf8)
        return Insecure.SHA1.hash(data: input).map { String(format: "%02x", $0) }.joined()
    }

    private func normalizeProjectName(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    private func isGeneratedTestProject(_ project: ActiveProjectModel) -> Bool {
        project.projectName.hasPrefix("Native Test Project ") || project.projectName.hasPrefix("LayoutTagStore")
    }
}

enum ProjectServiceError: LocalizedError {
    case invalidProjectName
    case projectAlreadyExists(String)
    case invalidProjectSelection(String)
    case projectNotFound(String)
    case migrationSourceRequired
    case invalidMigrationSource(String)

    var errorDescription: String? {
        switch self {
        case .invalidProjectName:
            return "Project name is required."
        case let .projectAlreadyExists(name):
            return "A project named \"\(name)\" already exists."
        case let .invalidProjectSelection(path):
            return "The selected folder is not a valid xLightsDesigner project: \(path)"
        case let .projectNotFound(path):
            return "Project path does not exist: \(path)"
        case .migrationSourceRequired:
            return "Choose a source project folder to migrate metadata."
        case let .invalidMigrationSource(path):
            return "Migration source must be chosen from the Projects folder: \(path)"
        }
    }
}

private struct ProjectDocument: Codable {
    let version: Int
    let projectName: String
    let showFolder: String
    let mediaPath: String
    let key: String
    let id: String
    let createdAt: String
    let updatedAt: String
    let snapshot: ProjectSnapshot?
}

private struct ProjectSnapshot: Codable {
    let projectMetadataRoot: String
    let projectFilePath: String
    let route: String
    let mediaPath: String
    let projectConcept: String?
    let sequencePathInput: String?
    let audioPathInput: String?
    let recentSequences: [String]?
    let projectCreatedAt: String
    let projectUpdatedAt: String
    let ui: [String: AnyCodable]?
    let flags: [String: AnyCodable]?
    let safety: [String: AnyCodable]?

    func asDictionary() -> [String: AnyCodable] {
        [
            "projectMetadataRoot": AnyCodable(projectMetadataRoot),
            "projectFilePath": AnyCodable(projectFilePath),
            "route": AnyCodable(route),
            "mediaPath": AnyCodable(mediaPath),
            "projectConcept": AnyCodable(projectConcept ?? ""),
            "sequencePathInput": AnyCodable(sequencePathInput ?? ""),
            "audioPathInput": AnyCodable(audioPathInput ?? ""),
            "recentSequences": AnyCodable(recentSequences ?? []),
            "projectCreatedAt": AnyCodable(projectCreatedAt),
            "projectUpdatedAt": AnyCodable(projectUpdatedAt),
            "ui": AnyCodable((ui ?? [:]).mapValues(\.value)),
            "flags": AnyCodable((flags ?? [:]).mapValues(\.value)),
            "safety": AnyCodable((safety ?? [:]).mapValues(\.value))
        ]
    }
}
