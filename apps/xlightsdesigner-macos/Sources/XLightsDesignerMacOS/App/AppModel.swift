import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    var selectedWorkflow: WorkflowID = .project
    var showSettings = false

    let workspace: ProjectWorkspace
    let audioScreenModel: AudioScreenViewModel
    let projectScreenModel: ProjectScreenViewModel
    let layoutScreenModel: LayoutScreenViewModel

    init() {
        let workspace = ProjectWorkspace()
        self.workspace = workspace
        self.audioScreenModel = AudioScreenViewModel.sample()
        self.projectScreenModel = ProjectScreenViewModel(workspace: workspace)
        self.layoutScreenModel = LayoutScreenViewModel(workspace: workspace)
    }
}
