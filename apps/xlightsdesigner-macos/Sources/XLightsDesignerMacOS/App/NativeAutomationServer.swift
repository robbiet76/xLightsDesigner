import Foundation
import Network

final class NativeAutomationServer: @unchecked Sendable {
    private unowned let model: AppModel
    private let queue = DispatchQueue(label: "xlightsdesigner.native-automation")
    private var listener: NWListener?

    init(model: AppModel) {
        self.model = model
    }

    func start() {
        guard listener == nil else { return }
        do {
            let params = NWParameters.tcp
            params.allowLocalEndpointReuse = true
            let listener = try NWListener(using: params, on: 49916)
            listener.newConnectionHandler = { [weak self] connection in
                self?.handle(connection: connection)
            }
            listener.start(queue: queue)
            self.listener = listener
        } catch {
            print("Native automation server failed to start: \(error)")
        }
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private func handle(connection: NWConnection) {
        connection.start(queue: queue)
        connection.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { [weak self] data, _, _, _ in
            guard let self, let data else {
                connection.cancel()
                return
            }
            Task {
                let response = await self.process(requestData: data)
                self.send(response: response, on: connection)
            }
        }
    }

    private func send(response: HTTPResponse, on connection: NWConnection) {
        let header = [
            "HTTP/1.1 \(response.statusCode) \(response.reasonPhrase)",
            "Content-Type: application/json",
            "Content-Length: \(response.body.count)",
            "Connection: close",
            "",
            ""
        ].joined(separator: "\r\n")
        let responseData = Data(header.utf8) + response.body
        connection.send(content: responseData, completion: .contentProcessed { _ in
            connection.cancel()
        })
    }

    @MainActor
    private func process(requestData: Data) async -> HTTPResponse {
        guard let request = HTTPRequest.parse(data: requestData) else {
            return .error(statusCode: 400, message: "Invalid request.")
        }

        switch (request.method, request.path) {
        case ("GET", "/health"):
            return .json(200, body: healthSnapshot())
        case ("GET", "/snapshot"):
            return .json(200, body: appSnapshot())
        case ("GET", "/assistant-snapshot"):
            return .json(200, body: assistantSnapshot())
        case ("GET", "/xlights-session"):
            return .json(200, body: xlightsSessionSnapshot())
        case ("POST", "/action"):
            guard
                let object = try? JSONSerialization.jsonObject(with: request.body) as? [String: Any],
                let action = object["action"] as? String
            else {
                return .error(statusCode: 400, message: "Missing action payload.")
            }
            return await handleAction(name: action, payload: object)
        default:
            return .error(statusCode: 404, message: "Route not found.")
        }
    }

    @MainActor
    private func handleAction(name: String, payload: [String: Any]) async -> HTTPResponse {
        switch name {
        case "ping":
            return .json(200, body: ["ok": true, "action": name])
        case "selectWorkflow":
            guard let workflowName = payload["workflow"] as? String
            else {
                return .error(statusCode: 400, message: "Unknown workflow.")
            }
            let workflow = WorkflowID.allCases.first {
                $0.rawValue.compare(workflowName, options: [.caseInsensitive]) == .orderedSame
            }
            guard let workflow else {
                return .error(statusCode: 400, message: "Unknown workflow.")
            }
            model.selectedWorkflow = workflow
            return .json(200, body: ["ok": true, "selectedWorkflow": model.selectedWorkflow.rawValue])
        case "refreshCurrentWorkflow":
            refreshCurrentWorkflow()
            return .json(200, body: ["ok": true, "selectedWorkflow": model.selectedWorkflow.rawValue])
        case "refreshAll":
            refreshAll()
            return .json(200, body: ["ok": true])
        case "refreshXLightsSession":
            model.xlightsSessionModel.refresh()
            return .json(200, body: ["ok": true])
        case "saveXLightsSequence":
            do {
                try await model.xlightsSessionModel.saveCurrentSequence()
                return .json(200, body: ["ok": true, "summary": model.xlightsSessionModel.snapshot.lastSaveSummary])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "openXLightsSequence":
            let filePath = String(payload["filePath"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !filePath.isEmpty else {
                return .error(statusCode: 400, message: "Missing filePath.")
            }
            do {
                let summary = try await model.xlightsSessionModel.openSequence(filePath: filePath, saveBeforeSwitch: true)
                return .json(200, body: ["ok": true, "summary": summary])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "createXLightsSequence":
            let filePath = String(payload["filePath"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !filePath.isEmpty else {
                return .error(statusCode: 400, message: "Missing filePath.")
            }
            let mediaFile = (payload["mediaFile"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
            let durationMs = payload["durationMs"] as? Int
            let frameMs = payload["frameMs"] as? Int
            do {
                let summary = try await model.xlightsSessionModel.createSequence(
                    filePath: filePath,
                    mediaFile: mediaFile,
                    durationMs: durationMs,
                    frameMs: frameMs,
                    saveBeforeSwitch: true
                )
                return .json(200, body: ["ok": true, "summary": summary])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "sendAssistantPrompt":
            let prompt = String(payload["prompt"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !prompt.isEmpty else {
                return .error(statusCode: 400, message: "Missing prompt.")
            }
            model.assistantModel.loadConversationIfNeeded()
            model.assistantModel.draft = prompt
            await model.assistantModel.sendDraft(context: model.assistantContext())
            return .json(200, body: [
                "ok": true,
                "messageCount": model.assistantModel.messages.count,
                "lastMessage": assistantSnapshot()["lastMessage"] ?? NSNull()
            ])
        case "applyReview":
            model.reviewScreenModel.applyPendingWork()
            return .json(200, body: ["ok": true, "isApplying": model.reviewScreenModel.isApplying])
        case "deferReview":
            model.reviewScreenModel.deferPendingWork()
            return .json(200, body: ["ok": true])
        case "acceptTimingReview":
            model.sequenceScreenModel.acceptTimingReview()
            return .json(200, body: ["ok": true])
        case "showAssistant":
            model.showAssistantPanel = true
            return .json(200, body: ["ok": true])
        case "hideAssistant":
            model.showAssistantPanel = false
            return .json(200, body: ["ok": true])
        default:
            return .error(statusCode: 400, message: "Unsupported action \(name).")
        }
    }

    @MainActor
    private func refreshCurrentWorkflow() {
        switch model.selectedWorkflow {
        case .project:
            model.projectScreenModel.loadInitialProject()
            model.xlightsSessionModel.refresh()
        case .layout:
            model.layoutScreenModel.loadLayout()
            model.xlightsSessionModel.refresh()
        case .audio:
            model.audioScreenModel.loadLibrary()
            model.xlightsSessionModel.refresh()
        case .design:
            model.designScreenModel.refresh()
            model.xlightsSessionModel.refresh()
        case .sequence:
            model.sequenceScreenModel.refresh()
            model.xlightsSessionModel.refresh()
        case .review:
            model.reviewScreenModel.refresh()
            model.xlightsSessionModel.refresh()
        case .history:
            model.historyScreenModel.loadHistory()
            model.xlightsSessionModel.refresh()
        }
    }

    @MainActor
    private func refreshAll() {
        model.projectScreenModel.loadInitialProject()
        model.layoutScreenModel.loadLayout()
        model.audioScreenModel.loadLibrary()
        model.designScreenModel.refresh()
        model.sequenceScreenModel.refresh()
        model.reviewScreenModel.refresh()
        model.historyScreenModel.loadHistory()
        model.settingsScreenModel.load()
        model.xlightsSessionModel.refresh()
    }

    @MainActor
    private func healthSnapshot() -> [String: Any] {
        [
            "ok": true,
            "automationBaseURL": AppEnvironment.nativeAutomationBaseURL,
            "xlightsOwnedAPIBaseURL": AppEnvironment.xlightsOwnedAPIBaseURL,
            "selectedWorkflow": model.selectedWorkflow.rawValue,
            "assistantVisible": model.showAssistantPanel,
            "activeProjectName": model.workspace.activeProject?.projectName ?? "",
            "activeProjectFilePath": model.workspace.activeProject?.projectFilePath ?? "",
            "xlights": xlightsSessionSnapshot(),
            "sequence": [
                "hasLiveSequence": model.sequenceScreenModel.screenModel.hasLiveSequence,
                "planOnlyMode": model.sequenceScreenModel.screenModel.planOnlyMode
            ]
        ]
    }

    @MainActor
    private func appSnapshot() -> [String: Any] {
        [
            "ok": true,
            "selectedWorkflow": model.selectedWorkflow.rawValue,
            "assistantVisible": model.showAssistantPanel,
            "workspace": workspaceSnapshot(),
            "xlights": xlightsSessionSnapshot(),
            "assistant": assistantSnapshot(),
            "pages": [
                "project": projectSnapshot(),
                "layout": layoutSnapshot(),
                "audio": audioSnapshot(),
                "design": designSnapshot(),
                "sequence": sequenceSnapshot(),
                "review": reviewSnapshot(),
                "history": historySnapshot()
            ]
        ]
    }

    @MainActor
    private func workspaceSnapshot() -> [String: Any] {
        [
            "activeProjectName": model.workspace.activeProject?.projectName ?? "",
            "projectFilePath": model.workspace.activeProject?.projectFilePath ?? "",
            "showFolder": model.workspace.activeProject?.showFolder ?? "",
            "banner": model.workspace.projectBanner?.text ?? ""
        ]
    }

    @MainActor
    private func assistantSnapshot() -> [String: Any] {
        let messages = model.assistantModel.messages.map { message in
            [
                "id": message.id,
                "role": message.role.rawValue,
                "text": message.text,
                "timestamp": message.timestamp,
                "handledBy": message.handledBy ?? "",
                "routeDecision": message.routeDecision ?? "",
                "displayName": message.displayName ?? ""
            ]
        }
        return [
            "visible": model.showAssistantPanel,
            "draft": model.assistantModel.draft,
            "isSending": model.assistantModel.isSending,
            "messageCount": messages.count,
            "messages": messages,
            "lastMessage": messages.last ?? [:]
        ]
    }

    @MainActor
    private func xlightsSessionSnapshot() -> [String: Any] {
        let snapshot = model.xlightsSessionModel.snapshot
        return [
            "runtimeState": snapshot.runtimeState,
            "supportedCommands": snapshot.supportedCommands,
            "isReachable": snapshot.isReachable,
            "isSequenceOpen": snapshot.isSequenceOpen,
            "sequencePath": snapshot.sequencePath,
            "revision": snapshot.revision,
            "mediaFile": snapshot.mediaFile,
            "showDirectory": snapshot.showDirectory,
            "projectShowMatches": snapshot.projectShowMatches,
            "sequenceType": snapshot.sequenceType,
            "durationMs": snapshot.durationMs,
            "frameMs": snapshot.frameMs,
            "dirtyState": snapshot.dirtyState,
            "dirtyStateReason": snapshot.dirtyStateReason,
            "saveSupported": snapshot.saveSupported,
            "openSupported": snapshot.openSupported,
            "createSupported": snapshot.createSupported,
            "closeSupported": snapshot.closeSupported,
            "lastSaveSummary": snapshot.lastSaveSummary
        ]
    }

    @MainActor
    private func projectSnapshot() -> [String: Any] {
        let screen = model.projectScreenModel.screenModel
        return [
            "title": screen.header.title,
            "subtitle": screen.header.subtitle,
            "statusBadge": screen.header.statusBadge,
            "activeProjectName": screen.summary?.projectName ?? "",
            "projectFolderPath": screen.summary?.projectFilePath ?? "",
            "showFolder": screen.summary?.showFolderSummary ?? "",
            "readiness": screen.summary?.readiness.rawValue ?? "",
            "readinessExplanation": screen.summary?.readinessExplanation ?? "",
            "canCreate": screen.actions.canCreate,
            "canOpen": screen.actions.canOpen,
            "readinessItems": screen.readinessItems.map { ["label": $0.label, "value": $0.value, "status": $0.status.rawValue] },
            "hints": screen.hints.map(\.text),
            "banners": screen.banners.map { ["text": $0.text, "level": $0.level.rawValue] }
        ]
    }

    @MainActor
    private func layoutSnapshot() -> [String: Any] {
        let screen = model.layoutScreenModel.screenModel
        let selected = switch screen.selectedTarget {
        case .none:
            [:]
        case let .selected(target):
            [
                "identity": target.identity,
                "type": target.type,
                "layoutGroup": target.layoutGroup,
                "readinessState": target.readinessState.rawValue,
                "reason": target.reason,
                "assignedTags": target.assignedTags.map { ["name": $0.name, "description": $0.description, "color": $0.color.displayName] },
                "downstreamEffectSummary": target.downstreamEffectSummary
            ]
        case let .multi(selection):
            [
                "selectionCount": selection.selectionCount,
                "commonTags": selection.commonTags.map { ["name": $0.name, "description": $0.description, "color": $0.color.displayName] },
                "mixedTagCount": selection.mixedTagCount
            ]
        case let .error(message):
            ["error": message]
        }
        return [
            "title": screen.header.title,
            "subtitle": screen.header.subtitle,
            "activeProjectName": screen.header.activeProjectName,
            "sourceSummary": screen.header.sourceSummary,
            "targetCount": screen.rows.count,
            "readinessState": screen.readinessSummary.state.rawValue,
            "readyCount": screen.readinessSummary.readyCount,
            "unresolvedCount": screen.readinessSummary.unresolvedCount,
            "orphanCount": screen.readinessSummary.orphanCount,
            "selectedTarget": selected
        ]
    }

    @MainActor
    private func audioSnapshot() -> [String: Any] {
        let header = model.audioScreenModel.header
        return [
            "title": header.title,
            "subtitle": header.subtitle,
            "totalCount": header.totalCount,
            "completeCount": header.completeCount,
            "partialCount": header.partialCount,
            "needsReviewCount": header.needsReviewCount,
            "failedCount": header.failedCount,
            "filteredRowCount": model.audioScreenModel.filteredRows.count
        ]
    }

    @MainActor
    private func designSnapshot() -> [String: Any] {
        let screen = model.designScreenModel.screenModel
        return [
            "title": screen.title,
            "subtitle": screen.subtitle,
            "briefSummary": screen.summary.briefSummary,
            "proposalSummary": screen.summary.proposalSummary,
            "banners": screen.banners.map { ["text": $0.text, "state": $0.state.rawValue] }
        ]
    }

    @MainActor
    private func sequenceSnapshot() -> [String: Any] {
        let screen = model.sequenceScreenModel.screenModel
        return [
            "title": screen.title,
            "subtitle": screen.subtitle,
            "hasLiveSequence": screen.hasLiveSequence,
            "planOnlyMode": screen.planOnlyMode,
            "activeSequenceName": screen.activeSequence.activeSequenceName,
            "translationSource": screen.overview.translationSource,
            "itemCount": screen.overview.itemCount,
            "commandCount": screen.overview.commandCount,
            "warningCount": screen.overview.warningCount,
            "validationIssueCount": screen.overview.validationIssueCount,
            "selectedRowSummary": model.sequenceScreenModel.selectedRow?.summary ?? "",
            "timingReviewNeedsReview": screen.timingReview.needsReview,
            "timingReviewCount": screen.timingReview.rows.count,
            "banners": screen.banners.map { ["text": $0.text, "state": $0.state.rawValue] }
        ]
    }

    @MainActor
    private func reviewSnapshot() -> [String: Any] {
        let screen = model.reviewScreenModel.screenModel
        return [
            "title": screen.title,
            "subtitle": screen.subtitle,
            "pendingSummary": screen.pendingSummary.pendingSummary,
            "targetSequenceSummary": screen.pendingSummary.targetSequenceSummary,
            "canApply": screen.actions.canApply,
            "canDefer": screen.actions.canDefer,
            "isApplying": model.reviewScreenModel.isApplying,
            "banners": screen.banners.map { ["text": $0.text, "state": $0.state.rawValue] }
        ]
    }

    @MainActor
    private func historySnapshot() -> [String: Any] {
        let screen = model.historyScreenModel.screenModel
        let selectedSummary: String
        switch screen.selectedEvent {
        case let .selected(event):
            selectedSummary = event.changeSummary
        case let .none(text):
            selectedSummary = text
        case let .error(text):
            selectedSummary = text
        }
        return [
            "title": screen.header.title,
            "subtitle": screen.header.subtitle,
            "rowCount": screen.rows.count,
            "selectedSummary": selectedSummary,
            "banners": screen.banners.map { ["text": $0.text, "state": $0.state.rawValue] }
        ]
    }
}

private struct HTTPRequest {
    let method: String
    let path: String
    let body: Data

    static func parse(data: Data) -> HTTPRequest? {
        guard let text = String(data: data, encoding: .utf8) else { return nil }
        let parts = text.components(separatedBy: "\r\n\r\n")
        guard let head = parts.first else { return nil }
        let bodyText = parts.dropFirst().joined(separator: "\r\n\r\n")
        let lines = head.components(separatedBy: "\r\n")
        guard let requestLine = lines.first else { return nil }
        let requestParts = requestLine.split(separator: " ")
        guard requestParts.count >= 2 else { return nil }
        return HTTPRequest(
            method: String(requestParts[0]),
            path: String(requestParts[1]),
            body: Data(bodyText.utf8)
        )
    }
}

private struct HTTPResponse {
    let statusCode: Int
    let reasonPhrase: String
    let body: Data

    static func json(_ statusCode: Int, body: [String: Any]) -> HTTPResponse {
        let data = (try? JSONSerialization.data(withJSONObject: body, options: [.prettyPrinted])) ?? Data("{}".utf8)
        return HTTPResponse(statusCode: statusCode, reasonPhrase: reason(for: statusCode), body: data)
    }

    static func error(statusCode: Int, message: String) -> HTTPResponse {
        json(statusCode, body: ["ok": false, "error": message])
    }

    private static func reason(for statusCode: Int) -> String {
        switch statusCode {
        case 200: return "OK"
        case 400: return "Bad Request"
        case 404: return "Not Found"
        default: return "Error"
        }
    }
}
