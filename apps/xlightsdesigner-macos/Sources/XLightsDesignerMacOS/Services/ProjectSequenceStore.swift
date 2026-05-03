import CryptoKit
import Foundation

protocol ProjectSequenceStore: Sendable {
    @discardableResult
    func upsertActiveSequence(project: inout ActiveProjectModel, sequencePath: String, audioPath: String?) throws -> Bool
    @discardableResult
    func relinkSequences(project: inout ActiveProjectModel, previousShowFolder: String, newShowFolder: String) throws -> Bool
    func loadActiveSequence(project: ActiveProjectModel) throws -> ProjectSequenceDocument?
}

struct ProjectSequenceDocument: Codable, Equatable, Sendable {
    var version: Int = 1
    var sequenceId: String
    var displayName: String
    var sequencePath: String
    var showFolderAtLastUse: String
    var mediaPath: String?
    var availabilityStatus: String
    var priorSequencePaths: [String]
    var updatedAt: String
}

struct LocalProjectSequenceStore: ProjectSequenceStore {
    @discardableResult
    func upsertActiveSequence(project: inout ActiveProjectModel, sequencePath: String, audioPath: String?) throws -> Bool {
        let normalizedSequencePath = normalizedPath(sequencePath)
        guard !normalizedSequencePath.isEmpty else { return false }
        let now = ISO8601DateFormatter().string(from: Date())
        let existingRecord = try? findExistingRecord(project: project, sequencePath: normalizedSequencePath)
        let sequenceID = existingRecord?.sequenceId ?? sequenceId(for: normalizedSequencePath)
        let sequenceName = ProjectTargetContext.nameWithoutExtension(normalizedSequencePath)
        let mediaPath = normalizedPath(audioPath ?? "")
        var priorPaths = existingRecord?.priorSequencePaths ?? []
        if let previousPath = existingRecord?.sequencePath,
           !previousPath.isEmpty,
           previousPath != normalizedSequencePath,
           !priorPaths.contains(previousPath) {
            priorPaths.append(previousPath)
        }

        let record = ProjectSequenceDocument(
            sequenceId: sequenceID,
            displayName: sequenceName.isEmpty ? URL(fileURLWithPath: normalizedSequencePath).lastPathComponent : sequenceName,
            sequencePath: normalizedSequencePath,
            showFolderAtLastUse: normalizedPath(project.showFolder),
            mediaPath: mediaPath.isEmpty ? nil : mediaPath,
            availabilityStatus: FileManager.default.fileExists(atPath: normalizedSequencePath) ? "available" : "referenced",
            priorSequencePaths: priorPaths,
            updatedAt: now
        )
        try save(record, project: project)
        return updateProjectSnapshot(project: &project, record: record)
    }

    @discardableResult
    func relinkSequences(project: inout ActiveProjectModel, previousShowFolder: String, newShowFolder: String) throws -> Bool {
        var records = try loadRecords(project: project)
        guard !records.isEmpty else { return false }
        let previousRoot = normalizedPath(previousShowFolder)
        let newRoot = normalizedPath(newShowFolder)
        let now = ISO8601DateFormatter().string(from: Date())
        var changed = false

        for index in records.indices {
            var record = records[index]
            var recordChanged = false
            if let resolved = resolveRelinkedSequencePath(record.sequencePath, previousShowFolder: previousRoot, newShowFolder: newRoot) {
                if resolved != record.sequencePath {
                    if !record.sequencePath.isEmpty, !record.priorSequencePaths.contains(record.sequencePath) {
                        record.priorSequencePaths.append(record.sequencePath)
                    }
                    record.sequencePath = resolved
                    recordChanged = true
                }
                if record.availabilityStatus != "available" {
                    record.availabilityStatus = "available"
                    recordChanged = true
                }
            } else if pathIsWithin(record.sequencePath, root: previousRoot) {
                if record.availabilityStatus != "unavailable" {
                    record.availabilityStatus = "unavailable"
                    recordChanged = true
                }
            }

            if let mediaPath = record.mediaPath {
                if let resolvedMedia = resolveRelinkedMediaPath(mediaPath, previousShowFolder: previousRoot, newShowFolder: newRoot) {
                    if resolvedMedia != mediaPath {
                        record.mediaPath = resolvedMedia
                        recordChanged = true
                    }
                } else if pathIsWithin(mediaPath, root: previousRoot) {
                    record.mediaPath = nil
                    recordChanged = true
                }
            }

            if !newRoot.isEmpty, record.showFolderAtLastUse != newRoot {
                record.showFolderAtLastUse = newRoot
                recordChanged = true
            }
            if recordChanged {
                record.updatedAt = now
                try save(record, project: project)
                records[index] = record
                changed = true
            }
        }

        return replaceProjectSnapshotRows(project: &project, records: records) || changed
    }

    func loadActiveSequence(project: ActiveProjectModel) throws -> ProjectSequenceDocument? {
        let rows = (project.snapshot["projectSequences"]?.value as? [[String: Any]]) ?? []
        if let activeSequenceID = rows.first(where: { bool($0["isActive"]) }).flatMap({ string($0["sequenceId"]) }),
           !activeSequenceID.isEmpty,
           let record = try? loadRecord(project: project, sequenceID: activeSequenceID) {
            return record
        }

        let activePath = normalizedPath(string(project.snapshot["sequencePathInput"]?.value))
        if !activePath.isEmpty,
           let record = try loadRecords(project: project).first(where: { $0.sequencePath == activePath || $0.priorSequencePaths.contains(activePath) }) {
            return record
        }
        return nil
    }

    private func findExistingRecord(project: ActiveProjectModel, sequencePath: String) throws -> ProjectSequenceDocument? {
        try loadRecords(project: project).first {
            $0.sequencePath == sequencePath || $0.priorSequencePaths.contains(sequencePath)
        }
    }

    private func loadRecords(project: ActiveProjectModel) throws -> [ProjectSequenceDocument] {
        let root = sequenceRootURL(project: project)
        guard FileManager.default.fileExists(atPath: root.path) else { return [] }
        let paths = try FileManager.default.subpathsOfDirectory(atPath: root.path)
            .filter { $0.hasSuffix("/sequence.json") }
            .sorted()
        return try paths.map { relativePath in
            let fileURL = root.appendingPathComponent(relativePath)
            return try JSONDecoder().decode(ProjectSequenceDocument.self, from: Data(contentsOf: fileURL))
        }
    }

    private func loadRecord(project: ActiveProjectModel, sequenceID: String) throws -> ProjectSequenceDocument {
        let fileURL = recordURL(project: project, sequenceID: sequenceID)
        return try JSONDecoder().decode(ProjectSequenceDocument.self, from: Data(contentsOf: fileURL))
    }

    private func save(_ record: ProjectSequenceDocument, project: ActiveProjectModel) throws {
        let fileURL = recordURL(project: project, sequenceID: record.sequenceId)
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(record).write(to: fileURL, options: .atomic)
    }

    private func updateProjectSnapshot(project: inout ActiveProjectModel, record: ProjectSequenceDocument) -> Bool {
        var changed = false
        var rows = (project.snapshot["projectSequences"]?.value as? [[String: Any]]) ?? []
        for index in rows.indices {
            rows[index]["isActive"] = false
        }
        let row: [String: Any] = [
            "sequenceId": record.sequenceId,
            "sequencePath": record.sequencePath,
            "displayName": record.displayName,
            "showFolderAtLastUse": record.showFolderAtLastUse,
            "availabilityStatus": record.availabilityStatus,
            "isActive": true
        ]
        if let index = rows.firstIndex(where: { string($0["sequenceId"]) == record.sequenceId }) {
            if !dictionariesEqual(rows[index], row) {
                rows[index] = row
                changed = true
            }
        } else {
            rows.append(row)
            changed = true
        }
        rows.sort { string($0["displayName"]).localizedCaseInsensitiveCompare(string($1["displayName"])) == .orderedAscending }
        project.snapshot["projectSequences"] = AnyCodable(rows)
        return changed
    }

    private func replaceProjectSnapshotRows(project: inout ActiveProjectModel, records: [ProjectSequenceDocument]) -> Bool {
        let existingRows = (project.snapshot["projectSequences"]?.value as? [[String: Any]]) ?? []
        let activeSequenceID = existingRows.first(where: { bool($0["isActive"]) }).flatMap { string($0["sequenceId"]) }
        let activePath = normalizedPath(string(project.snapshot["sequencePathInput"]?.value))
        let rows = records.map { record -> [String: Any] in
            let isActive = activeSequenceID == record.sequenceId || (activeSequenceID?.isEmpty ?? true) && record.sequencePath == activePath
            return [
                "sequenceId": record.sequenceId,
                "sequencePath": record.sequencePath,
                "displayName": record.displayName,
                "showFolderAtLastUse": record.showFolderAtLastUse,
                "availabilityStatus": record.availabilityStatus,
                "isActive": isActive
            ]
        }.sorted {
            string($0["displayName"]).localizedCaseInsensitiveCompare(string($1["displayName"])) == .orderedAscending
        }
        guard AnyCodable(existingRows) != AnyCodable(rows) else { return false }
        project.snapshot["projectSequences"] = AnyCodable(rows)
        return true
    }

    private func sequenceRootURL(project: ActiveProjectModel) -> URL {
        URL(fileURLWithPath: project.projectFilePath)
            .deletingLastPathComponent()
            .appendingPathComponent("sequences", isDirectory: true)
    }

    private func recordURL(project: ActiveProjectModel, sequenceID: String) -> URL {
        sequenceRootURL(project: project)
            .appendingPathComponent(sequenceID, isDirectory: true)
            .appendingPathComponent("sequence.json", isDirectory: false)
    }

    private func sequenceId(for sequencePath: String) -> String {
        let hash = Insecure.SHA1.hash(data: Data(sequencePath.utf8)).map { String(format: "%02x", $0) }.joined()
        let name = ProjectTargetContext.nameWithoutExtension(sequencePath)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return [name.isEmpty ? "sequence" : name, String(hash.prefix(10))].joined(separator: "-")
    }

    private func normalizedPath(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        return URL(fileURLWithPath: trimmed).standardizedFileURL.path
    }

    private func resolveRelinkedSequencePath(_ sequencePath: String, previousShowFolder: String, newShowFolder: String) -> String? {
        let previousPath = normalizedPath(sequencePath)
        guard !previousPath.isEmpty else { return nil }
        if pathIsWithin(previousPath, root: previousShowFolder) {
            let relativePath = String(previousPath.dropFirst(previousShowFolder.count + 1))
            let candidate = URL(fileURLWithPath: newShowFolder).appendingPathComponent(relativePath).path
            if FileManager.default.fileExists(atPath: candidate) {
                return candidate
            }
        }
        if pathIsWithin(previousPath, root: newShowFolder), FileManager.default.fileExists(atPath: previousPath) {
            return previousPath
        }

        let fileName = URL(fileURLWithPath: previousPath).lastPathComponent
        guard !fileName.isEmpty else { return nil }
        let matches = sequenceFiles(in: newShowFolder).filter { URL(fileURLWithPath: $0).lastPathComponent == fileName }
        return matches.count == 1 ? matches[0] : nil
    }

    private func resolveRelinkedMediaPath(_ mediaPath: String, previousShowFolder: String, newShowFolder: String) -> String? {
        let previousPath = normalizedPath(mediaPath)
        guard pathIsWithin(previousPath, root: previousShowFolder) else { return nil }
        let relativePath = String(previousPath.dropFirst(previousShowFolder.count + 1))
        let candidate = URL(fileURLWithPath: newShowFolder).appendingPathComponent(relativePath).path
        return FileManager.default.fileExists(atPath: candidate) ? candidate : nil
    }

    private func sequenceFiles(in showFolder: String) -> [String] {
        guard !showFolder.isEmpty,
              let enumerator = FileManager.default.enumerator(atPath: showFolder) else {
            return []
        }
        var matches: [String] = []
        for case let relativePath as String in enumerator where relativePath.hasSuffix(".xsq") {
            matches.append(URL(fileURLWithPath: showFolder).appendingPathComponent(relativePath).path)
        }
        return matches.sorted()
    }

    private func pathIsWithin(_ path: String, root: String) -> Bool {
        guard !path.isEmpty, !root.isEmpty else { return false }
        return path == root || path.hasPrefix(root + "/")
    }

    private func string(_ value: Any?) -> String {
        guard let value else { return "" }
        if let string = value as? String { return string.trimmingCharacters(in: .whitespacesAndNewlines) }
        return String(describing: value).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func dictionariesEqual(_ lhs: [String: Any], _ rhs: [String: Any]) -> Bool {
        AnyCodable(lhs) == AnyCodable(rhs)
    }

    private func bool(_ value: Any?) -> Bool {
        switch value {
        case let bool as Bool:
            return bool
        case let string as String:
            return ["true", "yes", "1"].contains(string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
        case let int as Int:
            return int != 0
        default:
            return false
        }
    }
}
