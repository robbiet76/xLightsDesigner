import Foundation

enum AudioExecutionError: LocalizedError {
    case processFailed(String)
    case invalidResponse(String)

    var errorDescription: String? {
        switch self {
        case let .processFailed(message):
            return message
        case let .invalidResponse(message):
            return message
        }
    }
}

protocol AudioExecutionService: Sendable {
    func analyzeTrack(filePath: String, appRootPath: String, mode: String) async throws -> AudioTrackExecutionResult
    func analyzeFolder(folderPath: String, appRootPath: String, recursive: Bool, mode: String) async throws -> AudioFolderExecutionResult
    func confirmTrackIdentity(contentFingerprint: String, title: String, artist: String, appRootPath: String) async throws
}

struct AudioTrackExecutionResult {
    let contentFingerprint: String
    let displayName: String
    let artist: String
    let status: String
    let summary: String
}

struct AudioFolderExecutionResult {
    let batchLabel: String
    let processedCount: Int
    let completeCount: Int
    let partialCount: Int
    let needsReviewCount: Int
    let failedCount: Int
    let topIssueCategories: String
    let followUpActionText: String
}

struct LocalAudioExecutionService: AudioExecutionService, Sendable {
    func analyzeTrack(filePath: String, appRootPath: String, mode: String) async throws -> AudioTrackExecutionResult {
        let output = try await runNodeScript(
            scriptPath: AppEnvironment.nativeAnalyzeTrackScriptPath,
            arguments: [
                "--file", filePath,
                "--app-root", appRootPath,
                "--mode", mode
            ]
        )
        guard
            let json = try JSONSerialization.jsonObject(with: output) as? [String: Any],
            let trackRecord = json["trackRecord"] as? [String: Any],
            let track = trackRecord["track"] as? [String: Any],
            let quality = json["quality"] as? [String: Any]
        else {
            throw AudioExecutionError.invalidResponse("Track analysis returned an unexpected payload.")
        }

        let summary = string(quality["summary"])
        let status = string((quality["readiness"] as? [String: Any])?["overall"])
        return AudioTrackExecutionResult(
            contentFingerprint: string(json["contentFingerprint"]),
            displayName: string(track["displayName"]),
            artist: string(track["artist"]),
            status: status,
            summary: summary
        )
    }

    func analyzeFolder(folderPath: String, appRootPath: String, recursive: Bool, mode: String) async throws -> AudioFolderExecutionResult {
        var args = [
            AppEnvironment.batchAnalyzeFolderScriptPath,
            "--app-root", appRootPath,
            "--folder", folderPath,
            "--mode", mode
        ]
        if recursive {
            args.append("--recursive")
        }
        let output = try await runNode(arguments: args)
        guard
            let json = try JSONSerialization.jsonObject(with: output) as? [String: Any],
            let review = json["review"] as? [String: Any],
            let summary = review["summary"] as? [String: Any]
        else {
            throw AudioExecutionError.invalidResponse("Folder analysis returned an unexpected payload.")
        }

        let topIssues = (review["topLevelIssueCounts"] as? [String: Any] ?? [:])
            .sorted { $0.key < $1.key }
            .prefix(3)
            .map { "\($0.key) \(Int(truncating: ($0.value as? NSNumber) ?? 0))" }
            .joined(separator: ", ")

        return AudioFolderExecutionResult(
            batchLabel: URL(fileURLWithPath: folderPath).lastPathComponent,
            processedCount: int(summary["processed"]),
            completeCount: int(summary["complete"]),
            partialCount: int(summary["partial"]),
            needsReviewCount: int(summary["escalated"]),
            failedCount: int(summary["failed"]),
            topIssueCategories: topIssues.isEmpty ? "None" : topIssues,
            followUpActionText: "Review batch results"
        )
    }

    func confirmTrackIdentity(contentFingerprint: String, title: String, artist: String, appRootPath: String) async throws {
        _ = try await runNodeScript(
            scriptPath: AppEnvironment.nativeUpdateTrackIdentityScriptPath,
            arguments: [
                "--content-fingerprint", contentFingerprint,
                "--title", title,
                "--artist", artist,
                "--app-root", appRootPath
            ]
        )
    }

    private func runNodeScript(scriptPath: String, arguments: [String]) async throws -> Data {
        try await runNode(arguments: [scriptPath] + arguments)
    }

    private func runNode(arguments: [String]) async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = ["node"] + arguments
            process.currentDirectoryURL = URL(fileURLWithPath: AppEnvironment.repoRootPath, isDirectory: true)

            let stdout = Pipe()
            let stderr = Pipe()
            process.standardOutput = stdout
            process.standardError = stderr

            process.terminationHandler = { proc in
                let outData = stdout.fileHandleForReading.readDataToEndOfFile()
                let errData = stderr.fileHandleForReading.readDataToEndOfFile()
                if proc.terminationStatus == 0 {
                    continuation.resume(returning: outData)
                    return
                }
                let message = String(data: errData.isEmpty ? outData : errData, encoding: .utf8) ?? "Process failed"
                continuation.resume(throwing: AudioExecutionError.processFailed(message.trimmingCharacters(in: .whitespacesAndNewlines)))
            }

            do {
                try process.run()
            } catch {
                continuation.resume(throwing: error)
            }
        }
    }

    private func string(_ value: Any?) -> String {
        String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func int(_ value: Any?) -> Int {
        if let num = value as? NSNumber { return num.intValue }
        return Int(String(describing: value ?? "")) ?? 0
    }
}
