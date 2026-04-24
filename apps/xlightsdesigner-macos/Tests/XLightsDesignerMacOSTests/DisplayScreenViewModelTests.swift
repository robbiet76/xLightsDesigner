import Foundation
import Testing
@testable import XLightsDesignerMacOS

private struct DisplayTestProjectSessionStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

private final class StubDisplayService: DisplayService, @unchecked Sendable {
    var result: DisplayServiceResult
    var savedTargetPreference: (targetIDs: [String], rolePreference: String?, semanticHints: [String], effectAvoidances: [String])?

    init(result: DisplayServiceResult) {
        self.result = result
    }

    func loadDisplay(for project: ActiveProjectModel?) async throws -> DisplayServiceResult {
        result
    }

    func addTag(for project: ActiveProjectModel?, targetIDs: [String], tagName: String, description: String) async throws {}
    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws {}
    func saveTargetPreference(for project: ActiveProjectModel?, targetIDs: [String], rolePreference: String?, semanticHints: [String], effectAvoidances: [String]) async throws {
        savedTargetPreference = (targetIDs, rolePreference, semanticHints, effectAvoidances)
    }
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
        labelDefinitions: [label],
        targetPreferences: [:],
        visualHintDefinitions: []
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

@MainActor
@Test func displayShowsTargetIntentPreferencesAsConfirmedMetadataRows() async throws {
    let workspace = ProjectWorkspace(sessionStore: DisplayTestProjectSessionStore())
    workspace.setProject(ActiveProjectModel(
        id: "project-1",
        projectName: "Display Intent",
        projectFilePath: "/tmp/Display Intent.xdproj",
        showFolder: "/tmp/show",
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-04-24T00:00:00Z",
        updatedAt: "2026-04-24T00:00:00Z",
        snapshot: [:]
    ))
    let service = StubDisplayService(result: DisplayServiceResult(
        readiness: DisplayReadinessSummaryModel(
            state: .needsReview,
            totalTargets: 1,
            readyCount: 1,
            unresolvedCount: 0,
            orphanCount: 0,
            explanationText: "Ready.",
            nextStepText: "Continue."
        ),
        rows: [displayRow(name: "MegaTree", labels: [])],
        sourceSummary: "test",
        banners: [],
        labelDefinitions: [],
        targetPreferences: [
            "MegaTree": PersistedDisplayTargetPreference(
                rolePreference: "lead",
                semanticHints: ["centerpiece", "sparkle"],
                submodelHints: nil,
                effectAvoidances: ["Bars"]
            )
        ],
        visualHintDefinitions: []
    ))
    let model = DisplayScreenViewModel(
        workspace: workspace,
        displayService: service,
        displayDiscoveryStore: LocalDisplayDiscoveryStateStore()
    )

    model.loadDisplay()
    try await Task.sleep(for: .milliseconds(80))

    let row = try #require(model.screenModel.metadataRows.first { $0.id == "target-preference::MegaTree" })
    #expect(row.category == "Target Intent")
    #expect(row.value.contains("Role: lead"))
    #expect(row.value.contains("Hints: centerpiece, sparkle"))
    #expect(row.value.contains("Avoid: Bars"))
}

@MainActor
@Test func displayMetadataEditorSavesTargetIntentPreferences() async throws {
    let workspace = ProjectWorkspace(sessionStore: DisplayTestProjectSessionStore())
    workspace.setProject(ActiveProjectModel(
        id: "project-1",
        projectName: "Display Intent Save",
        projectFilePath: "/tmp/Display Intent Save.xdproj",
        showFolder: "/tmp/show",
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-04-24T00:00:00Z",
        updatedAt: "2026-04-24T00:00:00Z",
        snapshot: [:]
    ))
    let service = StubDisplayService(result: DisplayServiceResult(
        readiness: DisplayReadinessSummaryModel(
            state: .needsReview,
            totalTargets: 1,
            readyCount: 0,
            unresolvedCount: 1,
            orphanCount: 0,
            explanationText: "Ready.",
            nextStepText: "Continue."
        ),
        rows: [displayRow(name: "MegaTree", labels: [])],
        sourceSummary: "test",
        banners: [],
        labelDefinitions: [],
        targetPreferences: [:],
        visualHintDefinitions: []
    ))
    let model = DisplayScreenViewModel(
        workspace: workspace,
        displayService: service,
        displayDiscoveryStore: LocalDisplayDiscoveryStateStore()
    )
    model.loadDisplay()
    try await Task.sleep(for: .milliseconds(80))

    model.startAddMetadata()
    model.metadataEditor.subject = "MegaTree"
    model.metadataEditor.subjectType = "Model"
    model.metadataEditor.category = "Focal Hierarchy"
    model.metadataEditor.value = "Primary visual anchor"
    model.metadataEditor.rolePreference = "lead"
    model.metadataEditor.semanticHintsText = "centerpiece, sparkle"
    model.metadataEditor.effectAvoidancesText = "Bars"
    model.metadataEditor.targetNames = ["MegaTree"]
    model.saveMetadataEditor()
    try await Task.sleep(for: .milliseconds(80))

    #expect(service.savedTargetPreference?.targetIDs == ["MegaTree"])
    #expect(service.savedTargetPreference?.rolePreference == "lead")
    #expect(service.savedTargetPreference?.semanticHints == ["centerpiece", "sparkle"])
    #expect(service.savedTargetPreference?.effectAvoidances == ["Bars"])
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
