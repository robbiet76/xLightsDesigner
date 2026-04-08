import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
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

    init() {
        let workspace = ProjectWorkspace()
        self.workspace = workspace
        self.assistantModel = AssistantWindowViewModel()
        self.audioScreenModel = AudioScreenViewModel.sample()
        self.projectScreenModel = ProjectScreenViewModel(workspace: workspace)
        self.layoutScreenModel = LayoutScreenViewModel(workspace: workspace)
        self.designScreenModel = DesignScreenViewModel(workspace: workspace)
        self.sequenceScreenModel = SequenceScreenViewModel(workspace: workspace)
        self.reviewScreenModel = ReviewScreenViewModel(workspace: workspace)
        self.historyScreenModel = HistoryScreenViewModel(workspace: workspace)
        self.settingsScreenModel = SettingsScreenViewModel()
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
        AssistantContextModel(
            activeProjectName: workspace.activeProject?.projectName ?? "No Project",
            workflowName: selectedWorkflow.rawValue,
            route: workflowRoute(),
            focusedSummary: focusedSummary(),
            activeSequenceLoaded: sequenceScreenModel.screenModel.hasLiveSequence,
            planOnlyMode: sequenceScreenModel.screenModel.planOnlyMode
        )
    }
}
