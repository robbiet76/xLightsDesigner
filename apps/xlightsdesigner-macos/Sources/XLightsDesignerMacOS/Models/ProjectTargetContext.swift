import Foundation

struct ProjectTargetContext: Sendable, Equatable {
    let projectName: String
    let sequenceName: String
    let sequencePath: String
    let audioName: String
    let audioPath: String

    var hasSequence: Bool {
        !sequenceName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !sequencePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var hasAudio: Bool {
        !audioName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
            !audioPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    static func resolve(project: ActiveProjectModel?) -> ProjectTargetContext {
        guard let project else {
            return ProjectTargetContext(projectName: "", sequenceName: "", sequencePath: "", audioName: "", audioPath: "")
        }

        let snapshot = project.snapshot.mapValues(\.value)
        let activeSequenceRecord = try? LocalProjectSequenceStore().loadActiveSequence(project: project)
        let projectSequences = (snapshot["projectSequences"] as? [[String: Any]]) ?? []
        let activeProjectSequence = projectSequences.first(where: { bool($0["isActive"]) })
        let sequencePath = firstNonEmpty([
            string(activeSequenceRecord?.sequencePath),
            string(snapshot["sequencePathInput"]),
            string(activeProjectSequence?["sequencePath"])
        ])
        let sequenceName = firstNonEmpty([
            string(activeSequenceRecord?.displayName),
            nameWithoutExtension(sequencePath),
            string(snapshot["activeSequence"]),
            mediaLooksLikeSequence(string(snapshot["mediaPath"])) ? nameWithoutExtension(string(snapshot["mediaPath"])) : ""
        ])
        let audioPath = firstNonEmpty([
            string(activeSequenceRecord?.mediaPath),
            string(snapshot["audioPathInput"]),
            mediaLooksLikeAudio(string(snapshot["mediaPath"])) ? string(snapshot["mediaPath"]) : "",
            mediaLooksLikeAudio(project.mediaPath) ? project.mediaPath : ""
        ])
        let audioName = nameWithoutExtension(audioPath)

        return ProjectTargetContext(
            projectName: project.projectName,
            sequenceName: sequenceName,
            sequencePath: sequencePath,
            audioName: audioName,
            audioPath: audioPath
        )
    }

    static func normalizedPath(_ path: String) -> String {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        return URL(fileURLWithPath: trimmed).standardizedFileURL.path
    }

    static func nameWithoutExtension(_ path: String) -> String {
        let trimmed = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        let url = URL(fileURLWithPath: trimmed)
        let last = url.lastPathComponent
        return last.contains(".") ? url.deletingPathExtension().lastPathComponent : trimmed
    }

    private static func firstNonEmpty(_ values: [String]) -> String {
        values.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.first(where: { !$0.isEmpty }) ?? ""
    }

    private static func string(_ value: Any?) -> String {
        guard let value else { return "" }
        if let string = value as? String { return string.trimmingCharacters(in: .whitespacesAndNewlines) }
        return String(describing: value).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func bool(_ value: Any?) -> Bool {
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

    private static func mediaLooksLikeSequence(_ path: String) -> Bool {
        URL(fileURLWithPath: path.trimmingCharacters(in: .whitespacesAndNewlines)).pathExtension.lowercased() == "xsq"
    }

    private static func mediaLooksLikeAudio(_ path: String) -> Bool {
        ["mp3", "wav", "m4a", "aac", "flac", "ogg"].contains(
            URL(fileURLWithPath: path.trimmingCharacters(in: .whitespacesAndNewlines)).pathExtension.lowercased()
        )
    }
}
