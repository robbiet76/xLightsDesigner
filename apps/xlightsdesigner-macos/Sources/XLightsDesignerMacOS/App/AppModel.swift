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
        return AssistantContextModel(
            activeProjectName: workspace.activeProject?.projectName ?? "No Project",
            workflowName: selectedWorkflow.rawValue,
            route: workflowRoute(),
            focusedSummary: focusedSummary(),
            projectMissionDocument: projectBrief?.document ?? "",
            rollingConversationSummary: assistantModel.rollingConversationSummary,
            activeSequenceLoaded: sequenceScreenModel.screenModel.hasLiveSequence,
            planOnlyMode: sequenceScreenModel.screenModel.planOnlyMode,
            showFolder: workspace.activeProject?.showFolder ?? "",
            displayTargetCount: layoutRows.count,
            displayLabeledTargetCount: labeledTargetCount,
            displayLabelNames: allLabelNames.sorted(),
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
