import Foundation
import Observation

extension Notification.Name {
    static let projectWorkspaceDidChange = Notification.Name("ProjectWorkspaceDidChange")
    static let displayDiscoveryDidChange = Notification.Name("DisplayDiscoveryDidChange")
}

@MainActor
@Observable
final class ProjectWorkspace {
    private let sessionStore: ProjectSessionStore
    var activeProject: ActiveProjectModel? {
        didSet {
            sessionStore.saveLastProjectPath(activeProject?.projectFilePath)
            NotificationCenter.default.post(name: .projectWorkspaceDidChange, object: nil)
        }
    }
    var projectBanner: ProjectBannerModel?

    init(sessionStore: ProjectSessionStore = LocalProjectSessionStore()) {
        self.sessionStore = sessionStore
    }

    func setProject(_ project: ActiveProjectModel?) {
        activeProject = project
    }
}
