import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    private let displayDiscoveryStore: DisplayDiscoveryStateStore
    private let userProfileStore: AssistantUserProfileStore

    var selectedWorkflow: WorkflowID = .project
    var showSettings = false
    var showAssistantPanel = true

    let workspace: ProjectWorkspace
    let assistantModel: AssistantWindowViewModel
    let audioScreenModel: AudioScreenViewModel
    let projectScreenModel: ProjectScreenViewModel
    let layoutScreenModel: LayoutScreenViewModel
    let designScreenModel: DesignScreenViewModel
    let sequenceScreenModel: SequenceScreenViewModel
    let reviewScreenModel: ReviewScreenViewModel
    let historyScreenModel: HistoryScreenViewModel
    let settingsScreenModel: SettingsScreenViewModel
    let xlightsSessionModel: XLightsSessionViewModel

    init(
        displayDiscoveryStore: DisplayDiscoveryStateStore = LocalDisplayDiscoveryStateStore(),
        userProfileStore: AssistantUserProfileStore = LocalAssistantUserProfileStore()
    ) {
        self.displayDiscoveryStore = displayDiscoveryStore
        self.userProfileStore = userProfileStore
        let workspace = ProjectWorkspace()
        self.workspace = workspace
        self.xlightsSessionModel = XLightsSessionViewModel(workspace: workspace)
        self.assistantModel = AssistantWindowViewModel()
        self.audioScreenModel = AudioScreenViewModel.sample()
        self.projectScreenModel = ProjectScreenViewModel(workspace: workspace)
        self.layoutScreenModel = LayoutScreenViewModel(workspace: workspace)
        self.designScreenModel = DesignScreenViewModel(workspace: workspace)
        self.sequenceScreenModel = SequenceScreenViewModel(workspace: workspace)
        self.reviewScreenModel = ReviewScreenViewModel(workspace: workspace)
        self.historyScreenModel = HistoryScreenViewModel(workspace: workspace)
        self.settingsScreenModel = SettingsScreenViewModel()
        self.xlightsSessionModel.refresh()
    }

    func workflowRoute() -> String {
        switch selectedWorkflow {
        case .project:
            return "project"
        case .layout:
            return "layout"
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
        case .layout:
            switch layoutScreenModel.screenModel.selectedTarget {
            case let .selected(target):
                return target.identity
            default:
                return "No target selected"
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
        let layoutRows = layoutScreenModel.screenModel.rows
        let taggedTargetCount = layoutRows.filter { !$0.tagDefinitions.isEmpty }.count
        let allTagNames = Set(layoutScreenModel.screenModel.tagDefinitions.map(\.name))
        let discoverySummary = displayDiscoveryStore.summary(for: workspace.activeProject)
        let discoveryCandidates = buildDisplayDiscoveryCandidates(from: layoutRows, discoverySummary: discoverySummary)
        let userPreferenceNotes = (try? userProfileStore.load().preferenceNotes.map(\.text)) ?? []
        let selectedLayoutTarget: String
        let selectedLayoutTags: [String]
        switch layoutScreenModel.screenModel.selectedTarget {
        case let .selected(target):
            selectedLayoutTarget = target.identity
            selectedLayoutTags = target.assignedTags.map(\.name)
        case let .multi(selection):
            selectedLayoutTarget = "\(selection.selectionCount) targets selected"
            selectedLayoutTags = selection.commonTags.map(\.name)
        default:
            selectedLayoutTarget = ""
            selectedLayoutTags = []
        }
        let xlights = xlightsSessionModel.snapshot
        let sequence = sequenceScreenModel.screenModel
        return AssistantContextModel(
            activeProjectName: workspace.activeProject?.projectName ?? "No Project",
            workflowName: selectedWorkflow.rawValue,
            route: workflowRoute(),
            focusedSummary: focusedSummary(),
            activeSequenceLoaded: sequenceScreenModel.screenModel.hasLiveSequence,
            planOnlyMode: sequenceScreenModel.screenModel.planOnlyMode,
            showFolder: workspace.activeProject?.showFolder ?? "",
            layoutTargetCount: layoutRows.count,
            layoutTaggedTargetCount: taggedTargetCount,
            layoutTagNames: allTagNames.sorted(),
            selectedLayoutTarget: selectedLayoutTarget,
            selectedLayoutTags: selectedLayoutTags.sorted(),
            displayDiscoveryCandidates: discoveryCandidates,
            displayDiscoveryStatus: discoverySummary.status.rawValue,
            displayDiscoveryTranscriptCount: discoverySummary.transcriptCount,
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
        from rows: [LayoutRowModel],
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
        let candidates = rows
            .map { row in
                (
                    row: row,
                    score: displayDiscoveryScore(for: row)
                )
            }
            .filter { $0.score > 0 }
            .sorted { lhs, rhs in
                if lhs.score != rhs.score { return lhs.score > rhs.score }
                return lhs.row.targetName.localizedCaseInsensitiveCompare(rhs.row.targetName) == .orderedAscending
            }
            .prefix(8)

        return candidates.map { candidate in
            [
                "name": candidate.row.targetName,
                "type": candidate.row.targetType,
                "reason": displayDiscoveryReason(for: candidate.row)
            ]
        }
    }

    private func displayDiscoveryScore(for row: LayoutRowModel) -> Int {
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
        if type.contains("modelgroup") { score += 3 }
        if row.nodeCount >= 500 { score += 3 }
        else if row.nodeCount >= 150 { score += 2 }
        else if row.nodeCount >= 50 { score += 1 }
        if row.positionX != 0, abs(row.positionX) < 2.0 { score += 1 }
        if row.width >= 4.0 || row.height >= 4.0 { score += 1 }
        if row.submodelCount > 0 { score += 1 }
        if row.targetName.count > 2 { score += 1 }
        return score
    }

    private func displayDiscoveryReason(for row: LayoutRowModel) -> String {
        let name = row.targetName.lowercased()
        if name.contains("snowman") || name.contains("santa") {
            return "named prop that may have character significance"
        }
        if name.contains("tree") || name.contains("mega") || name.contains("star") || name.contains("matrix") {
            return "large or likely focal display structure"
        }
        if row.nodeCount >= 500 {
            return "large visual footprint or node count suggests it may drive major scenes"
        }
        if row.positionX != 0, abs(row.positionX) < 2.0 {
            return "central position suggests it may need explicit role guidance"
        }
        if name.contains("arch") || name.contains("roof") || name.contains("window") {
            return "architectural or repeating structure that may need grouping guidance"
        }
        if name.contains("cane") || name.contains("candy") || name.contains("gift") || name.contains("present") {
            return "named themed prop that may deserve explicit role guidance"
        }
        return "name or structure suggests it may be worth clarifying early"
    }
}
