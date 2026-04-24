import Foundation

enum ReviewExecutionError: LocalizedError {
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

struct ReviewApplyExecutionResult: Sendable {
    let summary: String
    let commandCount: Int
    let nextRevision: String
    let applyPath: String
    let sequencePath: String
    let sequenceBackupPath: String
    let renderCurrentSummary: String
    let renderCurrentError: String
    let renderFeedbackCaptured: Bool
    let renderFeedbackStatus: String
    let renderFeedbackMissingRequirements: [String]
    let practicalValidationSummary: PracticalValidationSummary?
}

struct PracticalValidationSummary: Sendable {
    let artifactType: String
    let overallOk: Bool
    let designSummary: String
    let readbackPassed: Int
    let readbackFailed: Int
    let designPassed: Int
    let designFailed: Int
}

protocol ReviewExecutionService: Sendable {
    func applyPendingWork(projectFilePath: String, appRootPath: String, endpoint: String) async throws -> ReviewApplyExecutionResult
    func restoreSequenceBackup(sequencePath: String, backupPath: String) async throws -> String
}

struct LocalReviewExecutionService: ReviewExecutionService, Sendable {
    func applyPendingWork(projectFilePath: String, appRootPath: String, endpoint: String) async throws -> ReviewApplyExecutionResult {
        let output = try await runNode(arguments: [
            AppEnvironment.nativeReviewApplyScriptPath,
            "--project-file", projectFilePath,
            "--app-root", appRootPath,
            "--endpoint", endpoint
        ])

        guard
            let json = try JSONSerialization.jsonObject(with: output) as? [String: Any],
            let ok = json["ok"] as? Bool,
            ok == true
        else {
            throw ReviewExecutionError.invalidResponse("Review apply returned an unexpected payload.")
        }

        return ReviewApplyExecutionResult(
            summary: string(json["summary"]),
            commandCount: int(json["commandCount"]),
            nextRevision: string(json["nextRevision"]),
            applyPath: string(json["applyPath"]),
            sequencePath: string(json["sequencePath"]),
            sequenceBackupPath: string(json["sequenceBackupPath"]),
            renderCurrentSummary: string(json["renderCurrentSummary"]),
            renderCurrentError: string(json["renderCurrentError"]),
            renderFeedbackCaptured: bool(json["renderFeedbackCaptured"]),
            renderFeedbackStatus: string(json["renderFeedbackStatus"]),
            renderFeedbackMissingRequirements: stringArray(json["renderFeedbackMissingRequirements"]),
            practicalValidationSummary: practicalValidationSummary(json["practicalValidationSummary"])
        )
    }

    func restoreSequenceBackup(sequencePath: String, backupPath: String) async throws -> String {
        try await Task.detached(priority: .userInitiated) {
            let sequenceURL = URL(fileURLWithPath: sequencePath)
            let backupURL = URL(fileURLWithPath: backupPath)
            guard FileManager.default.fileExists(atPath: backupURL.path) else {
                throw ReviewExecutionError.processFailed("Backup file does not exist: \(backupPath)")
            }
            try FileManager.default.createDirectory(at: sequenceURL.deletingLastPathComponent(), withIntermediateDirectories: true)
            if FileManager.default.fileExists(atPath: sequenceURL.path) {
                try FileManager.default.removeItem(at: sequenceURL)
            }
            try FileManager.default.copyItem(at: backupURL, to: sequenceURL)
            return "Backup restored to \(sequencePath)"
        }.value
    }

    private func runNode(arguments: [String]) async throws -> Data {
        try await Task.detached(priority: .userInitiated) {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = ["node"] + arguments
            process.currentDirectoryURL = URL(fileURLWithPath: AppEnvironment.repoRootPath, isDirectory: true)

            let stdout = Pipe()
            let stderr = Pipe()
            process.standardOutput = stdout
            process.standardError = stderr

            try process.run()
            process.waitUntilExit()

            let outData = stdout.fileHandleForReading.readDataToEndOfFile()
            let errData = stderr.fileHandleForReading.readDataToEndOfFile()
            if process.terminationStatus == 0 {
                return outData
            }
            let message = String(data: errData.isEmpty ? outData : errData, encoding: .utf8) ?? "Process failed"
            throw ReviewExecutionError.processFailed(message.trimmingCharacters(in: .whitespacesAndNewlines))
        }.value
    }

    private func string(_ value: Any?) -> String {
        String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func int(_ value: Any?) -> Int {
        if let num = value as? NSNumber { return num.intValue }
        return Int(String(describing: value ?? "")) ?? 0
    }

    private func bool(_ value: Any?) -> Bool {
        if let bool = value as? Bool { return bool }
        if let number = value as? NSNumber { return number.boolValue }
        return false
    }

    private func stringArray(_ value: Any?) -> [String] {
        guard let rows = value as? [Any] else { return [] }
        return rows.map { String(describing: $0).trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
    }

    private func practicalValidationSummary(_ value: Any?) -> PracticalValidationSummary? {
        guard let object = value as? [String: Any] else { return nil }
        return PracticalValidationSummary(
            artifactType: string(object["artifactType"]),
            overallOk: bool(object["overallOk"]),
            designSummary: string(object["designSummary"]),
            readbackPassed: int(object["readbackPassed"]),
            readbackFailed: int(object["readbackFailed"]),
            designPassed: int(object["designPassed"]),
            designFailed: int(object["designFailed"])
        )
    }
}
