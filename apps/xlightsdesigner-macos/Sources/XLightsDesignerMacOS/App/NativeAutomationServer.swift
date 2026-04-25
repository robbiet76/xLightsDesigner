import Foundation
import Network

final class NativeAutomationServer: @unchecked Sendable {
    private unowned let model: AppModel
    private let projectService: ProjectService
    private let queue = DispatchQueue(label: "xlightsdesigner.native-automation")
    private var listener: NWListener?

    init(model: AppModel, projectService: ProjectService = LocalProjectService()) {
        self.model = model
        self.projectService = projectService
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
        case ("GET", "/sequencer-validation-snapshot"):
            return .json(200, body: await sequencerValidationSnapshot())
        case ("GET", "/render-feedback-snapshot"):
            return .json(200, body: await renderFeedbackSnapshot())
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
            model.clearWorkflowPhaseOverride()
            model.selectedWorkflow = workflow
            refreshCurrentWorkflow()
            return .json(200, body: ["ok": true, "selectedWorkflow": model.selectedWorkflow.rawValue])
        case "openProject":
            let filePath = String(payload["filePath"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !filePath.isEmpty else {
                return .error(statusCode: 400, message: "Missing filePath.")
            }
            do {
                let project = try projectService.openProject(filePath: filePath)
                model.workspace.setProject(project)
                model.workspace.projectBanner = ProjectBannerModel(id: "opened", level: .ready, text: "Opened \(project.projectName).")
                refreshAll()
                return .json(200, body: [
                    "ok": true,
                    "projectName": project.projectName,
                    "projectFilePath": project.projectFilePath
                ])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "refreshCurrentWorkflow":
            refreshCurrentWorkflow()
            return .json(200, body: ["ok": true, "selectedWorkflow": model.selectedWorkflow.rawValue])
        case "refreshAll":
            refreshAll()
            return .json(200, body: ["ok": true])
        case "refreshXLightsSession":
            await model.xlightsSessionModel.refreshNow()
            return .json(200, body: [
                "ok": true,
                "xlights": xlightsSessionSnapshot()
            ])
        case "saveXLightsSequence":
            do {
                try await model.xlightsSessionModel.saveCurrentSequence()
                return .json(200, body: ["ok": true, "summary": model.xlightsSessionModel.snapshot.lastSaveSummary])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "renderXLightsSequence":
            do {
                try await model.xlightsSessionModel.renderCurrentSequence()
                return .json(200, body: ["ok": true, "summary": model.xlightsSessionModel.snapshot.lastRenderSummary])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "openXLightsSequence":
            let filePath = String(payload["filePath"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !filePath.isEmpty else {
                return .error(statusCode: 400, message: "Missing filePath.")
            }
            do {
                let policy = model.settingsScreenModel.screenModel.safetyConfig.sequenceSwitchUnsavedPolicy
                let saveBeforeSwitch = payload["saveBeforeSwitch"] as? Bool
                    ?? model.xlightsSessionModel.shouldSaveBeforeSwitch(policy: policy)
                let summary = try await model.xlightsSessionModel.openSequence(filePath: filePath, saveBeforeSwitch: saveBeforeSwitch)
                persistActiveSequencePath(filePath)
                refreshAll()
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
                let policy = model.settingsScreenModel.screenModel.safetyConfig.sequenceSwitchUnsavedPolicy
                let saveBeforeSwitch = model.xlightsSessionModel.shouldSaveBeforeSwitch(policy: policy)
                let summary = try await model.xlightsSessionModel.createSequence(
                    filePath: filePath,
                    mediaFile: mediaFile,
                    durationMs: durationMs,
                    frameMs: frameMs,
                    saveBeforeSwitch: saveBeforeSwitch
                )
                persistActiveSequencePath(filePath)
                refreshAll()
                return .json(200, body: ["ok": true, "summary": summary])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "sendAssistantPrompt":
            let prompt = String(payload["prompt"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !prompt.isEmpty else {
                return .error(statusCode: 400, message: "Missing prompt.")
            }
            model.assistantModel.loadConversationIfNeeded(
                context: model.assistantContext(),
                project: model.workspace.activeProject
            )
            model.assistantModel.draft = prompt
            Task { @MainActor [weak self] in
                guard let self else { return }
                await self.model.assistantModel.sendDraft(
                    context: self.model.assistantContext(),
                    project: self.model.workspace.activeProject,
                    onPhaseTransition: { transition in
                        self.model.transitionToPhase(transition.phaseID, reason: transition.reason)
                    },
                    onActionRequest: { actionRequest in
                        Task { @MainActor in
                            await self.model.applyAssistantActionRequest(actionRequest)
                        }
                    },
                    onPhaseStarted: {
                        self.model.markActivePhaseStarted()
                    }
                )
            }
            return .json(200, body: [
                "ok": true,
                "accepted": true,
                "messageCount": model.assistantModel.messages.count,
                "lastMessage": assistantSnapshot()["lastMessage"] ?? NSNull()
            ])
        case "applyReview":
            model.reviewScreenModel.applyPendingWork()
            return .json(200, body: ["ok": true, "isApplying": model.reviewScreenModel.isApplying])
        case "generateSequenceProposal":
            let selectedTagNames = splitPayloadList(
                String(payload["selectedTagNames"] as? String ?? payload["selectedTags"] as? String ?? payload["tags"] as? String ?? "")
            )
            let selectedSections = splitPayloadList(
                String(payload["selectedSections"] as? String ?? payload["sectionLabel"] as? String ?? payload["selectedSection"] as? String ?? "")
            )
            let timingTrackName = String(payload["timingTrackName"] as? String ?? payload["sectionTimingTrackName"] as? String ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            model.sequenceScreenModel.generateProposalFromDesignIntent(
                selectedTagNames: selectedTagNames,
                selectedSections: selectedSections,
                timingTrackName: timingTrackName
            )
            return .json(200, body: [
                "ok": true,
                "isGeneratingProposal": model.sequenceScreenModel.isGeneratingProposal,
                "banner": model.sequenceScreenModel.transientBanner.map { [
                    "text": $0.text,
                    "state": $0.state.rawValue
                ] } ?? NSNull()
            ])
        case "proposeDisplayMetadataFromLayout":
            model.displayScreenModel.proposeMetadataFromLayout()
            await model.displayScreenModel.reloadDisplay()
            return .json(200, body: [
                "ok": true,
                "display": displaySnapshot()
            ])
        case "applyDisplayMetadataProposals":
            do {
                try await model.displayScreenModel.promoteDiscoveryProposals()
                return .json(200, body: [
                    "ok": true,
                    "display": displaySnapshot()
                ])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "updateDisplayTargetIntent":
            let targetIDs = splitPayloadList(
                String(payload["targetIds"] as? String ?? payload["targetIDs"] as? String ?? payload["targets"] as? String ?? "")
            )
            guard !targetIDs.isEmpty else {
                return .error(statusCode: 400, message: "Target intent update requires exact xLights target IDs.")
            }
            do {
                try await model.displayScreenModel.saveTargetIntent(
                    targetIDs: targetIDs,
                    rolePreference: (payload["rolePreference"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines),
                    semanticHints: splitPayloadList(String(payload["semanticHints"] as? String ?? "")),
                    effectAvoidances: splitPayloadList(String(payload["effectAvoidances"] as? String ?? ""))
                )
                return .json(200, body: [
                    "ok": true,
                    "display": displaySnapshot()
                ])
            } catch {
                return .error(statusCode: 500, message: error.localizedDescription)
            }
        case "applyAssistantActionRequest":
            let actionType = String(payload["actionType"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            guard !actionType.isEmpty else {
                return .error(statusCode: 400, message: "Assistant action request requires actionType.")
            }
            let actionPayload = normalizeAssistantActionPayload(payload["payload"])
            let reason = String(payload["reason"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            await model.applyAssistantActionRequest(AssistantActionRequestResult(
                actionType: actionType,
                payload: actionPayload,
                reason: reason
            ))
            return .json(200, body: [
                "ok": true,
                "assistant": assistantSnapshot(),
                "display": displaySnapshot()
            ])
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
        case "resetAssistantMemory":
            refreshAll()
            model.clearWorkflowPhaseOverride()
            model.assistantModel.resetMemory(project: model.workspace.activeProject) {
                self.model.assistantContext()
            }
            return .json(200, body: [
                "ok": true,
                "messageCount": model.assistantModel.messages.count,
                "lastMessage": assistantSnapshot()["lastMessage"] ?? NSNull()
            ])
        case "clearProjectMission":
            model.clearProjectMission()
            refreshCurrentWorkflow()
            return .json(200, body: [
                "ok": true,
                "projectMission": model.projectScreenModel.screenModel.brief?.document ?? ""
            ])
        default:
            return .error(statusCode: 400, message: "Unsupported action \(name).")
        }
    }

    @MainActor
    private func refreshCurrentWorkflow() {
        model.refreshCurrentWorkflow()
    }

    @MainActor
    private func refreshAll() {
        model.refreshAll()
    }

    @MainActor
    private func persistActiveSequencePath(_ filePath: String) {
        guard var activeProject = model.workspace.activeProject else { return }
        let normalizedPath = filePath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalizedPath.isEmpty else { return }
        activeProject.snapshot["sequencePathInput"] = AnyCodable(normalizedPath)
        do {
            let saved = try projectService.saveProject(activeProject)
            model.workspace.setProject(saved)
        } catch {
            print("Native automation failed to persist active sequence path: \(error)")
        }
    }

    private func splitPayloadList(_ value: String) -> [String] {
        var seen = Set<String>()
        var result: [String] = []
        for item in value.components(separatedBy: CharacterSet(charactersIn: ",\n")) {
            let trimmed = item.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { continue }
            let key = trimmed.lowercased()
            guard seen.insert(key).inserted else { continue }
            result.append(trimmed)
        }
        return result
    }

    private func normalizeAssistantActionPayload(_ value: Any?) -> [String: String] {
        guard let object = value as? [String: Any] else { return [:] }
        var payload: [String: String] = [:]
        for (key, rawValue) in object {
            let trimmedKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmedKey.isEmpty else { continue }
            if let strings = rawValue as? [String] {
                payload[trimmedKey] = strings.joined(separator: ",")
            } else {
                payload[trimmedKey] = String(describing: rawValue).trimmingCharacters(in: .whitespacesAndNewlines)
            }
        }
        return payload
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
        let phase = model.currentWorkflowPhase()
        return [
            "ok": true,
            "selectedWorkflow": model.selectedWorkflow.rawValue,
            "workflowPhase": [
                "phaseId": phase.phaseID.rawValue,
                "title": phase.phaseID.title,
                "ownerRole": phase.ownerRole,
                "status": phase.status.rawValue,
                "entryReason": phase.entryReason,
                "nextRecommendedPhases": phase.nextRecommendedPhases.map(\.rawValue)
            ],
            "assistantVisible": model.showAssistantPanel,
            "workspace": workspaceSnapshot(),
            "xlights": xlightsSessionSnapshot(),
            "assistant": assistantSnapshot(),
            "pages": [
                "project": projectSnapshot(),
                "display": displaySnapshot(),
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
        let phase = model.currentWorkflowPhase()
        let discovery = LocalDisplayDiscoveryStateStore().summary(for: model.workspace.activeProject)
        let profile = (try? LocalAssistantUserProfileStore().load()) ?? AssistantUserProfile()
        let messages = model.assistantModel.messages.map { message in
            [
                "id": message.id,
                "role": message.role.rawValue,
                "text": message.text,
                "timestamp": message.timestamp,
                "handledBy": message.handledBy ?? "",
                "routeDecision": message.routeDecision ?? "",
                "displayName": message.displayName ?? "",
                "artifactCard": [
                    "artifactType": message.artifactCard?.artifactType ?? "",
                    "title": message.artifactCard?.title ?? "",
                    "summary": message.artifactCard?.summary ?? "",
                    "chips": message.artifactCard?.chips ?? []
                ]
            ]
        }
        return [
            "visible": model.showAssistantPanel,
            "draft": model.assistantModel.draft,
            "isSending": model.assistantModel.isSending,
            "rollingSummary": model.assistantModel.rollingConversationSummary,
            "workflowPhase": [
                "phaseId": phase.phaseID.rawValue,
                "title": phase.phaseID.title,
                "ownerRole": phase.ownerRole,
                "status": phase.status.rawValue,
                "entryReason": phase.entryReason,
                "nextRecommendedPhases": phase.nextRecommendedPhases.map(\.rawValue)
            ],
            "messageCount": messages.count,
            "messages": messages,
            "lastMessage": messages.last ?? [:],
            "lastDiagnostics": [
                "artifactType": model.assistantModel.lastDiagnostics?.artifactType ?? "",
                "routeDecision": model.assistantModel.lastDiagnostics?.routeDecision ?? "",
                "addressedTo": model.assistantModel.lastDiagnostics?.addressedTo ?? "",
                "bridgeOk": model.assistantModel.lastDiagnostics?.bridgeOk ?? false,
                "responseCode": model.assistantModel.lastDiagnostics?.responseCode ?? "",
                "sequenceOpen": model.assistantModel.lastDiagnostics?.sequenceOpen ?? false,
                "planOnlyMode": model.assistantModel.lastDiagnostics?.planOnlyMode ?? false,
                "generatedAt": model.assistantModel.lastDiagnostics?.generatedAt ?? ""
            ],
            "lastActionRequest": [
                "actionType": model.assistantModel.lastActionRequest?.actionType ?? "",
                "payload": model.assistantModel.lastActionRequest?.payload ?? [:],
                "reason": model.assistantModel.lastActionRequest?.reason ?? ""
            ],
            "displayDiscovery": [
                "status": discovery.status.rawValue,
                "scope": discovery.scope,
                "transcriptCount": discovery.transcriptCount,
                "insights": discovery.insights.map {
                    [
                        "subject": $0.subject,
                        "subjectType": $0.subjectType,
                        "category": $0.category,
                        "value": $0.value,
                        "rationale": $0.rationale
                    ]
                },
                "unresolvedBranches": discovery.unresolvedBranches,
                "resolvedBranches": discovery.resolvedBranches,
                "proposedTags": discovery.proposedTags.map {
                    [
                        "tagName": $0.tagName,
                        "tagDescription": $0.tagDescription,
                        "rationale": $0.rationale,
                        "targetNames": $0.targetNames
                    ]
                },
                "candidateProps": discovery.candidateProps.map {
                    [
                        "name": $0.name,
                        "type": $0.type,
                        "reason": $0.reason
                    ]
                }
            ],
            "userProfile": [
                "preferenceNotes": profile.preferenceNotes.map(\.text)
            ]
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
            "layoutSignature": snapshot.layoutSignature,
            "hasUnsavedLayoutChanges": snapshot.hasUnsavedLayoutChanges ?? NSNull(),
            "hasUnsavedRgbEffectsChanges": snapshot.hasUnsavedRgbEffectsChanges ?? NSNull(),
            "hasUnsavedNetworkChanges": snapshot.hasUnsavedNetworkChanges ?? NSNull(),
            "rgbEffectsFile": snapshot.rgbEffectsFile,
            "rgbEffectsModifiedAt": snapshot.rgbEffectsModifiedAt,
            "networksFile": snapshot.networksFile,
            "networksModifiedAt": snapshot.networksModifiedAt,
            "layoutDirtyStateReason": snapshot.layoutDirtyStateReason,
            "sequenceType": snapshot.sequenceType,
            "durationMs": snapshot.durationMs,
            "frameMs": snapshot.frameMs,
            "dirtyState": snapshot.dirtyState,
            "dirtyStateReason": snapshot.dirtyStateReason,
            "hasUnsavedChanges": snapshot.hasUnsavedChanges ?? NSNull(),
            "saveSupported": snapshot.saveSupported,
            "renderSupported": snapshot.renderSupported,
            "openSupported": snapshot.openSupported,
            "createSupported": snapshot.createSupported,
            "closeSupported": snapshot.closeSupported,
            "lastSaveSummary": snapshot.lastSaveSummary,
            "lastRenderSummary": snapshot.lastRenderSummary
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
    private func displaySnapshot() -> [String: Any] {
        let screen = model.displayScreenModel.screenModel
        let selected = switch screen.selectedMetadata {
        case .none:
            [:]
        case let .selected(entry):
            [
                "subject": entry.subject,
                "subjectType": entry.subjectType,
                "category": entry.category,
                "value": entry.value,
                "status": entry.status.rawValue,
                "rationale": entry.rationale,
                "linkedTargets": entry.linkedTargets,
                "relatedLabels": entry.relatedLabels.map { ["name": $0.name, "description": $0.description, "color": $0.color.displayName] }
            ]
        }
        return [
            "title": screen.header.title,
            "subtitle": screen.header.subtitle,
            "activeProjectName": screen.header.activeProjectName,
            "sourceSummary": screen.header.sourceSummary,
            "targetCount": screen.rows.count,
            "metadataCount": screen.metadataRows.count,
            "proposedMetadataCount": screen.discoveryProposals.count,
            "confirmedMetadataCount": screen.metadataRows.filter { $0.status == .confirmed }.count,
            "targetIntentMetadataCount": screen.metadataRows.filter { $0.category == "Target Intent" }.count,
            "semanticTagMetadataCount": screen.metadataRows.filter { $0.category == "Semantic Tag" }.count,
            "readinessState": screen.readinessSummary.state.rawValue,
            "readyCount": screen.readinessSummary.readyCount,
            "unresolvedCount": screen.readinessSummary.unresolvedCount,
            "orphanCount": screen.readinessSummary.orphanCount,
            "metadataRows": screen.metadataRows.prefix(12).map {
                [
                    "subject": $0.subject,
                    "subjectType": $0.subjectType,
                    "category": $0.category,
                    "value": $0.value,
                    "status": $0.status.rawValue,
                    "linkedTargetCount": $0.linkedTargetCount
                ]
            },
            "targetIntentMetadataRows": screen.metadataRows.filter { $0.category == "Target Intent" }.map {
                [
                    "subject": $0.subject,
                    "subjectType": $0.subjectType,
                    "category": $0.category,
                    "value": $0.value,
                    "status": $0.status.rawValue,
                    "linkedTargetCount": $0.linkedTargetCount
                ]
            },
            "discoveryProposals": screen.discoveryProposals.prefix(12).map {
                [
                    "tagName": $0.tagName,
                    "tagDescription": $0.tagDescription,
                    "targetCount": $0.targetNames.count
                ]
            },
            "selectedMetadata": selected
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
            "nativeDesignIntent": [
                "goal": model.designScreenModel.intentDraft.goal,
                "mood": model.designScreenModel.intentDraft.mood,
                "constraints": model.designScreenModel.intentDraft.constraints,
                "targetScope": model.designScreenModel.intentDraft.targetScope,
                "references": model.designScreenModel.intentDraft.references,
                "approvalNotes": model.designScreenModel.intentDraft.approvalNotes,
                "updatedAt": model.designScreenModel.intentDraft.updatedAt,
                "isDirty": model.designScreenModel.intentDraft != model.designScreenModel.savedIntentDraft
            ],
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
            "isGeneratingProposal": model.sequenceScreenModel.isGeneratingProposal,
            "timingReviewNeedsReview": screen.timingReview.needsReview,
            "timingReviewCount": screen.timingReview.rows.count,
            "banners": sequenceBanners(screen: screen).map { ["text": $0.text, "state": $0.state.rawValue] }
        ]
    }

    @MainActor
    private func sequenceBanners(screen: SequenceScreenModel) -> [WorkflowBannerModel] {
        var banners = screen.banners
        if let transientBanner = model.sequenceScreenModel.transientBanner {
            banners.append(transientBanner)
        }
        return banners
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

    @MainActor
    private func sequencerValidationSnapshot() async -> [String: Any] {
        let project = model.workspace.activeProject
        let snapshot = latestProjectValidationSnapshot(for: project)
        let latestPlanHandoff = snapshot["latestPlanHandoff"] as? [String: Any]
        let latestProposalBundle = snapshot["latestProposalBundle"] as? [String: Any]
        let feedbackCapabilities = await ownedRenderFeedbackCapabilities()
        return [
            "ok": true,
            "status": [
                "selectedWorkflow": model.selectedWorkflow.rawValue,
                "projectName": project?.projectName ?? "",
                "projectFilePath": project?.projectFilePath ?? ""
            ],
            "activeSequence": string(project?.snapshot["activeSequence"]?.value),
            "sequencePathInput": string(project?.snapshot["sequencePathInput"]?.value),
            "reviewHistorySnapshotAvailable": bool(snapshot["reviewHistorySnapshotAvailable"]),
            "latestApply": snapshot["latestApply"] ?? NSNull(),
            "latestPracticalValidation": snapshot["latestPracticalValidation"] ?? NSNull(),
            "latestApplyResult": snapshot["latestApplyResult"] ?? NSNull(),
            "latestProposalBundle": latestProposalBundle ?? NSNull(),
            "latestPlanHandoff": latestPlanHandoff ?? NSNull(),
            "latestIntentHandoff": snapshot["latestIntentHandoff"] ?? NSNull(),
            "latestRenderObservation": snapshot["latestRenderObservation"] ?? NSNull(),
            "latestRenderCritiqueContext": snapshot["latestRenderCritiqueContext"] ?? NSNull(),
            "latestSequenceArtisticGoal": snapshot["latestSequenceArtisticGoal"] ?? NSNull(),
            "latestSequenceRevisionObjective": snapshot["latestSequenceRevisionObjective"] ?? NSNull(),
            "latestReviewArtifacts": snapshot["latestReviewArtifacts"] ?? NSNull(),
            "latestGuidanceCoverage": buildPlanGuidanceCoverage(latestPlanHandoff),
            "ownedRenderFeedbackCapabilities": feedbackCapabilities,
            "recentPersistenceDiagnostics": snapshot["recentPersistenceDiagnostics"] ?? [],
            "pageStates": [
                "design": designSnapshot(),
                "sequence": sequenceSnapshot(),
                "review": reviewSnapshot(),
                "history": historySnapshot()
            ]
        ]
    }

    @MainActor
    private func renderFeedbackSnapshot() async -> [String: Any] {
        let project = model.workspace.activeProject
        let snapshot = latestProjectValidationSnapshot(for: project)
        let feedbackCapabilities = await ownedRenderFeedbackCapabilities()
        return [
            "ok": true,
            "ownedRenderFeedbackCapabilities": feedbackCapabilities,
            "renderObservation": snapshot["latestRenderObservation"] ?? NSNull(),
            "renderCritiqueContext": snapshot["latestRenderCritiqueContext"] ?? NSNull(),
            "sequenceArtisticGoal": snapshot["latestSequenceArtisticGoal"] ?? NSNull(),
            "sequenceRevisionObjective": snapshot["latestSequenceRevisionObjective"] ?? NSNull()
        ]
    }

    private func ownedRenderFeedbackCapabilities() async -> [String: Any] {
        async let layoutModels = probeOwnedRoute(path: "/layout/models", method: "GET")
        async let layoutScene = probeOwnedRoute(path: "/layout/scene", method: "GET")
        async let renderSamples = probeOwnedRoute(
            path: "/sequence/render-samples",
            method: "POST",
            body: [
                "startMs": 0,
                "endMs": 25,
                "maxFrames": 1,
                "channelRanges": [
                    [
                        "startChannel": 1,
                        "channelCount": 1
                    ]
                ]
            ]
        )

        let layoutModelsStatus = await layoutModels
        let layoutSceneStatus = await layoutScene
        let renderSamplesStatus = await renderSamples
        let fullFeedbackReady = layoutModelsStatus["available"] as? Bool == true
            && layoutSceneStatus["available"] as? Bool == true
            && renderSamplesStatus["available"] as? Bool == true

        let missingRequirements = [
            (layoutModelsStatus["available"] as? Bool == true) ? nil : "layout.models",
            (layoutSceneStatus["available"] as? Bool == true) ? nil : "layout.scene",
            (renderSamplesStatus["available"] as? Bool == true) ? nil : "sequence.render-samples"
        ].compactMap { $0 }

        return [
            "fullFeedbackReady": fullFeedbackReady,
            "missingRequirements": missingRequirements,
            "layoutModels": layoutModelsStatus,
            "layoutScene": layoutSceneStatus,
            "renderSamples": renderSamplesStatus
        ]
    }

    private func probeOwnedRoute(path: String, method: String, body: [String: Any]? = nil) async -> [String: Any] {
        guard let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + path) else {
            return [
                "available": false,
                "statusCode": 0,
                "errorCode": "INVALID_URL",
                "message": "Invalid owned route URL for \(path)."
            ]
        }

        do {
            var request = URLRequest(url: url)
            request.httpMethod = method
            if let body {
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.httpBody = try JSONSerialization.data(withJSONObject: body)
            }
            let (data, response) = try await URLSession.shared.data(for: request)
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
            let parsed = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
            let ok = parsed["ok"] as? Bool
            let error = parsed["error"] as? [String: Any]
            let errorCode = string(error?["code"])
            let message = string(error?["message"])
            return [
                "available": statusCode != 404,
                "statusCode": statusCode,
                "ok": ok ?? false,
                "errorCode": errorCode,
                "message": message
            ]
        } catch {
            return [
                "available": false,
                "statusCode": 0,
                "errorCode": "REQUEST_FAILED",
                "message": error.localizedDescription
            ]
        }
    }

    @MainActor
    private func latestProjectValidationSnapshot(for project: ActiveProjectModel?) -> [String: Any] {
        guard let project else {
            return [
                "reviewHistorySnapshotAvailable": false,
                "recentPersistenceDiagnostics": []
            ]
        }
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        let historyEntry = readLatestArtifact(in: projectDir.appendingPathComponent("history", isDirectory: true))
        let latestApplyResult = readLatestArtifact(in: projectDir.appendingPathComponent("artifacts/apply-results", isDirectory: true))
        let latestProposalBundle = readLatestArtifact(in: projectDir.appendingPathComponent("artifacts/proposals", isDirectory: true))
        let latestPlanHandoff = readLatestArtifact(in: projectDir.appendingPathComponent("artifacts/plans", isDirectory: true))
        let latestIntentHandoff = readLatestArtifact(in: projectDir.appendingPathComponent("artifacts/intent-handoffs", isDirectory: true))
        let latestRenderObservation = readLatestArtifact(in: projectDir.appendingPathComponent("artifacts/render-observations", isDirectory: true))
        let latestRenderCritiqueContext = readLatestArtifact(in: projectDir.appendingPathComponent("artifacts/render-critique-contexts", isDirectory: true))
        let latestSequenceArtisticGoal = readLatestArtifact(in: projectDir.appendingPathComponent("artifacts/sequence-artistic-goals", isDirectory: true))
        let latestSequenceRevisionObjective = readLatestArtifact(in: projectDir.appendingPathComponent("artifacts/sequence-revision-objectives", isDirectory: true))
        return [
            "reviewHistorySnapshotAvailable": historyEntry != nil || latestApplyResult != nil || latestRenderObservation != nil || latestRenderCritiqueContext != nil,
            "latestApply": historyEntry != nil ? [
                "historyEntryId": string(historyEntry?["historyEntryId"]),
                "summary": string(historyEntry?["summary"]),
                "status": string(historyEntry?["status"])
            ] : NSNull(),
            "latestPracticalValidation": latestApplyResult?["practicalValidation"] ?? NSNull(),
            "latestApplyResult": latestApplyResult ?? NSNull(),
            "latestProposalBundle": latestProposalBundle ?? NSNull(),
            "latestPlanHandoff": latestPlanHandoff ?? NSNull(),
            "latestIntentHandoff": latestIntentHandoff ?? NSNull(),
            "latestRenderObservation": latestRenderObservation ?? NSNull(),
            "latestRenderCritiqueContext": latestRenderCritiqueContext ?? NSNull(),
            "latestSequenceArtisticGoal": latestSequenceArtisticGoal ?? NSNull(),
            "latestSequenceRevisionObjective": latestSequenceRevisionObjective ?? NSNull(),
            "latestReviewArtifacts": [
                "applyResult": summarizeValidationArtifact(latestApplyResult, extra: [
                    "status": string(latestApplyResult?["status"]),
                    "sequenceBackupPath": string(latestApplyResult?["sequenceBackupPath"]),
                    "metadataAssignmentCount": int(latestApplyResult?["metadataAssignmentCount"]),
                    "renderCurrentSummary": string(latestApplyResult?["renderCurrentSummary"]),
                    "renderCurrentError": string(latestApplyResult?["renderCurrentError"]),
                    "practicalValidation": summarizePracticalValidation(latestApplyResult?["practicalValidation"] as? [String: Any]) ?? NSNull()
                ]),
                "renderObservation": summarizeValidationArtifact(latestRenderObservation, extra: [
                    "leadModel": string((latestRenderObservation?["macro"] as? [String: Any])?["leadModel"]),
                    "samplingMode": string((latestRenderObservation?["source"] as? [String: Any])?["samplingMode"])
                ]),
                "renderCritiqueContext": summarizeValidationArtifact(latestRenderCritiqueContext, extra: [
                    "leadMatchesPrimaryFocus": bool(((latestRenderCritiqueContext?["comparison"] as? [String: Any])?["leadMatchesPrimaryFocus"])),
                    "breadthRead": string((latestRenderCritiqueContext?["observed"] as? [String: Any])?["breadthRead"])
                ]),
                "sequenceArtisticGoal": summarizeValidationArtifact(latestSequenceArtisticGoal, extra: [
                    "goalLevel": string((latestSequenceArtisticGoal?["scope"] as? [String: Any])?["goalLevel"])
                ]),
                "sequenceRevisionObjective": summarizeValidationArtifact(latestSequenceRevisionObjective, extra: [
                    "ladderLevel": string(latestSequenceRevisionObjective?["ladderLevel"]),
                    "nextOwner": string(((latestSequenceRevisionObjective?["scope"] as? [String: Any])?["nextOwner"]))
                ])
            ],
            "recentPersistenceDiagnostics": []
        ]
    }

    private func buildPlanGuidanceCoverage(_ planHandoff: [String: Any]?) -> [String: Any] {
        let commands = planHandoff?["commands"] as? [[String: Any]] ?? []
        let effectCreates = commands.filter { string($0["cmd"]) == "effects.create" }
        let guidanceRows = effectCreates.map { row -> [String: Any] in
            let intent = row["intent"] as? [String: Any]
            let params = row["params"] as? [String: Any]
            return [
                "effectName": string(params?["effectName"]),
                "hasParameterPriorGuidance": intent?["parameterPriorGuidance"] is [String: Any],
                "hasSharedSettingPriorGuidance": intent?["sharedSettingPriorGuidance"] is [String: Any]
            ]
        }
        let guidedEffects = Array(Set(guidanceRows.compactMap { row in
            (bool(row["hasParameterPriorGuidance"]) || bool(row["hasSharedSettingPriorGuidance"])) ? string(row["effectName"]) : ""
        }.filter { !$0.isEmpty })).sorted()
        return [
            "effectCreateCount": effectCreates.count,
            "parameterPriorCommandCount": guidanceRows.filter { bool($0["hasParameterPriorGuidance"]) }.count,
            "sharedSettingPriorCommandCount": guidanceRows.filter { bool($0["hasSharedSettingPriorGuidance"]) }.count,
            "guidedEffects": guidedEffects
        ]
    }

    private func summarizeValidationArtifact(_ artifact: [String: Any]?, extra: [String: Any] = [:]) -> [String: Any]? {
        guard let artifact else { return nil }
        var out: [String: Any] = [
            "artifactId": string(artifact["artifactId"]),
            "artifactType": string(artifact["artifactType"])
        ]
        for (key, value) in extra {
            out[key] = value
        }
        return out
    }

    private func summarizePracticalValidation(_ validation: [String: Any]?) -> [String: Any]? {
        guard let validation else { return nil }
        let summary = validation["summary"] as? [String: Any]
        let readbackChecks = summary?["readbackChecks"] as? [String: Any]
        let designChecks = summary?["designChecks"] as? [String: Any]
        return [
            "artifactType": string(validation["artifactType"]),
            "overallOk": bool(validation["overallOk"]),
            "designSummary": string(validation["designSummary"]),
            "readbackPassed": int(readbackChecks?["passed"]),
            "readbackFailed": int(readbackChecks?["failed"]),
            "designPassed": int(designChecks?["passed"]),
            "designFailed": int(designChecks?["failed"])
        ]
    }

    private func readLatestArtifact(in directory: URL) -> [String: Any]? {
        guard FileManager.default.fileExists(atPath: directory.path) else { return nil }
        guard let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles]) else {
            return nil
        }
        let jsonFiles = files.filter { $0.pathExtension == "json" }
        guard let latest = try? jsonFiles.max(by: { lhs, rhs in
            let l = try lhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate ?? .distantPast
            let r = try rhs.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate ?? .distantPast
            return l < r
        }) else {
            return nil
        }
        guard let data = try? Data(contentsOf: latest),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return object
    }

    private func string(_ value: Any?) -> String {
        String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func int(_ value: Any?) -> Int {
        if let number = value as? NSNumber { return number.intValue }
        return Int(String(describing: value ?? "")) ?? 0
    }

    private func bool(_ value: Any?) -> Bool {
        if let bool = value as? Bool { return bool }
        if let number = value as? NSNumber { return number.boolValue }
        return false
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
