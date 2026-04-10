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
    let displayDiscovery: AssistantDisplayDiscoveryResult?
    let projectMission: AssistantProjectMissionResult?
    let phaseTransition: AssistantPhaseTransitionResult?
    let diagnostics: AssistantDiagnosticsResult?
    let userPreferenceNotes: [String]
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
                responseID: string(result["responseId"]),
                displayDiscovery: parseDisplayDiscovery(from: result["displayDiscovery"]),
                projectMission: parseProjectMission(from: result["projectMission"]),
                phaseTransition: parsePhaseTransition(from: result["phaseTransition"]),
                diagnostics: parseDiagnostics(from: result["diagnostics"]),
                userPreferenceNotes: stringArray(result["userPreferenceNotes"])
            )
        }

        let fallbackError = string(json["error"])
        if !assistantMessage.isEmpty {
            return AssistantExecutionResult(
                assistantMessage: assistantMessage,
                handledBy: string(result["handledBy"]),
                routeDecision: string(result["routeDecision"]),
                responseID: string(result["responseId"]),
                displayDiscovery: parseDisplayDiscovery(from: result["displayDiscovery"]),
                projectMission: parseProjectMission(from: result["projectMission"]),
                phaseTransition: parsePhaseTransition(from: result["phaseTransition"]),
                diagnostics: parseDiagnostics(from: result["diagnostics"]),
                userPreferenceNotes: stringArray(result["userPreferenceNotes"])
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

    private func stringArray(_ value: Any?) -> [String] {
        guard let values = value as? [Any] else { return [] }
        return values.map { string($0) }.filter { !$0.isEmpty }
    }

    private func parseDisplayDiscovery(from value: Any?) -> AssistantDisplayDiscoveryResult? {
        guard let object = value as? [String: Any] else { return nil }
        let status = DisplayDiscoveryStatus(rawValue: string(object["status"])) ?? .inProgress
        let scope = string(object["scope"]).isEmpty ? "groups_models_v1" : string(object["scope"])
        let shouldCaptureTurn = (object["shouldCaptureTurn"] as? Bool) ?? false
        let rows: [[String: Any]] = object["candidateProps"] as? [[String: Any]] ?? []
        let candidateProps: [DisplayDiscoveryCandidateModel] = rows.compactMap { row in
            let name = string(row["name"])
            guard !name.isEmpty else { return nil }
            return DisplayDiscoveryCandidateModel(
                name: name,
                type: string(row["type"]),
                reason: string(row["reason"])
            )
        }
        let insightRows: [[String: Any]] = object["insights"] as? [[String: Any]] ?? []
        let insights: [DisplayDiscoveryInsightModel] = insightRows.compactMap { row in
            let subject = string(row["subject"])
            let category = string(row["category"])
            let value = string(row["value"])
            guard !subject.isEmpty, !category.isEmpty, !value.isEmpty else { return nil }
            return DisplayDiscoveryInsightModel(
                subject: subject,
                subjectType: string(row["subjectType"]),
                category: category,
                value: value,
                rationale: string(row["rationale"]),
                targetNames: stringArray(row["targetNames"])
            )
        }
        let proposalRows: [[String: Any]] = object["tagProposals"] as? [[String: Any]] ?? []
        let tagProposals: [DisplayDiscoveryTagProposalModel] = proposalRows.compactMap { row in
            let tagName = string(row["tagName"])
            guard !tagName.isEmpty else { return nil }
            let targetNames = stringArray(row["targetNames"])
            guard !targetNames.isEmpty else { return nil }
            return DisplayDiscoveryTagProposalModel(
                tagName: tagName,
                tagDescription: string(row["tagDescription"]),
                rationale: string(row["rationale"]),
                targetNames: targetNames
            )
        }
        return AssistantDisplayDiscoveryResult(
            status: status,
            scope: scope,
            shouldCaptureTurn: shouldCaptureTurn,
            candidateProps: candidateProps,
            insights: insights,
            unresolvedBranches: stringArray(object["unresolvedBranches"]),
            resolvedBranches: stringArray(object["resolvedBranches"]),
            tagProposals: tagProposals
        )
    }

    private func parseProjectMission(from value: Any?) -> AssistantProjectMissionResult? {
        guard let object = value as? [String: Any] else { return nil }
        let result = AssistantProjectMissionResult(
            document: string(object["document"])
        )
        return result.hasContent ? result : nil
    }

    private func parsePhaseTransition(from value: Any?) -> AssistantPhaseTransitionResult? {
        guard let object = value as? [String: Any] else { return nil }
        let phaseID = WorkflowPhaseID(rawValue: string(object["phaseId"])) ?? {
            switch string(object["phaseId"]).lowercased() {
            case "setup": return .setup
            case "project_mission": return .projectMission
            case "audio_analysis": return .audioAnalysis
            case "display_discovery": return .displayDiscovery
            case "design": return .design
            case "sequencing": return .sequencing
            case "review": return .review
            default: return .projectMission
            }
        }()
        let rawPhase = string(object["phaseId"])
        guard !rawPhase.isEmpty else { return nil }
        return AssistantPhaseTransitionResult(
            phaseID: phaseID,
            reason: string(object["reason"])
        )
    }

    private func parseDiagnostics(from value: Any?) -> AssistantDiagnosticsResult? {
        guard let object = value as? [String: Any] else { return nil }
        let artifactType = string(object["artifactType"])
        guard !artifactType.isEmpty else { return nil }
        return AssistantDiagnosticsResult(
            artifactType: artifactType,
            routeDecision: string(object["routeDecision"]),
            addressedTo: string(object["addressedTo"]),
            bridgeOk: (object["bridgeOk"] as? Bool) ?? false,
            responseCode: string(object["responseCode"]),
            sequenceOpen: (object["sequenceOpen"] as? Bool) ?? false,
            planOnlyMode: (object["planOnlyMode"] as? Bool) ?? false,
            generatedAt: string(object["generatedAt"])
        )
    }
}
