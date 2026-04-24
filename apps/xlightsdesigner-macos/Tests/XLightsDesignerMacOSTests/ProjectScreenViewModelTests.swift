import Foundation
import Testing
@testable import XLightsDesignerMacOS

private struct ProjectScreenTestSessionStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

@MainActor
@Test func projectCanAdoptCurrentXLightsShowFolder() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-project-screen-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Show Folder Align \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/old-show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    let workspace = ProjectWorkspace(sessionStore: ProjectScreenTestSessionStore())
    workspace.setProject(project)
    let model = ProjectScreenViewModel(
        workspace: workspace,
        projectService: projectService,
        sessionStore: ProjectScreenTestSessionStore()
    )

    model.setShowFolderForActiveProject("  /tmp/current-xlights-show  ")

    let savedProject = try #require(workspace.activeProject)
    #expect(savedProject.showFolder == "/tmp/current-xlights-show")
    let reopened = try projectService.openProject(filePath: savedProject.projectFilePath)
    #expect(reopened.showFolder == "/tmp/current-xlights-show")
}
