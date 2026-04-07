import Foundation
import Observation

extension Notification.Name {
    static let projectWorkspaceDidChange = Notification.Name("ProjectWorkspaceDidChange")
}

@MainActor
@Observable
final class ProjectWorkspace {
    var activeProject: ActiveProjectModel? {
        didSet {
            NotificationCenter.default.post(name: .projectWorkspaceDidChange, object: nil)
        }
    }
    var projectBanner: ProjectBannerModel?

    func setProject(_ project: ActiveProjectModel?) {
        activeProject = project
    }
}
