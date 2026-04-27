import Foundation

struct VisualDesignAssetGenerationResult: Sendable {
    let artifactID: String
    let manifestPath: String
    let assetDir: String
    let model: String
    let currentRevisionID: String
}

protocol VisualDesignAssetGenerationService: Sendable {
    func generateVisualDesignAssetPack(
        projectFilePath: String,
        sequenceID: String,
        intentText: String,
        themeSummary: String,
        baseURL: String
    ) async throws -> VisualDesignAssetGenerationResult

    func reviseVisualDesignAssetPack(
        projectFilePath: String,
        sequenceID: String,
        revisionRequest: String,
        themeSummary: String,
        baseURL: String
    ) async throws -> VisualDesignAssetGenerationResult
}

struct LocalVisualDesignAssetGenerationService: VisualDesignAssetGenerationService, Sendable {
    func generateVisualDesignAssetPack(
        projectFilePath: String,
        sequenceID: String,
        intentText: String,
        themeSummary: String,
        baseURL: String
    ) async throws -> VisualDesignAssetGenerationResult {
        let agentConfig = try loadAgentConfig()
        guard !agentConfig.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw VisualDesignAssetGenerationError.missingAPIKey
        }

        let payloadURL = try writePayload(
            projectFilePath: projectFilePath,
            sequenceID: sequenceID,
            intentText: intentText,
            themeSummary: themeSummary,
            revisionRequest: "",
            baseURL: baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? agentConfig.baseURL : baseURL,
            model: "gpt-image-1.5"
        )
        return try await runVisualAssetScriptWithFallback(
            payloadURL: payloadURL,
            projectFilePath: projectFilePath,
            sequenceID: sequenceID,
            intentText: intentText,
            themeSummary: themeSummary,
            revisionRequest: "",
            baseURL: baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? agentConfig.baseURL : baseURL,
            apiKey: agentConfig.apiKey
        )
    }

    func reviseVisualDesignAssetPack(
        projectFilePath: String,
        sequenceID: String,
        revisionRequest: String,
        themeSummary: String,
        baseURL: String
    ) async throws -> VisualDesignAssetGenerationResult {
        let agentConfig = try loadAgentConfig()
        guard !agentConfig.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw VisualDesignAssetGenerationError.missingAPIKey
        }

        let payloadURL = try writePayload(
            projectFilePath: projectFilePath,
            sequenceID: sequenceID,
            intentText: "",
            themeSummary: themeSummary,
            revisionRequest: revisionRequest,
            baseURL: baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? agentConfig.baseURL : baseURL,
            model: "gpt-image-1.5"
        )
        return try await runVisualAssetScriptWithFallback(
            payloadURL: payloadURL,
            projectFilePath: projectFilePath,
            sequenceID: sequenceID,
            intentText: "",
            themeSummary: themeSummary,
            revisionRequest: revisionRequest,
            baseURL: baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? agentConfig.baseURL : baseURL,
            apiKey: agentConfig.apiKey
        )
    }

    private func loadAgentConfig() throws -> StoredAgentConfig {
        let fileURL = URL(fileURLWithPath: AppEnvironment.desktopStateRoot)
            .appendingPathComponent("xlightsdesigner-agent-config.json")
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(StoredAgentConfig.self, from: data)
    }

    private func writePayload(
        projectFilePath: String,
        sequenceID: String,
        intentText: String,
        themeSummary: String,
        revisionRequest: String,
        baseURL: String,
        model: String
    ) throws -> URL {
        let payload: [String: Any] = [
            "projectFilePath": projectFilePath,
            "sequenceId": sequenceID,
            "intentText": intentText,
            "themeSummary": themeSummary,
            "revisionRequest": revisionRequest,
            "visualImageConfig": [
                "enabled": true,
                "model": model,
                "baseUrl": baseURL.isEmpty ? "https://api.openai.com/v1" : baseURL,
                "size": "1536x1024",
                "quality": "medium",
                "outputFormat": "png"
            ]
        ]
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("xld-visual-design-\(UUID().uuidString).json")
        try data.write(to: url, options: .atomic)
        return url
    }

    private func runVisualAssetScriptWithFallback(
        payloadURL: URL,
        projectFilePath: String,
        sequenceID: String,
        intentText: String,
        themeSummary: String,
        revisionRequest: String,
        baseURL: String,
        apiKey: String
    ) async throws -> VisualDesignAssetGenerationResult {
        defer { try? FileManager.default.removeItem(at: payloadURL) }
        do {
            return try await runVisualAssetScript(payloadURL: payloadURL, apiKey: apiKey)
        } catch let error as VisualDesignAssetGenerationError {
            guard error.shouldFallbackFromTargetImageModel else { throw error }
            let fallbackPayloadURL = try writePayload(
                projectFilePath: projectFilePath,
                sequenceID: sequenceID,
                intentText: intentText,
                themeSummary: themeSummary,
                revisionRequest: revisionRequest,
                baseURL: baseURL,
                model: "gpt-image-1"
            )
            defer { try? FileManager.default.removeItem(at: fallbackPayloadURL) }
            return try await runVisualAssetScript(payloadURL: fallbackPayloadURL, apiKey: apiKey)
        }
    }

    private func runVisualAssetScript(payloadURL: URL, apiKey: String) async throws -> VisualDesignAssetGenerationResult {
        let output = try await runNode(
            arguments: [
                AppEnvironment.nativeVisualDesignAssetPackScriptPath,
                "--payload", payloadURL.path
            ],
            apiKey: apiKey
        )

        guard
            let json = try JSONSerialization.jsonObject(with: output) as? [String: Any],
            let ok = json["ok"] as? Bool,
            ok == true
        else {
            throw VisualDesignAssetGenerationError.invalidResponse
        }

        return result(from: json)
    }

    private func result(from json: [String: Any]) -> VisualDesignAssetGenerationResult {
        VisualDesignAssetGenerationResult(
            artifactID: string(json["artifactId"]),
            manifestPath: string(json["manifestPath"]),
            assetDir: string(json["assetDir"]),
            model: string(json["model"]),
            currentRevisionID: string(json["currentRevisionId"])
        )
    }

    private func runNode(arguments: [String], apiKey: String) async throws -> Data {
        try await Task.detached(priority: .userInitiated) {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = ["node"] + arguments
            process.currentDirectoryURL = URL(fileURLWithPath: AppEnvironment.repoRootPath, isDirectory: true)
            var environment = ProcessInfo.processInfo.environment
            environment["OPENAI_API_KEY"] = apiKey
            environment["XLD_ENABLE_LIVE_VISUAL_IMAGE_GENERATION"] = "1"
            process.environment = environment

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
            throw VisualDesignAssetGenerationError.processFailed(message.trimmingCharacters(in: .whitespacesAndNewlines))
        }.value
    }

    private func string(_ value: Any?) -> String {
        String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum VisualDesignAssetGenerationError: LocalizedError {
    case missingAPIKey
    case invalidResponse
    case processFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingAPIKey:
            return "Stored OpenAI API key is required before generating visual inspiration."
        case .invalidResponse:
            return "Visual inspiration generation returned an unexpected payload."
        case let .processFailed(message):
            return message.isEmpty ? "Visual inspiration generation failed." : message
        }
    }

    var shouldFallbackFromTargetImageModel: Bool {
        guard case let .processFailed(message) = self else { return false }
        let lower = message.lowercased()
        return lower.contains("gpt-image-1.5") &&
            (lower.contains("organization must be verified") || lower.contains("verify organization"))
    }
}

private struct StoredAgentConfig: Decodable {
    let apiKey: String
    let baseURL: String

    enum CodingKeys: String, CodingKey {
        case apiKey
        case baseURL = "baseUrl"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        apiKey = try container.decodeIfPresent(String.self, forKey: .apiKey) ?? ""
        baseURL = try container.decodeIfPresent(String.self, forKey: .baseURL) ?? "https://api.openai.com/v1"
    }
}
