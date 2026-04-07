import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct ProjectServiceTests {
    @Test func createProjectStoresExpectedFileName() throws {
        let service = LocalProjectService()
        let name = "Native Test Project \(UUID().uuidString.prefix(6))"
        let project = try service.createProject(draft: ProjectDraftModel(projectName: name, showFolder: "/tmp/show", mediaPath: "/tmp/media"))
        #expect(project.projectName == name)
        #expect(project.projectFilePath.hasSuffix("/\(name)/\(name).xdproj"))
    }
}
