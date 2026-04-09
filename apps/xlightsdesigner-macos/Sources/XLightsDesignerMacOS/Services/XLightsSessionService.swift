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
    func renderCurrentSequence() async throws -> String
    func openSequence(filePath: String, saveBeforeSwitch: Bool) async throws -> String
    func createSequence(filePath: String, mediaFile: String?, durationMs: Int?, frameMs: Int?, saveBeforeSwitch: Bool) async throws -> String
}

struct LocalXLightsSessionService: XLightsSessionService {
    func loadSession(projectShowFolder: String) async throws -> XLightsSessionSnapshotModel {
        async let health = readJSON(from: "/health")
        async let open = readJSON(from: "/sequence/open")
        async let media = readJSON(from: "/media/current")
        async let revision = readJSON(from: "/sequence/revision")
        async let settings = readJSON(from: "/sequence/settings")
        async let layoutSettings = readJSONAllowing404(from: "/layout/settings")
        async let layoutModels = readJSONAllowing404(from: "/layout/models")
        async let groupMemberships = readJSONAllowing404(from: "/layout/group-members")

        let healthJSON = try await health
        let openJSON = try await open
        let mediaJSON = try await media
        let revisionJSON = try await revision
        let settingsJSON = try await settings
        let layoutSettingsJSON = try await layoutSettings
        let layoutModelsJSON = try await layoutModels
        let groupMembershipsJSON = try await groupMemberships

        let healthData = dictionary(healthJSON["data"])
        let openData = dictionary(openJSON["data"])
        let mediaData = dictionary(mediaJSON["data"])
        let revisionData = dictionary(revisionJSON["data"])
        let settingsData = dictionary(settingsJSON["data"])
        let layoutSettingsData = dictionary(layoutSettingsJSON["data"])
        let sequence = dictionary(openData["sequence"])
        let showDirectory = string(mediaData["showDirectory"])
        let runtimeState = string(healthData["state"], fallback: "unknown")
        let layoutSignature = buildLayoutSignature(modelsJSON: layoutModelsJSON, groupMembershipsJSON: groupMembershipsJSON)
        let hasUnsavedLayoutChanges = optionalBool(layoutSettingsData["hasUnsavedLayoutChanges"])
        let hasUnsavedRgbEffectsChanges = optionalBool(layoutSettingsData["hasUnsavedRgbEffectsChanges"])
        let hasUnsavedNetworkChanges = optionalBool(layoutSettingsData["hasUnsavedNetworkChanges"])
        let rgbEffectsFile = string(layoutSettingsData["rgbEffectsFile"])
        let rgbEffectsModifiedAt = string(layoutSettingsData["rgbEffectsModifiedAt"])
        let networksFile = string(layoutSettingsData["networksFile"])
        let networksModifiedAt = string(layoutSettingsData["networksModifiedAt"])
        let layoutDirtyReason: String
        if hasUnsavedLayoutChanges == nil {
            layoutDirtyReason = "Owned xLights API does not currently expose layout save state."
        } else if hasUnsavedLayoutChanges == true {
            var parts: [String] = []
            if hasUnsavedRgbEffectsChanges == true { parts.append("layout/models/views") }
            if hasUnsavedNetworkChanges == true { parts.append("network setup") }
            layoutDirtyReason = parts.isEmpty
                ? "Current xLights layout has unsaved changes."
                : "Unsaved xLights layout changes: \(parts.joined(separator: ", "))."
        } else {
            layoutDirtyReason = "Current xLights layout is saved."
        }
        let supportedCommands = [
            "sequence.getOpen",
            "sequence.getRevision",
            "sequence.getSettings",
            "sequence.open",
            "sequence.create",
            "sequence.renderCurrent",
            "sequence.save",
            "media.getCurrent"
        ]

        let hasUnsavedChanges = optionalBool(settingsData["hasUnsavedChanges"])
        let dirtyState = hasUnsavedChanges == nil ? "unknown" : (hasUnsavedChanges == true ? "dirty" : "clean")
        let dirtyReason = hasUnsavedChanges == nil
            ? "Owned xLights API does not currently expose unsaved sequence state."
            : (hasUnsavedChanges == true ? "Current xLights sequence has unsaved changes." : "Current xLights sequence is saved.")

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
            layoutSignature: layoutSignature,
            hasUnsavedLayoutChanges: hasUnsavedLayoutChanges,
            hasUnsavedRgbEffectsChanges: hasUnsavedRgbEffectsChanges,
            hasUnsavedNetworkChanges: hasUnsavedNetworkChanges,
            rgbEffectsFile: rgbEffectsFile,
            rgbEffectsModifiedAt: rgbEffectsModifiedAt,
            networksFile: networksFile,
            networksModifiedAt: networksModifiedAt,
            layoutDirtyStateReason: layoutDirtyReason,
            sequenceType: string(settingsData["sequenceType"], fallback: "unknown"),
            durationMs: int(settingsData["durationMs"]),
            frameMs: int(settingsData["frameMs"]),
            dirtyState: dirtyState,
            dirtyStateReason: dirtyReason,
            hasUnsavedChanges: hasUnsavedChanges,
            saveSupported: true,
            renderSupported: true,
            openSupported: true,
            createSupported: true,
            closeSupported: false,
            lastSaveSummary: "",
            lastRenderSummary: ""
        )
    }

    func saveCurrentSequence() async throws -> String {
        let json = try await postQueuedJSON(to: "/sequence/save", body: [:], command: "sequence.save")
        let data = dictionary(json["data"])
        let saved = bool(data["saved"]) || !data.isEmpty
        let file = string(data["file"])
        guard saved || !file.isEmpty else {
            throw XLightsSessionServiceError.invalidResponse("xLights did not confirm save.")
        }
        return file.isEmpty ? "Saved current xLights sequence." : "Saved xLights sequence: \(file)"
    }

    func renderCurrentSequence() async throws -> String {
        let json = try await postQueuedJSON(to: "/sequence/render-current", body: [:], command: "sequence.renderCurrent")
        let data = dictionary(json["data"])
        let rendered = bool(data["rendered"]) || !data.isEmpty
        let sequence = dictionary(data["sequence"])
        let file = string(sequence["path"])
        guard rendered else {
            throw XLightsSessionServiceError.invalidResponse("xLights did not confirm render.")
        }
        return file.isEmpty ? "Rendered current xLights sequence." : "Rendered xLights sequence: \(file)"
    }

    func openSequence(filePath: String, saveBeforeSwitch: Bool) async throws -> String {
        let normalizedPath = normalizePath(filePath)
        guard !normalizedPath.isEmpty else {
            throw XLightsSessionServiceError.invalidResponse("Sequence path is required.")
        }
        if saveBeforeSwitch {
            _ = try? await saveCurrentSequence()
        }
        _ = try await postQueuedJSON(to: "/sequence/open", body: [
            "file": normalizedPath,
            "force": true,
            "promptIssues": false
        ], command: "sequence.open")
        return "Opened xLights sequence: \(normalizedPath)"
    }

    func createSequence(filePath: String, mediaFile: String?, durationMs: Int?, frameMs: Int?, saveBeforeSwitch: Bool) async throws -> String {
        let normalizedPath = normalizePath(filePath)
        guard !normalizedPath.isEmpty else {
            throw XLightsSessionServiceError.invalidResponse("Sequence path is required.")
        }
        let fileURL = URL(fileURLWithPath: normalizedPath)
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if saveBeforeSwitch {
            _ = try? await saveCurrentSequence()
        }
        var body: [String: Any] = ["file": normalizedPath]
        let media = string(mediaFile)
        if !media.isEmpty { body["mediaFile"] = media }
        if let durationMs { body["durationMs"] = durationMs }
        if let frameMs { body["frameMs"] = frameMs }
        _ = try await postQueuedJSON(to: "/sequence/create", body: body, command: "sequence.create")
        return "Created xLights sequence: \(normalizedPath)"
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

    private func readJSONAllowing404(from path: String) async throws -> [String: Any] {
        guard let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + path) else {
            throw XLightsSessionServiceError.invalidResponse("Invalid xLights endpoint.")
        }
        let (data, response) = try await URLSession.shared.data(from: url)
        if let http = response as? HTTPURLResponse, http.statusCode == 404 {
            return [:]
        }
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

    private func postQueuedJSON(to path: String, body: [String: Any], command: String) async throws -> [String: Any] {
        let json = try await postJSON(to: path, body: body)
        if bool(json["ok"]) == false {
            let error = dictionary(json["error"])
            let code = string(error["code"], fallback: "XLIGHTS_REQUEST_FAILED")
            let message = string(error["message"], fallback: "\(command) failed")
            throw XLightsSessionServiceError.invalidResponse("\(command) failed (\(code)): \(message)")
        }

        let data = dictionary(json["data"])
        let jobID = string(data["jobId"])
        if !jobID.isEmpty {
            return try await waitForOwnedJobResult(jobID: jobID, command: command)
        }

        if !data.isEmpty {
            return json
        }

        throw XLightsSessionServiceError.invalidResponse("xLights \(command) returned no data.")
    }

    private func waitForOwnedJobResult(jobID: String, command: String, attempts: Int = 180, delayMs: UInt64 = 500) async throws -> [String: Any] {
        for _ in 0..<attempts {
            let settled = try await readJSON(from: "/jobs/get?jobId=\(jobID.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? jobID)")
            let data = dictionary(settled["data"])
            let state = string(data["state"]).lowercased()
            if state == "queued" || state == "running" {
                try await Task.sleep(nanoseconds: delayMs * 1_000_000)
                continue
            }
            let result = dictionary(data["result"])
            guard !result.isEmpty else {
                throw XLightsSessionServiceError.invalidResponse("Owned xLights job for \(command) returned no result payload.")
            }
            if state == "failed" || bool(result["ok"]) == false {
                let error = dictionary(result["error"])
                let code = string(error["code"], fallback: "OWNED_JOB_FAILED")
                let message = string(error["message"], fallback: "\(command) failed")
                throw XLightsSessionServiceError.invalidResponse("\(command) failed (\(code)): \(message)")
            }
            return result
        }
        throw XLightsSessionServiceError.invalidResponse("Timed out waiting for owned xLights job \(jobID) (\(command)).")
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

    private func optionalBool(_ value: Any?) -> Bool? {
        if value == nil { return nil }
        if let b = value as? Bool { return b }
        let text = String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if text == "true" { return true }
        if text == "false" { return false }
        return nil
    }

    private func int(_ value: Any?) -> Int {
        if let number = value as? Int { return number }
        if let number = value as? NSNumber { return number.intValue }
        return Int(String(describing: value ?? "")) ?? 0
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

    private func buildLayoutSignature(modelsJSON: [String: Any], groupMembershipsJSON: [String: Any]) -> String {
        let modelRows = (dictionary(modelsJSON["data"])["models"] as? [[String: Any]] ?? [])
            .map { row in
                [
                    string(row["name"]),
                    string(row["displayAs"]),
                    String(describing: row["nodeCount"] ?? ""),
                    String(describing: row["positionX"] ?? ""),
                    String(describing: row["positionY"] ?? ""),
                    String(describing: row["positionZ"] ?? "")
                ].joined(separator: "|")
            }
            .sorted()
        let groupRows = (dictionary(groupMembershipsJSON["data"])["groups"] as? [[String: Any]] ?? [])
            .map { row in
                let groupName = string(row["groupName"])
                let flattenedAll = (row["flattenedAllMembers"] as? [[String: Any]] ?? [])
                    .map { string($0["name"]) }
                    .sorted()
                    .joined(separator: ",")
                return "\(groupName)|\(flattenedAll)"
            }
            .sorted()
        return (modelRows + groupRows).joined(separator: "\n")
    }
}
