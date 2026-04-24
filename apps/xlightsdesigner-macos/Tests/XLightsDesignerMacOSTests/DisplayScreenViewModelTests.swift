import Foundation
import Testing
@testable import XLightsDesignerMacOS

private struct DisplayTestProjectSessionStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

private final class StubDisplayService: DisplayService, @unchecked Sendable {
    var result: DisplayServiceResult

    init(result: DisplayServiceResult) {
        self.result = result
    }

    func loadDisplay(for project: ActiveProjectModel?) async throws -> DisplayServiceResult {
        result
    }

    func addTag(for project: ActiveProjectModel?, targetIDs: [String], tagName: String, description: String) async throws {}
    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws {}
    func saveTagDefinition(for project: ActiveProjectModel?, tagID: String?, name: String, description: String, color: DisplayLabelColor) async throws {}
    func deleteTagDefinition(for project: ActiveProjectModel?, tagID: String) async throws {}
}

@MainActor
@Test func displayLoadsPersistedLabelsAsConfirmedMetadataRows() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-display-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Display Labels \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    let workspace = ProjectWorkspace(sessionStore: DisplayTestProjectSessionStore())
    workspace.setProject(project)

    let label = DisplayLabelDefinitionModel(
        id: "tag-feature",
        name: "Feature Props",
        description: "Named props used for story moments.",
        usageCount: 2,
        color: .blue
    )
    let service = StubDisplayService(result: DisplayServiceResult(
        readiness: DisplayReadinessSummaryModel(
            state: .needsReview,
            totalTargets: 2,
            readyCount: 2,
            unresolvedCount: 0,
            orphanCount: 0,
            explanationText: "Ready.",
            nextStepText: "Continue."
        ),
        rows: [
            displayRow(name: "Snowman", labels: [label]),
            displayRow(name: "Train", labels: [label])
        ],
        sourceSummary: "test",
        banners: [],
        labelDefinitions: [label]
    ))
    let model = DisplayScreenViewModel(
        workspace: workspace,
        displayService: service,
        displayDiscoveryStore: LocalDisplayDiscoveryStateStore()
    )

    model.loadDisplay()
    try await Task.sleep(for: .milliseconds(80))

    #expect(model.confirmedMetadataCount == 1)
    #expect(model.proposedMetadataCount == 0)
    #expect(model.screenModel.metadataRows.first?.subject == "Feature Props")
    #expect(model.screenModel.metadataRows.first?.status == .confirmed)
    #expect(model.screenModel.metadataRows.first?.linkedTargets == ["Snowman", "Train"])
}

private func displayRow(name: String, labels: [DisplayLabelDefinitionModel]) -> DisplayLayoutRowModel {
    DisplayLayoutRowModel(
        id: name,
        targetName: name,
        targetType: "Model",
        nodeCount: 100,
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        width: 1,
        height: 1,
        depth: 0,
        labelDefinitions: labels,
        submodelCount: 0,
        directGroupMembers: [],
        activeGroupMembers: [],
        flattenedGroupMembers: [],
        flattenedAllGroupMembers: []
    )
}
