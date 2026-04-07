import Foundation

enum AssistantExecutionError: LocalizedError {
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

struct AssistantExecutionResult: Sendable {
    let assistantMessage: String
    let handledBy: String
    let routeDecision: String
    let responseID: String
}

protocol AssistantExecutionService: Sendable {
    func sendConversation(
        userMessage: String,
        messages: [AssistantMessageModel],
        previousResponseID: String,
        context: AssistantContextModel
    ) async throws -> AssistantExecutionResult
}

struct LocalAssistantExecutionService: AssistantExecutionService, Sendable {
    func sendConversation(
        userMessage: String,
        messages: [AssistantMessageModel],
        previousResponseID: String,
        context: AssistantContextModel
    ) async throws -> AssistantExecutionResult {
        let payload: [String: Any] = [
            "userMessage": userMessage,
            "messages": messages.map {
                [
                    "role": $0.role == .assistant ? "assistant" : "user",
                    "content": $0.text
                ]
            },
            "previousResponseId": previousResponseID,
            "context": context.asPayload()
        ]

        let payloadData = try JSONSerialization.data(withJSONObject: payload, options: [])
        let payloadText = String(decoding: payloadData, as: UTF8.self)
        let output = try await runNodeScript(arguments: [
            AppEnvironment.nativeAssistantConversationScriptPath,
            "--payload", payloadText
        ])

        guard
            let json = try JSONSerialization.jsonObject(with: output) as? [String: Any],
            let ok = json["ok"] as? Bool,
            let result = json["result"] as? [String: Any]
        else {
            throw AssistantExecutionError.invalidResponse("Assistant returned an unexpected payload.")
        }

        let assistantMessage = string(result["assistantMessage"])
        if ok, !assistantMessage.isEmpty {
            return AssistantExecutionResult(
                assistantMessage: assistantMessage,
                handledBy: string(result["handledBy"]),
                routeDecision: string(result["routeDecision"]),
                responseID: string(result["responseId"])
            )
        }

        let fallbackError = string(json["error"])
        if !assistantMessage.isEmpty {
            return AssistantExecutionResult(
                assistantMessage: assistantMessage,
                handledBy: string(result["handledBy"]),
                routeDecision: string(result["routeDecision"]),
                responseID: string(result["responseId"])
            )
        }
        throw AssistantExecutionError.invalidResponse(fallbackError.isEmpty ? "Assistant request failed." : fallbackError)
    }

    private func runNodeScript(arguments: [String]) async throws -> Data {
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
                continuation.resume(throwing: AssistantExecutionError.processFailed(message.trimmingCharacters(in: .whitespacesAndNewlines)))
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
}
