import CryptoKit
import Foundation

protocol ProjectSequenceStore: Sendable {
    @discardableResult
    func upsertActiveSequence(project: inout ActiveProjectModel, sequencePath: String, audioPath: String?) throws -> Bool
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
        let sequenceID = sequenceId(for: normalizedSequencePath)
        let sequenceName = ProjectTargetContext.nameWithoutExtension(normalizedSequencePath)
        let mediaPath = normalizedPath(audioPath ?? "")
        let existingRecord = try? loadRecord(project: project, sequenceID: sequenceID)
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

    private func recordURL(project: ActiveProjectModel, sequenceID: String) -> URL {
        URL(fileURLWithPath: project.projectFilePath)
            .deletingLastPathComponent()
            .appendingPathComponent("sequences", isDirectory: true)
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

    private func string(_ value: Any?) -> String {
        guard let value else { return "" }
        if let string = value as? String { return string.trimmingCharacters(in: .whitespacesAndNewlines) }
        return String(describing: value).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func dictionariesEqual(_ lhs: [String: Any], _ rhs: [String: Any]) -> Bool {
        AnyCodable(lhs) == AnyCodable(rhs)
    }
}
