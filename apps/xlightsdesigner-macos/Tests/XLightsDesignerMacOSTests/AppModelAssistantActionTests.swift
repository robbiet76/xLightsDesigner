import Foundation
import Testing
@testable import XLightsDesignerMacOS

@MainActor
@Test func assistantActionCanSeedDisplayMetadataFromLayout() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-assistant-action-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Assistant Display \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    let model = AppModel()
    model.workspace.setProject(project)
    model.displayScreenModel.screenModel = DisplayScreenModel(
        header: DisplayHeaderModel(
            title: "Display",
            subtitle: "",
            activeProjectName: project.projectName,
            sourceSummary: "test"
        ),
        readinessSummary: DisplayReadinessSummaryModel(
            state: .needsReview,
            totalTargets: 2,
            readyCount: 0,
            unresolvedCount: 2,
            orphanCount: 0,
            explanationText: "",
            nextStepText: ""
        ),
        rows: [
            assistantActionDisplayRow(name: "Snowflakes", type: "ModelGroup", members: ["Snowflake-01", "Snowflake-02"]),
            assistantActionDisplayRow(name: "Snowflake-01", type: "Custom", members: []),
            assistantActionDisplayRow(name: "Snowflake-02", type: "Custom", members: [])
        ],
        metadataRows: [],
        overviewCards: [],
        selectedMetadata: .none(""),
        banners: [],
        labelDefinitions: [],
        discoveryProposals: []
    )

    model.applyAssistantActionRequest(AssistantActionRequestResult(
        actionType: "propose_display_metadata_from_layout",
        payload: [:],
        reason: "User asked to seed display metadata from the layout."
    ))

    let summary = LocalDisplayDiscoveryStateStore().summary(for: project)
    #expect(summary.proposedTags.map(\.tagName) == ["Snowflakes"])
    #expect(summary.proposedTags.first?.targetNames == ["Snowflake-01", "Snowflake-02"])
}

@MainActor
@Test func assistantActionCanUpdateDisplayTargetIntent() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-assistant-target-intent-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Assistant Target Intent \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    let model = AppModel()
    model.workspace.setProject(project)

    model.applyAssistantActionRequest(AssistantActionRequestResult(
        actionType: "update_display_target_intent",
        payload: [
            "targetIds": "MegaTree, Roofline",
            "rolePreference": "lead",
            "semanticHints": "centerpiece, sparkle",
            "effectAvoidances": "Bars"
        ],
        reason: "User approved target intent."
    ))
    try await Task.sleep(for: .milliseconds(120))

    let document = try LocalDisplayMetadataStore().load(for: project)
    #expect(document.preferencesByTargetId["MegaTree"]?.rolePreference == "lead")
    #expect(document.preferencesByTargetId["MegaTree"]?.semanticHints == ["centerpiece", "sparkle"])
    #expect(document.preferencesByTargetId["MegaTree"]?.effectAvoidances == ["Bars"])
    #expect(document.preferencesByTargetId["Roofline"]?.rolePreference == "lead")
}

@MainActor
@Test func automationStyleActionCanUpdateDisplayTargetIntentThroughDisplayModel() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-automation-target-intent-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Automation Target Intent \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    let model = AppModel()
    model.workspace.setProject(project)

    try await model.displayScreenModel.saveTargetIntent(
        targetIDs: ["MegaTree"],
        rolePreference: "lead",
        semanticHints: ["centerpiece"],
        effectAvoidances: ["Bars"]
    )

    let document = try LocalDisplayMetadataStore().load(for: project)
    #expect(document.preferencesByTargetId["MegaTree"]?.rolePreference == "lead")
    #expect(document.preferencesByTargetId["MegaTree"]?.semanticHints == ["centerpiece"])
    #expect(document.preferencesByTargetId["MegaTree"]?.effectAvoidances == ["Bars"])
}

private func assistantActionDisplayRow(name: String, type: String, members: [String]) -> DisplayLayoutRowModel {
    DisplayLayoutRowModel(
        id: name,
        targetName: name,
        targetType: type,
        nodeCount: 100,
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        width: 1,
        height: 1,
        depth: 0,
        labelDefinitions: [],
        submodelCount: 0,
        directGroupMembers: members,
        activeGroupMembers: members,
        flattenedGroupMembers: members,
        flattenedAllGroupMembers: members
    )
}
