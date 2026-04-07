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
}

protocol ReviewExecutionService: Sendable {
    func applyPendingWork(projectFilePath: String, appRootPath: String, endpoint: String) async throws -> ReviewApplyExecutionResult
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
            sequencePath: string(json["sequencePath"])
        )
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
                continuation.resume(throwing: ReviewExecutionError.processFailed(message.trimmingCharacters(in: .whitespacesAndNewlines)))
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
