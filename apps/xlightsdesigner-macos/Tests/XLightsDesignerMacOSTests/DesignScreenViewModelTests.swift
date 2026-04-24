import Foundation
import Testing
@testable import XLightsDesignerMacOS

private struct InMemoryProjectSessionStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

@MainActor
@Test func designIntentPersistsInProjectSnapshot() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-design-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let service = LocalProjectService(projectsRootPath: root.path)
    let workspace = ProjectWorkspace(sessionStore: InMemoryProjectSessionStore())
    let project = try service.createProject(
        draft: ProjectDraftModel(
            projectName: "Native Test Project \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    workspace.setProject(project)
    let model = DesignScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: service
    )

    model.intentDraft.goal = "Make the chorus feel like a clean red and white canopy."
    model.intentDraft.mood = "Warm, crisp, elegant."
    model.intentDraft.constraints = "Keep dense sparkle off the singing faces."
    model.intentDraft.targetScope = "Mega tree, roofline, and window frames."
    model.intentDraft.references = "Use the warm neighborhood mission as the anchor."
    model.intentDraft.approvalNotes = "Ready to hand off after one more target pass."
    model.updateAuthoringState()

    #expect(model.screenModel.authoring.canSave == true)

    model.saveDesignIntent()

    let reopened = try service.openProject(filePath: project.projectFilePath)
    let payload = reopened.snapshot["nativeDesignIntent"]?.value as? [String: Any]
    #expect(payload?["goal"] as? String == "Make the chorus feel like a clean red and white canopy.")
    #expect(payload?["targetScope"] as? String == "Mega tree, roofline, and window frames.")
    #expect((payload?["updatedAt"] as? String)?.isEmpty == false)
    #expect(model.screenModel.authoring.canSave == false)
    #expect(model.transientBanner?.state == .ready)
}

@MainActor
@Test func designIntentPayloadUpdatesSameNativeFields() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-design-action-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let service = LocalProjectService(projectsRootPath: root.path)
    let workspace = ProjectWorkspace(sessionStore: InMemoryProjectSessionStore())
    let project = try service.createProject(
        draft: ProjectDraftModel(
            projectName: "Native Test Project \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    workspace.setProject(project)
    let model = DesignScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: service
    )

    model.applyDesignIntentPayload([
        "goal": "Build a quiet verse and a wide chorus lift.",
        "mood": "Quiet, patient, then bright.",
        "constraints": "No global sparkle blanket.",
        "targetScope": "House outline and mega tree.",
        "references": "Lean into the saved project mission.",
        "approvalNotes": "Approved for sequencing draft."
    ])

    let reopened = try service.openProject(filePath: project.projectFilePath)
    let payload = reopened.snapshot["nativeDesignIntent"]?.value as? [String: Any]
    #expect(payload?["goal"] as? String == "Build a quiet verse and a wide chorus lift.")
    #expect(payload?["approvalNotes"] as? String == "Approved for sequencing draft.")
    #expect(model.intentDraft.targetScope == "House outline and mega tree.")
}
