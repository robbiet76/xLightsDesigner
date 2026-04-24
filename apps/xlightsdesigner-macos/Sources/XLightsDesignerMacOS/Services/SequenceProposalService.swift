import Foundation

struct SequenceProposalGenerationResult: Sendable {
    let summary: String
    let proposalArtifactID: String
    let intentArtifactID: String
    let warningCount: Int
}

protocol SequenceProposalService: Sendable {
    func generateProposal(projectFilePath: String, appRootPath: String, endpoint: String, prompt: String) async throws -> SequenceProposalGenerationResult
}

struct LocalSequenceProposalService: SequenceProposalService, Sendable {
    func generateProposal(projectFilePath: String, appRootPath: String, endpoint: String, prompt: String) async throws -> SequenceProposalGenerationResult {
        let output = try await runNode(arguments: [
            AppEnvironment.nativeDirectProposalScriptPath,
            "--project-file", projectFilePath,
            "--app-root", appRootPath,
            "--endpoint", endpoint,
            "--prompt", prompt
        ])

        guard
            let json = try JSONSerialization.jsonObject(with: output) as? [String: Any],
            let ok = json["ok"] as? Bool,
            ok == true
        else {
            throw ReviewExecutionError.invalidResponse("Proposal generation returned an unexpected payload.")
        }

        let warnings = (json["warnings"] as? [Any]) ?? []
        return SequenceProposalGenerationResult(
            summary: string(json["summary"]),
            proposalArtifactID: string(json["proposalArtifactId"]),
            intentArtifactID: string(json["intentArtifactId"]),
            warningCount: warnings.count
        )
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
}
