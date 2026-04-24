import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    private let displayDiscoveryStore: DisplayDiscoveryStateStore
    private let userProfileStore: AssistantUserProfileStore
    private let xlightsDerivedMetadataService: XLightsDerivedMetadataService

    var selectedWorkflow: WorkflowID = .project
    var showSettings = false
    var showAssistantPanel = true
    var sidebarCollapsed = false
    var activeWorkflowPhaseOverride: WorkflowPhaseStateModel?

    let workspace: ProjectWorkspace
    let assistantModel: AssistantWindowViewModel
    let audioScreenModel: AudioScreenViewModel
    let projectScreenModel: ProjectScreenViewModel
    let displayScreenModel: DisplayScreenViewModel
    let designScreenModel: DesignScreenViewModel
    let sequenceScreenModel: SequenceScreenViewModel
    let reviewScreenModel: ReviewScreenViewModel
    let historyScreenModel: HistoryScreenViewModel
    let settingsScreenModel: SettingsScreenViewModel
    let xlightsSessionModel: XLightsSessionViewModel

    init(
        displayDiscoveryStore: DisplayDiscoveryStateStore = LocalDisplayDiscoveryStateStore(),
        userProfileStore: AssistantUserProfileStore = LocalAssistantUserProfileStore(),
        xlightsDerivedMetadataService: XLightsDerivedMetadataService = DefaultXLightsDerivedMetadataService()
    ) {
        self.displayDiscoveryStore = displayDiscoveryStore
        self.userProfileStore = userProfileStore
        self.xlightsDerivedMetadataService = xlightsDerivedMetadataService
        let workspace = ProjectWorkspace()
        self.workspace = workspace
        self.xlightsSessionModel = XLightsSessionViewModel(workspace: workspace)
        self.assistantModel = AssistantWindowViewModel(workspace: workspace)
        self.audioScreenModel = AudioScreenViewModel.sample()
        self.projectScreenModel = ProjectScreenViewModel(workspace: workspace)
        self.displayScreenModel = DisplayScreenViewModel(workspace: workspace)
        self.designScreenModel = DesignScreenViewModel(workspace: workspace)
        self.sequenceScreenModel = SequenceScreenViewModel(workspace: workspace)
        self.reviewScreenModel = ReviewScreenViewModel(workspace: workspace)
        self.historyScreenModel = HistoryScreenViewModel(workspace: workspace)
        self.settingsScreenModel = SettingsScreenViewModel()
        self.settingsScreenModel.load()
        self.xlightsSessionModel.onSignificantChange = { [weak self] _, _ in
            Task { @MainActor in
                self?.displayScreenModel.loadDisplay()
                self?.sequenceScreenModel.refresh()
                self?.reviewScreenModel.refresh()
            }
        }
        self.xlightsSessionModel.refresh()
    }

    func workflowRoute() -> String {
        switch selectedWorkflow {
        case .project:
            return "project"
        case .display:
            return "display"
        case .audio:
            return "audio"
        case .design:
            return "design"
        case .sequence:
            return "sequence"
        case .review:
            return "review"
        case .history:
            return "history"
        }
    }

    func focusedSummary() -> String {
        switch selectedWorkflow {
        case .project:
            return workspace.activeProject?.projectFilePath ?? "Project summary"
        case .display:
            switch displayScreenModel.screenModel.selectedMetadata {
            case let .selected(entry):
                return "\(entry.subject): \(entry.value)"
            default:
                return "No metadata entry selected"
            }
        case .audio:
            switch audioScreenModel.currentResult {
            case let .track(track):
                return track.displayName
            case let .batchComplete(batch):
                return batch.batchLabel
            case let .batchRunning(batch):
                return batch.batchLabel
            default:
                return "No track selected"
            }
        case .sequence:
            return sequenceScreenModel.selectedRow?.summary ?? "No sequencing item selected"
        case .review:
            return reviewScreenModel.screenModel.pendingSummary.pendingSummary
        case .design:
            return designScreenModel.screenModel.proposal.proposalSummary
        case .history:
            switch historyScreenModel.screenModel.selectedEvent {
            case let .selected(event):
                return event.changeSummary
            default:
                return "No history item selected"
            }
        }
    }

    func assistantContext() -> AssistantContextModel {
        let projectBrief = projectScreenModel.screenModel.brief
        let layoutRows = displayScreenModel.screenModel.rows
        let xlightsDerivedMetadata = xlightsDerivedMetadataService.derive(from: layoutRows)
        let labeledTargetCount = layoutRows.filter { !$0.labelDefinitions.isEmpty }.count
        let allLabelNames = Set(displayScreenModel.screenModel.labelDefinitions.map(\.name))
        let displayMetadataRows = displayScreenModel.screenModel.metadataRows.prefix(24).map { row in
            [
                "subject": row.subject,
                "subjectType": row.subjectType,
                "category": row.category,
                "value": row.value,
                "status": row.status.rawValue,
                "linkedTargetCount": "\(row.linkedTargetCount)",
                "linkedTargetSample": row.linkedTargets.prefix(8).joined(separator: ", ")
            ]
        }
        let displayTargetIntentRows = displayScreenModel.screenModel.metadataRows
            .filter { $0.category == "Target Intent" }
            .prefix(16)
            .map { row in
                [
                    "subject": row.subject,
                    "subjectType": row.subjectType,
                    "category": row.category,
                    "value": row.value,
                    "status": row.status.rawValue,
                    "linkedTargetCount": "\(row.linkedTargetCount)",
                    "linkedTargetSample": row.linkedTargets.prefix(8).joined(separator: ", ")
                ]
            }
        let discoverySummary = displayDiscoveryStore.summary(for: workspace.activeProject)
        let discoveryCandidates = buildDisplayDiscoveryCandidates(from: layoutRows, discoverySummary: discoverySummary)
        let discoveryFamilies = xlightsDerivedMetadata.families.map(\.payload)
        let displayTypeBreakdown = xlightsDerivedMetadata.typeBreakdown.map(\.payload)
        let displayModelSamples = xlightsDerivedMetadata.modelSamples.map(\.payload)
        let displayAllTargetNames = xlightsDerivedMetadata.allTargetNames
        let displayGroupMemberships = xlightsDerivedMetadata.groupMemberships.map(\.payload)
        let displayDiscoveryInsights = discoverySummary.insights.map {
            [
                "subject": $0.subject,
                "subjectType": $0.subjectType,
                "category": $0.category,
                "value": $0.value,
                "rationale": $0.rationale
            ]
        }
        let userPreferenceNotes = (try? userProfileStore.load().preferenceNotes.map(\.text)) ?? []
        let selectedDisplaySubject: String
        let selectedDisplayLabels: [String]
        switch displayScreenModel.screenModel.selectedMetadata {
        case let .selected(entry):
            selectedDisplaySubject = entry.subject
            selectedDisplayLabels = entry.relatedLabels.map(\.name)
        default:
            selectedDisplaySubject = ""
            selectedDisplayLabels = []
        }
        let xlights = xlightsSessionModel.snapshot
        let sequence = sequenceScreenModel.screenModel
        let designIntent = designScreenModel.intentDraft
        let phase = currentWorkflowPhase()
        return AssistantContextModel(
            activeProjectName: workspace.activeProject?.projectName ?? "No Project",
            workflowName: selectedWorkflow.rawValue,
            route: workflowRoute(),
            interactionStyle: inferredInteractionStyle(),
            workflowPhaseID: phase.phaseID.rawValue,
            workflowPhaseOwnerRole: phase.ownerRole,
            workflowPhaseStatus: phase.status.rawValue,
            workflowPhaseEntryReason: phase.entryReason,
            workflowPhaseNextRecommended: phase.nextRecommendedPhases.map(\.rawValue),
            workflowPhaseOutputSummary: currentPhaseOutputSummary(for: phase),
            focusedSummary: focusedSummary(),
            projectMissionDocument: projectBrief?.document ?? "",
            designIntentGoal: designIntent.goal,
            designIntentMood: designIntent.mood,
            designIntentConstraints: designIntent.constraints,
            designIntentTargetScope: designIntent.targetScope,
            designIntentReferences: designIntent.references,
            designIntentApprovalNotes: designIntent.approvalNotes,
            designIntentUpdatedAt: designIntent.updatedAt,
            designIntentDirty: designScreenModel.intentDraft != designScreenModel.savedIntentDraft,
            rollingConversationSummary: assistantModel.rollingConversationSummary,
            activeSequenceLoaded: sequenceScreenModel.screenModel.hasLiveSequence,
            planOnlyMode: sequenceScreenModel.screenModel.planOnlyMode,
            showFolder: workspace.activeProject?.showFolder ?? "",
            displayTargetCount: layoutRows.count,
            displayLabeledTargetCount: labeledTargetCount,
            displayLabelNames: allLabelNames.sorted(),
            displayMetadataRows: displayMetadataRows,
            displayTargetIntentRows: Array(displayTargetIntentRows),
            selectedDisplaySubject: selectedDisplaySubject,
            selectedDisplayLabels: selectedDisplayLabels.sorted(),
            displayDiscoveryCandidates: discoveryCandidates,
            displayDiscoveryFamilies: discoveryFamilies,
            displayTypeBreakdown: displayTypeBreakdown,
            displayModelSamples: displayModelSamples,
            displayAllTargetNames: displayAllTargetNames,
            displayGroupMemberships: displayGroupMemberships,
            xlightsLayoutFamilies: discoveryFamilies,
            xlightsLayoutTypeBreakdown: displayTypeBreakdown,
            xlightsLayoutModelSamples: displayModelSamples,
            xlightsLayoutAllTargetNames: displayAllTargetNames,
            xlightsLayoutGroupMemberships: displayGroupMemberships,
            displayDiscoveryStatus: discoverySummary.status.rawValue,
            displayDiscoveryTranscriptCount: discoverySummary.transcriptCount,
            displayDiscoveryInsights: displayDiscoveryInsights,
            displayDiscoveryUnresolvedBranches: discoverySummary.unresolvedBranches,
            displayDiscoveryResolvedBranches: discoverySummary.resolvedBranches,
            teamChatIdentities: settingsScreenModel.screenModel.agentConfig.identities.asPayload(),
            userPreferredName: settingsScreenModel.screenModel.agentConfig.userIdentity.nickname.trimmingCharacters(in: .whitespacesAndNewlines),
            userPreferenceNotes: userPreferenceNotes,
            xlightsSequenceOpen: xlights.isSequenceOpen,
            xlightsSequencePath: xlights.sequencePath,
            xlightsMediaFile: xlights.mediaFile,
            xlightsDirtyState: xlights.dirtyState,
            projectShowMatches: xlights.projectShowMatches,
            sequenceItemCount: sequence.overview.itemCount,
            sequenceWarningCount: sequence.overview.warningCount,
            sequenceValidationIssueCount: sequence.overview.validationIssueCount,
            timingReviewNeeded: sequence.timingReview.needsReview
        )
    }

    private func currentPhaseOutputSummary(for phase: WorkflowPhaseStateModel) -> String {
        switch phase.phaseID {
        case .setup:
            let agentConfig = settingsScreenModel.screenModel.agentConfig
            let providerReady = !agentConfig.model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
                !agentConfig.baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
                agentConfig.hasStoredAPIKey
            let projectReady = workspace.activeProject != nil
            if providerReady && projectReady { return "Setup prerequisites are satisfied." }
            var missing: [String] = []
            if !providerReady { missing.append("provider configuration") }
            if !projectReady { missing.append("active project") }
            return missing.isEmpty ? "Setup is incomplete." : "Still missing: \(missing.joined(separator: ", "))."
        case .projectMission:
            let document = projectScreenModel.screenModel.brief?.document.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if document.isEmpty { return "No project mission captured yet." }
            return "Mission document saved (\(document.count) chars)."
        case .audioAnalysis:
            let header = audioScreenModel.header
            return "\(header.completeCount) complete, \(header.needsReviewCount) need review, \(header.failedCount) failed."
        case .displayDiscovery:
            let summary = displayDiscoveryStore.summary(for: workspace.activeProject)
            return "\(summary.insights.count) insights, \(summary.unresolvedBranches.count) unresolved branches."
        case .design:
            let nativeGoal = designScreenModel.intentDraft.goal.trimmingCharacters(in: .whitespacesAndNewlines)
            if !nativeGoal.isEmpty { return nativeGoal }
            let summary = designScreenModel.screenModel.proposal.proposalSummary.trimmingCharacters(in: .whitespacesAndNewlines)
            return summary.isEmpty ? "No design handoff summary yet." : summary
        case .sequencing:
            let overview = sequenceScreenModel.screenModel.overview
            return "\(overview.itemCount) items, \(overview.warningCount) warnings, \(overview.validationIssueCount) validation issues."
        case .review:
            return reviewScreenModel.screenModel.pendingSummary.pendingSummary
        }
    }

    private func inferredInteractionStyle() -> String {
        let recentUserMessages = assistantModel.messages
            .filter { $0.role == .user }
            .suffix(6)
            .map(\.text)

        guard !recentUserMessages.isEmpty else { return "guided" }

        let directCount = recentUserMessages.reduce(into: 0) { total, raw in
            let text = raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if text.isEmpty { return }
            let explicitSwitch = text.range(of: #"\b(switch|move|go|start|begin|continue|jump|transition)\b.*\b(project mission|mission|audio|audio analysis|display|display discovery|design|sequence|sequencing|review)\b"#, options: .regularExpression) != nil
            let imperative = text.range(of: #"\b(analyze|review|sequence|design|open|show|hide|set|apply|update|fix|move|switch|start|begin|continue|create|edit|delete)\b"#, options: .regularExpression) != nil
            let concise = text.count <= 80
            let questionCount = text.filter { $0 == "?" }.count
            if explicitSwitch || (imperative && concise && questionCount <= 1) {
                total += 1
            }
        }

        return directCount >= max(2, recentUserMessages.count / 2) ? "direct" : "guided"
    }

    func currentWorkflowPhase() -> WorkflowPhaseStateModel {
        if isSetupIncomplete() {
            let setupPhase = WorkflowPhaseStateModel(
                phaseID: .setup,
                ownerRole: "app_assistant",
                status: .inProgress,
                entryReason: "App setup is still incomplete.",
                nextRecommendedPhases: [.projectMission, .audioAnalysis, .displayDiscovery]
            )
            return applyPhaseOverlay(setupPhase)
        }

        if let activeWorkflowPhaseOverride {
            return applyPhaseOverlay(activeWorkflowPhaseOverride)
        }

        return inferredWorkflowPhase()
    }

    private func inferredWorkflowPhase() -> WorkflowPhaseStateModel {
        let base: WorkflowPhaseStateModel
        switch selectedWorkflow {
        case .project:
            let hasMission = !(projectScreenModel.screenModel.brief?.isEmpty ?? true)
            base = WorkflowPhaseStateModel(
                phaseID: .projectMission,
                ownerRole: "designer_dialog",
                status: hasMission ? .readyToClose : .inProgress,
                entryReason: hasMission ? "Project mission exists and can be refined or closed." : "Project mission still needs creative direction.",
                nextRecommendedPhases: [.displayDiscovery, .audioAnalysis, .design]
            )
            return applyPhaseOverlay(base)
        case .display:
            let status: WorkflowPhaseStatus = displayScreenModel.readinessProgress >= 0.75 ? .readyToClose : .inProgress
            base = WorkflowPhaseStateModel(
                phaseID: .displayDiscovery,
                ownerRole: "designer_dialog",
                status: status,
                entryReason: "Display understanding is being shaped into usable metadata.",
                nextRecommendedPhases: [.design, .sequencing]
            )
            return applyPhaseOverlay(base)
        case .audio:
            let header = audioScreenModel.header
            let status: WorkflowPhaseStatus
            if header.totalCount == 0 {
                status = .notStarted
            } else if header.needsReviewCount == 0 && header.failedCount == 0 && header.completeCount > 0 {
                status = .readyToClose
            } else {
                status = .inProgress
            }
            base = WorkflowPhaseStateModel(
                phaseID: .audioAnalysis,
                ownerRole: "audio_analyst",
                status: status,
                entryReason: "Tracks are being analyzed and prepared for downstream work.",
                nextRecommendedPhases: [.design, .sequencing]
            )
            return applyPhaseOverlay(base)
        case .design:
            base = WorkflowPhaseStateModel(
                phaseID: .design,
                ownerRole: "designer_dialog",
                status: .inProgress,
                entryReason: "Creative direction is being prepared before implementation.",
                nextRecommendedPhases: [.sequencing, .review]
            )
            return applyPhaseOverlay(base)
        case .sequence:
            let sequence = sequenceScreenModel.screenModel
            base = WorkflowPhaseStateModel(
                phaseID: .sequencing,
                ownerRole: "sequence_agent",
                status: sequence.overview.itemCount > 0 ? .inProgress : .notStarted,
                entryReason: "Design intent is being translated into xLights changes.",
                nextRecommendedPhases: [.review, .design]
            )
            return applyPhaseOverlay(base)
        case .review:
            base = WorkflowPhaseStateModel(
                phaseID: .review,
                ownerRole: "sequence_agent",
                status: .inProgress,
                entryReason: "Recent work is being checked and validated.",
                nextRecommendedPhases: [.sequencing, .design]
            )
            return applyPhaseOverlay(base)
        case .history:
            base = WorkflowPhaseStateModel(
                phaseID: .review,
                ownerRole: "app_assistant",
                status: .completed,
                entryReason: "History browsing is outside the active production workflow.",
                nextRecommendedPhases: [.design, .sequencing]
            )
            return applyPhaseOverlay(base)
        }
    }

    func transitionToPhase(_ phaseID: WorkflowPhaseID, reason: String = "") {
        activeWorkflowPhaseOverride = WorkflowPhaseStateModel(
            phaseID: phaseID,
            ownerRole: ownerRole(for: phaseID),
            status: .notStarted,
            entryReason: reason.isEmpty ? defaultEntryReason(for: phaseID) : reason,
            nextRecommendedPhases: recommendedNextPhases(for: phaseID)
        )
    }

    func markActivePhaseStarted() {
        guard let current = activeWorkflowPhaseOverride, current.status == .notStarted else { return }
        activeWorkflowPhaseOverride = WorkflowPhaseStateModel(
            phaseID: current.phaseID,
            ownerRole: current.ownerRole,
            status: .inProgress,
            entryReason: current.entryReason,
            nextRecommendedPhases: current.nextRecommendedPhases
        )
    }

    func applyAssistantActionRequest(_ request: AssistantActionRequestResult) {
        switch request.actionType {
        case "open_settings":
            showSettings = true
        case "refresh_current_workflow":
            refreshCurrentWorkflow()
        case "refresh_xlights_session":
            xlightsSessionModel.refresh()
        case "refresh_all":
            refreshAll()
        case "save_design_intent", "update_design_intent":
            designScreenModel.applyDesignIntentPayload(request.payload)
        case "generate_sequence_proposal":
            sequenceScreenModel.generateProposalFromDesignIntent()
        case "propose_display_metadata_from_layout":
            displayScreenModel.proposeMetadataFromLayout()
        case "apply_display_metadata_proposals":
            Task {
                do {
                    try await displayScreenModel.promoteDiscoveryProposals()
                } catch {
                    displayScreenModel.errorMessage = error.localizedDescription
                }
            }
        case "update_display_target_intent":
            let targetIDs = splitAssistantPayloadList(request.payload["targetIds"] ?? request.payload["targetIDs"] ?? request.payload["targets"] ?? "")
            guard !targetIDs.isEmpty else {
                displayScreenModel.errorMessage = "Target intent update requires exact xLights target IDs."
                return
            }
            displayScreenModel.saveTargetIntentFromUI(
                targetIDs: targetIDs,
                rolePreference: request.payload["rolePreference"],
                semanticHints: splitAssistantPayloadList(request.payload["semanticHints"] ?? ""),
                effectAvoidances: splitAssistantPayloadList(request.payload["effectAvoidances"] ?? "")
            )
        case "select_workflow":
            break
        default:
            break
        }
    }

    private func splitAssistantPayloadList(_ value: String) -> [String] {
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

    func clearProjectMission() {
        projectScreenModel.clearProjectBrief()
    }

    func clearWorkflowPhaseOverride() {
        activeWorkflowPhaseOverride = nil
    }

    private func isSetupIncomplete() -> Bool {
        let agentConfig = settingsScreenModel.screenModel.agentConfig
        let hasProvider = !agentConfig.model.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            !agentConfig.baseURL.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
            agentConfig.hasStoredAPIKey
        let hasProject = workspace.activeProject != nil
        return !hasProvider || !hasProject
    }

    private func applyPhaseOverlay(_ base: WorkflowPhaseStateModel) -> WorkflowPhaseStateModel {
        guard
            base.status == .readyToClose,
            let lastAssistant = assistantModel.messages.last(where: { $0.role == .assistant }),
            (lastAssistant.handledBy ?? "") == "app_assistant"
        else {
            return base
        }

        return WorkflowPhaseStateModel(
            phaseID: base.phaseID,
            ownerRole: "app_assistant",
            status: .handoffPending,
            entryReason: "This phase is complete enough to hand off. Choose the next step.",
            nextRecommendedPhases: base.nextRecommendedPhases
        )
    }

    private func ownerRole(for phaseID: WorkflowPhaseID) -> String {
        switch phaseID {
        case .setup:
            return "app_assistant"
        case .projectMission, .displayDiscovery, .design:
            return "designer_dialog"
        case .audioAnalysis:
            return "audio_analyst"
        case .sequencing, .review:
            return "sequence_agent"
        }
    }

    private func recommendedNextPhases(for phaseID: WorkflowPhaseID) -> [WorkflowPhaseID] {
        switch phaseID {
        case .setup:
            return [.projectMission, .audioAnalysis, .displayDiscovery]
        case .projectMission:
            return [.displayDiscovery, .audioAnalysis, .design]
        case .audioAnalysis:
            return [.design, .sequencing]
        case .displayDiscovery:
            return [.design, .sequencing]
        case .design:
            return [.sequencing, .review]
        case .sequencing:
            return [.review, .design]
        case .review:
            return [.sequencing, .design]
        }
    }

    private func defaultEntryReason(for phaseID: WorkflowPhaseID) -> String {
        switch phaseID {
        case .setup:
            return "App setup is still incomplete."
        case .projectMission:
            return "Project mission is being shaped."
        case .audioAnalysis:
            return "Audio analysis work is active."
        case .displayDiscovery:
            return "Display understanding work is active."
        case .design:
            return "Sequence design work is active."
        case .sequencing:
            return "Sequencing implementation work is active."
        case .review:
            return "Review and validation work is active."
        }
    }

    func refreshCurrentWorkflow() {
        switch selectedWorkflow {
        case .project:
            projectScreenModel.loadInitialProject()
            xlightsSessionModel.refresh()
        case .display:
            displayScreenModel.loadDisplay()
            xlightsSessionModel.refresh()
        case .audio:
            audioScreenModel.loadLibrary()
            xlightsSessionModel.refresh()
        case .design:
            designScreenModel.refresh()
            xlightsSessionModel.refresh()
        case .sequence:
            sequenceScreenModel.refresh()
            xlightsSessionModel.refresh()
        case .review:
            reviewScreenModel.refresh()
            xlightsSessionModel.refresh()
        case .history:
            historyScreenModel.loadHistory()
            xlightsSessionModel.refresh()
        }
    }

    func refreshAll() {
        projectScreenModel.loadInitialProject()
        displayScreenModel.loadDisplay()
        audioScreenModel.loadLibrary()
        designScreenModel.refresh()
        sequenceScreenModel.refresh()
        reviewScreenModel.refresh()
        historyScreenModel.loadHistory()
        settingsScreenModel.load()
        xlightsSessionModel.refresh()
    }

    private func buildDisplayDiscoveryCandidates(
        from rows: [DisplayLayoutRowModel],
        discoverySummary: DisplayDiscoverySummaryModel
    ) -> [[String: String]] {
        if !discoverySummary.candidateProps.isEmpty {
            return discoverySummary.candidateProps.map {
                [
                    "name": $0.name,
                    "type": $0.type,
                    "reason": $0.reason
                ]
            }
        }
        let scoredRows = rows
            .map { row in
                (
                    row: row,
                    score: displayDiscoveryScore(for: row)
                )
            }
            .filter { $0.score > 0 }

        let models = scoredRows
            .filter { !$0.row.targetType.lowercased().contains("modelgroup") }
            .sorted { lhs, rhs in
                if lhs.score != rhs.score { return lhs.score > rhs.score }
                return lhs.row.targetName.localizedCaseInsensitiveCompare(rhs.row.targetName) == .orderedAscending
            }

        let groups = scoredRows
            .filter { $0.row.targetType.lowercased().contains("modelgroup") }
            .sorted { lhs, rhs in
                if lhs.score != rhs.score { return lhs.score > rhs.score }
                return lhs.row.targetName.localizedCaseInsensitiveCompare(rhs.row.targetName) == .orderedAscending
            }

        let candidates = Array((models + groups).prefix(8))

        return candidates.map { candidate in
            [
                "name": candidate.row.targetName,
                "type": candidate.row.targetType,
                "reason": displayDiscoveryReason(for: candidate.row)
            ]
        }
    }

    private func displayDiscoveryScore(for row: DisplayLayoutRowModel) -> Int {
        let name = row.targetName.lowercased()
        let type = row.targetType.lowercased()
        if type.contains("submodel") {
            return 0
        }
        var score = 0
        let keywords = [
            "snowman", "santa", "tree", "mega", "star", "matrix",
            "arch", "window", "roof", "house", "flake", "snow",
            "cane", "candy", "gift", "present", "spinner", "wreath"
        ]
        for keyword in keywords where name.contains(keyword) {
            score += 4
        }
        if type.contains("modelgroup") {
            score -= 2
        } else {
            score += 2
        }
        if row.nodeCount >= 500 { score += 3 }
        else if row.nodeCount >= 150 { score += 2 }
        else if row.nodeCount >= 50 { score += 1 }
        if row.positionX != 0, abs(row.positionX) < 2.0 { score += 1 }
        if row.width >= 4.0 || row.height >= 4.0 { score += 1 }
        if row.submodelCount > 0 { score += 1 }
        if row.targetName.count > 2 { score += 1 }
        return score
    }

    private func displayDiscoveryReason(for row: DisplayLayoutRowModel) -> String {
        let name = row.targetName.lowercased()
        if name.contains("snowman") || name.contains("santa") {
            return "named prop that may deserve early confirmation if character or storyline meaning matters"
        }
        if name.contains("tree") || name.contains("mega") || name.contains("star") || name.contains("matrix") {
            return "major structure that may be important, but needs semantic confirmation before treating it as focal"
        }
        if row.nodeCount >= 500 {
            return "large structural footprint suggests it may belong in an early high-level branch of the conversation"
        }
        if row.positionX != 0, abs(row.positionX) < 2.0 {
            return "central placement suggests it may be worth discussing once the user identifies what parts of the display matter most"
        }
        if name.contains("arch") || name.contains("roof") || name.contains("window") {
            return "architectural or repeating structure that may define a broader support/background branch"
        }
        if name.contains("cane") || name.contains("candy") || name.contains("gift") || name.contains("present") {
            return "repeating themed prop that may belong to a broader support or accent branch"
        }
        return "name or structure suggests it may belong to an early high-level branch that should be confirmed with the user"
    }
}
