import Foundation

enum XLightsSessionServiceError: LocalizedError {
    case invalidResponse(String)

    var errorDescription: String? {
        switch self {
        case let .invalidResponse(message):
            return message
        }
    }
}

protocol XLightsSessionService: Sendable {
    func loadSession(projectShowFolder: String) async throws -> XLightsSessionSnapshotModel
    func saveCurrentSequence() async throws -> String
}

struct LocalXLightsSessionService: XLightsSessionService {
    func loadSession(projectShowFolder: String) async throws -> XLightsSessionSnapshotModel {
        async let health = readJSON(from: "/health")
        async let open = readJSON(from: "/sequence/open")
        async let media = readJSON(from: "/media/current")
        async let revision = readJSON(from: "/sequence/revision")

        let healthJSON = try await health
        let openJSON = try await open
        let mediaJSON = try await media
        let revisionJSON = try await revision

        let healthData = dictionary(healthJSON["data"])
        let openData = dictionary(openJSON["data"])
        let mediaData = dictionary(mediaJSON["data"])
        let revisionData = dictionary(revisionJSON["data"])
        let sequence = dictionary(openData["sequence"])
        let showDirectory = string(mediaData["showDirectory"])
        let runtimeState = string(healthData["state"], fallback: "unknown")
        let supportedCommands = [
            "sequence.getOpen",
            "sequence.getRevision",
            "sequence.getSettings",
            "sequence.open",
            "sequence.create",
            "sequence.save",
            "media.getCurrent"
        ]

        return XLightsSessionSnapshotModel(
            runtimeState: runtimeState,
            supportedCommands: supportedCommands,
            isReachable: bool(healthData["listenerReachable"]) || runtimeState == "ready",
            isSequenceOpen: bool(openData["isOpen"]),
            sequencePath: string(sequence["path"]),
            revision: string(revisionData["revision"], fallback: string(sequence["revisionToken"])),
            mediaFile: string(mediaData["mediaFile"]),
            showDirectory: showDirectory,
            projectShowMatches: pathsMatch(showDirectory, projectShowFolder),
            saveSupported: true,
            openSupported: true,
            createSupported: true,
            closeSupported: false,
            lastSaveSummary: ""
        )
    }

    func saveCurrentSequence() async throws -> String {
        let json = try await postJSON(to: "/sequence/save", body: [:])
        let data = dictionary(json["data"])
        let saved = bool(data["saved"]) || !data.isEmpty
        let file = string(data["file"])
        guard saved || !file.isEmpty else {
            throw XLightsSessionServiceError.invalidResponse("xLights did not confirm save.")
        }
        return file.isEmpty ? "Saved current xLights sequence." : "Saved xLights sequence: \(file)"
    }

    private func readJSON(from path: String) async throws -> [String: Any] {
        guard let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + path) else {
            throw XLightsSessionServiceError.invalidResponse("Invalid xLights endpoint.")
        }
        let (data, _) = try await URLSession.shared.data(from: url)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw XLightsSessionServiceError.invalidResponse("xLights returned invalid JSON.")
        }
        return json
    }

    private func postJSON(to path: String, body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + path) else {
            throw XLightsSessionServiceError.invalidResponse("Invalid xLights endpoint.")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await URLSession.shared.data(for: request)
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw XLightsSessionServiceError.invalidResponse("xLights returned invalid JSON.")
        }
        return json
    }

    private func dictionary(_ value: Any?) -> [String: Any] {
        value as? [String: Any] ?? [:]
    }

    private func string(_ value: Any?, fallback: String = "") -> String {
        let text = String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? fallback : text
    }

    private func bool(_ value: Any?) -> Bool {
        if let b = value as? Bool { return b }
        return String(describing: value ?? "").lowercased() == "true"
    }

    private func pathsMatch(_ lhs: String, _ rhs: String) -> Bool {
        let left = normalizePath(lhs)
        let right = normalizePath(rhs)
        return !left.isEmpty && left == right
    }

    private func normalizePath(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        return URL(fileURLWithPath: trimmed).standardizedFileURL.path
    }
}
