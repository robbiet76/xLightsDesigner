import Foundation
import Observation

@MainActor
@Observable
final class ProjectWorkspace {
    var activeProject: ActiveProjectModel?
    var projectBanner: ProjectBannerModel?

    func setProject(_ project: ActiveProjectModel?) {
        activeProject = project
    }
}
