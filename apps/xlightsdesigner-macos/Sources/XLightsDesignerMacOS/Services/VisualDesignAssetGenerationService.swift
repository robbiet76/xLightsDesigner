import Foundation

struct VisualDesignAssetGenerationResult: Sendable {
    let artifactID: String
    let manifestPath: String
    let assetDir: String
    let model: String
}

protocol VisualDesignAssetGenerationService: Sendable {
    func generateVisualDesignAssetPack(
        projectFilePath: String,
        sequenceID: String,
        intentText: String,
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
            baseURL: baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? agentConfig.baseURL : baseURL
        )
        defer { try? FileManager.default.removeItem(at: payloadURL) }

        let output = try await runNode(
            arguments: [
                AppEnvironment.nativeVisualDesignAssetPackScriptPath,
                "--payload", payloadURL.path
            ],
            apiKey: agentConfig.apiKey
        )

        guard
            let json = try JSONSerialization.jsonObject(with: output) as? [String: Any],
            let ok = json["ok"] as? Bool,
            ok == true
        else {
            throw VisualDesignAssetGenerationError.invalidResponse
        }

        return VisualDesignAssetGenerationResult(
            artifactID: string(json["artifactId"]),
            manifestPath: string(json["manifestPath"]),
            assetDir: string(json["assetDir"]),
            model: string(json["model"])
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
        baseURL: String
    ) throws -> URL {
        let payload: [String: Any] = [
            "projectFilePath": projectFilePath,
            "sequenceId": sequenceID,
            "intentText": intentText,
            "themeSummary": themeSummary,
            "visualImageConfig": [
                "enabled": true,
                "model": "gpt-image-2",
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
