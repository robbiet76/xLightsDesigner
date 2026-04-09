import Foundation

struct AssistantUserPreferenceNote: Codable, Hashable, Sendable {
    let text: String
    let recordedAt: String
}

struct AssistantUserProfile: Codable, Sendable {
    var version: Int = 1
    var preferenceNotes: [AssistantUserPreferenceNote] = []
}

protocol AssistantUserProfileStore: Sendable {
    func load() throws -> AssistantUserProfile
    func addPreferenceNotes(_ notes: [String], recordedAt: String) throws
    func clear() throws
}

struct LocalAssistantUserProfileStore: AssistantUserProfileStore {
    func load() throws -> AssistantUserProfile {
        let fileURL = storageURL()
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return AssistantUserProfile()
        }
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(AssistantUserProfile.self, from: data)
    }

    func addPreferenceNotes(_ notes: [String], recordedAt: String) throws {
        let normalized = notes
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        guard !normalized.isEmpty else { return }

        var profile = (try? load()) ?? AssistantUserProfile()
        for note in normalized {
            addOrMerge(note: note, recordedAt: recordedAt, profile: &profile)
        }
        profile.preferenceNotes = dedupe(profile.preferenceNotes)
        if profile.preferenceNotes.count > 12 {
            profile.preferenceNotes = Array(profile.preferenceNotes.suffix(12))
        }
        try save(profile)
    }

    func clear() throws {
        let fileURL = storageURL()
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        try FileManager.default.removeItem(at: fileURL)
    }

    private func addOrMerge(note: String, recordedAt: String, profile: inout AssistantUserProfile) {
        let normalizedIncoming = canonicalPreferenceText(note)
        if let index = profile.preferenceNotes.firstIndex(where: {
            canonicalPreferenceText($0.text) == normalizedIncoming ||
            canonicalPreferenceText($0.text).contains(normalizedIncoming) ||
            normalizedIncoming.contains(canonicalPreferenceText($0.text))
        }) {
            let existing = profile.preferenceNotes[index]
            let preferredText = existing.text.count <= note.count ? existing.text : note
            profile.preferenceNotes[index] = AssistantUserPreferenceNote(text: preferredText, recordedAt: recordedAt)
            return
        }
        profile.preferenceNotes.append(AssistantUserPreferenceNote(text: note, recordedAt: recordedAt))
    }

    private func dedupe(_ notes: [AssistantUserPreferenceNote]) -> [AssistantUserPreferenceNote] {
        var merged: [AssistantUserPreferenceNote] = []
        for note in notes {
            let normalizedIncoming = canonicalPreferenceText(note.text)
            if let index = merged.firstIndex(where: {
                canonicalPreferenceText($0.text) == normalizedIncoming ||
                canonicalPreferenceText($0.text).contains(normalizedIncoming) ||
                normalizedIncoming.contains(canonicalPreferenceText($0.text))
            }) {
                let existing = merged[index]
                let preferredText = existing.text.count <= note.text.count ? existing.text : note.text
                merged[index] = AssistantUserPreferenceNote(text: preferredText, recordedAt: note.recordedAt)
            } else {
                merged.append(note)
            }
        }
        return merged
    }

    private func canonicalPreferenceText(_ text: String) -> String {
        text
            .lowercased()
            .replacingOccurrences(of: "^user\\s+(prefers|wants)\\s+", with: "", options: .regularExpression)
            .replacingOccurrences(of: "^preferred workflow:\\s+", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func storageURL() -> URL {
        URL(fileURLWithPath: AppEnvironment.desktopStateRoot, isDirectory: true)
            .appendingPathComponent("assistant", isDirectory: true)
            .appendingPathComponent("profile.json", isDirectory: false)
    }

    private func save(_ profile: AssistantUserProfile) throws {
        let fileURL = storageURL()
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(profile)
        try data.write(to: fileURL, options: .atomic)
    }
}
