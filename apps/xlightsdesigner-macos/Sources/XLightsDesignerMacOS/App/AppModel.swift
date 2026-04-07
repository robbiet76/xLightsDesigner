import Foundation
import Observation

@Observable
final class AppModel {
    var selectedWorkflow: WorkflowID = .audio
    var showSettings = false

    let projectName = "No Project"
    let contextSummary = "Native scaffold only. No backend services are wired yet."
}
