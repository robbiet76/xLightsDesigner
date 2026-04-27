import Foundation
import Testing
@testable import XLightsDesignerMacOS

private struct InMemoryProjectSessionStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

private final class StubVisualDesignAssetGenerationService: VisualDesignAssetGenerationService, @unchecked Sendable {
    private(set) var calls: [(projectFilePath: String, sequenceID: String, intentText: String, themeSummary: String, baseURL: String)] = []
    private(set) var revisionCalls: [(projectFilePath: String, sequenceID: String, revisionRequest: String, themeSummary: String, baseURL: String)] = []
    var result = VisualDesignAssetGenerationResult(
        artifactID: "visual-pack-test",
        manifestPath: "/tmp/visual-design-manifest.json",
        assetDir: "/tmp/visual-design",
        model: "gpt-image-1.5",
        currentRevisionID: "board-r001"
    )
    var revisionResult = VisualDesignAssetGenerationResult(
        artifactID: "visual-pack-test",
        manifestPath: "/tmp/visual-design-manifest.json",
        assetDir: "/tmp/visual-design",
        model: "gpt-image-1.5",
        currentRevisionID: "board-r002"
    )
    var error: Error?
    var revisionError: Error?

    func generateVisualDesignAssetPack(
        projectFilePath: String,
        sequenceID: String,
        intentText: String,
        themeSummary: String,
        baseURL: String
    ) async throws -> VisualDesignAssetGenerationResult {
        calls.append((projectFilePath, sequenceID, intentText, themeSummary, baseURL))
        if let error { throw error }
        return result
    }

    func reviseVisualDesignAssetPack(
        projectFilePath: String,
        sequenceID: String,
        revisionRequest: String,
        themeSummary: String,
        baseURL: String
    ) async throws -> VisualDesignAssetGenerationResult {
        revisionCalls.append((projectFilePath, sequenceID, revisionRequest, themeSummary, baseURL))
        if let revisionError { throw revisionError }
        return revisionResult
    }
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

@MainActor
@Test func designScreenLoadsVisualInspirationManifestFromProjectArtifacts() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-design-visual-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let service = LocalProjectService(projectsRootPath: root.path)
    let workspace = ProjectWorkspace(sessionStore: InMemoryProjectSessionStore())
    let project = try service.createProject(
        draft: ProjectDraftModel(
            projectName: "Native Visual Test \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
    let visualDir = projectDir.appendingPathComponent("artifacts/visual-design/seq-1", isDirectory: true)
    try FileManager.default.createDirectory(at: visualDir, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: visualDir.appendingPathComponent("revisions", isDirectory: true), withIntermediateDirectories: true)
    try Data("fixture".utf8).write(to: visualDir.appendingPathComponent("revisions/board-r002.png"))
    let manifest = """
    {
      "artifactType": "visual_design_asset_pack_v1",
      "artifactId": "visual-pack-1",
      "creativeIntent": {
        "themeSummary": "Warm candlelit holiday board",
        "palette": [
          { "name": "candle gold", "hex": "#ffc45c", "role": "warm highlight" }
        ],
        "motifs": ["window glow"]
      },
      "palette": {
        "required": true,
        "displayMode": "separate_and_optional_in_image",
        "coordinationRule": "Designer palette is canonical for sequencing; image colors are diagnostic validation context.",
        "colors": [
          { "name": "candle gold", "hex": "#ffc45c", "role": "warm highlight" },
          { "name": "pine green", "hex": "#1f6f4a", "role": "support" }
        ]
      },
      "displayAsset": {
        "kind": "inspiration_board",
        "relativePath": "revisions/board-r002.png",
        "currentRevisionId": "board-r002"
      },
      "imageRevisions": [
        {
          "revisionId": "board-r001",
          "mode": "generate",
          "relativePath": "inspiration-board.png",
          "paletteLocked": true,
          "changeSummary": "Initial board."
        },
        {
          "revisionId": "board-r002",
          "parentRevisionId": "board-r001",
          "mode": "edit",
          "relativePath": "revisions/board-r002.png",
          "paletteLocked": false,
          "paletteChangeSummary": "Added pine green support.",
          "changeSummary": "Softened glow."
        }
      ]
    }
    """
    try Data(manifest.utf8).write(to: visualDir.appendingPathComponent("visual-design-manifest.json"))

    workspace.setProject(project)
    let model = DesignScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: service
    )

    #expect(model.screenModel.visualInspiration.available == true)
    #expect(model.screenModel.visualInspiration.summary == "Warm candlelit holiday board")
    #expect(model.screenModel.visualInspiration.currentRevisionId == "board-r002")
    #expect(model.screenModel.visualInspiration.palette.count == 2)
    #expect(model.screenModel.visualInspiration.palette.first?.hex == "#ffc45c")
    #expect(model.screenModel.visualInspiration.revisionSummary.contains("Added pine green support."))
    #expect(model.screenModel.visualInspiration.imagePath.hasSuffix("revisions/board-r002.png"))
    #expect(model.screenModel.visualInspiration.displayedRevisionId == "board-r002")
    #expect(model.screenModel.visualInspiration.revisionHistory.count == 2)
    #expect(model.screenModel.visualInspiration.revisionHistory[1].isCurrent == true)
    #expect(model.screenModel.visualInspiration.revisionHistory[1].isSelected == true)

    model.selectVisualInspirationRevision("board-r001")

    #expect(model.screenModel.visualInspiration.currentRevisionId == "board-r002")
    #expect(model.screenModel.visualInspiration.displayedRevisionId == "board-r001")
    #expect(model.screenModel.visualInspiration.imagePath.hasSuffix("inspiration-board.png"))
    #expect(model.screenModel.visualInspiration.revisionHistory[0].isSelected == true)
}

@MainActor
@Test func designScreenBlocksVisualInspirationWithoutSelectedSong() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-design-missing-song-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let service = LocalProjectService(projectsRootPath: root.path)
    let workspace = ProjectWorkspace(sessionStore: InMemoryProjectSessionStore())
    let project = try service.createProject(
        draft: ProjectDraftModel(
            projectName: "Native Missing Song \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    workspace.setProject(project)
    let visualService = StubVisualDesignAssetGenerationService()
    let model = DesignScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: service,
        visualAssetGenerationService: visualService
    )

    model.intentDraft.goal = "Create a warm candlelit chorus board."
    model.generateVisualInspiration()

    #expect(visualService.calls.isEmpty)
    #expect(model.transientBanner?.state == .blocked)
    #expect(model.transientBanner?.text.contains("Select or open a song/sequence") == true)
}

@MainActor
@Test func designScreenGeneratesVisualInspirationThroughService() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-design-generate-visual-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let service = LocalProjectService(projectsRootPath: root.path)
    let workspace = ProjectWorkspace(sessionStore: InMemoryProjectSessionStore())
    let project = try service.createProject(
        draft: ProjectDraftModel(
            projectName: "Native Generate Visual \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "/tmp/song.mp3",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    workspace.setProject(project)
    let visualService = StubVisualDesignAssetGenerationService()
    let model = DesignScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: service,
        visualAssetGenerationService: visualService
    )

    model.intentDraft.goal = "Create a warm candlelit chorus board."
    model.intentDraft.mood = "Warm gold and pine green."
    model.intentDraft.targetScope = "Mega tree and roofline."
    model.generateVisualInspiration()

    try await Task.sleep(nanoseconds: 50_000_000)

    #expect(visualService.calls.count == 1)
    #expect(visualService.calls.first?.projectFilePath == project.projectFilePath)
    #expect(visualService.calls.first?.intentText.contains("warm candlelit chorus") == true)
    #expect(visualService.calls.first?.themeSummary.contains("Warm gold") == true)
    #expect(model.isGeneratingVisualInspiration == false)
    #expect(model.transientBanner?.state == .ready)
}

@MainActor
@Test func designScreenRevisesVisualInspirationThroughService() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-design-revise-visual-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let service = LocalProjectService(projectsRootPath: root.path)
    let workspace = ProjectWorkspace(sessionStore: InMemoryProjectSessionStore())
    let project = try service.createProject(
        draft: ProjectDraftModel(
            projectName: "Native Revise Visual \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "/tmp/song.mp3",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
    let visualDir = projectDir.appendingPathComponent("artifacts/visual-design/seq-1", isDirectory: true)
    try FileManager.default.createDirectory(at: visualDir, withIntermediateDirectories: true)
    try Data("fixture".utf8).write(to: visualDir.appendingPathComponent("inspiration-board.png"))
    let manifest = """
    {
      "artifactType": "visual_design_asset_pack_v1",
      "artifactId": "visual-pack-1",
      "creativeIntent": {
        "themeSummary": "Warm candlelit holiday board",
        "inspirationPrompt": "Create a warm candlelit holiday board.",
        "palette": [
          { "name": "candle gold", "hex": "#ffc45c", "role": "warm highlight" }
        ]
      },
      "palette": {
        "required": true,
        "colors": [
          { "name": "candle gold", "hex": "#ffc45c", "role": "warm highlight" }
        ]
      },
      "displayAsset": {
        "kind": "inspiration_board",
        "relativePath": "inspiration-board.png",
        "currentRevisionId": "board-r001"
      },
      "imageRevisions": [
        {
          "revisionId": "board-r001",
          "mode": "generate",
          "relativePath": "inspiration-board.png",
          "paletteLocked": true,
          "changeSummary": "Initial board."
        }
      ]
    }
    """
    try Data(manifest.utf8).write(to: visualDir.appendingPathComponent("visual-design-manifest.json"))
    workspace.setProject(project)
    let visualService = StubVisualDesignAssetGenerationService()
    let model = DesignScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: service,
        visualAssetGenerationService: visualService
    )

    model.intentDraft.goal = "Create a warm candlelit chorus board."
    model.intentDraft.mood = "Warm gold and pine green."
    model.visualInspirationRevisionDraft = "Make the candle glow softer while preserving the palette."
    model.reviseVisualInspiration()

    try await Task.sleep(nanoseconds: 50_000_000)

    #expect(visualService.revisionCalls.count == 1)
    #expect(visualService.revisionCalls.first?.projectFilePath == project.projectFilePath)
    #expect(visualService.revisionCalls.first?.revisionRequest.contains("candle glow softer") == true)
    #expect(visualService.revisionCalls.first?.themeSummary.contains("Warm gold") == true)
    #expect(model.visualInspirationRevisionDraft == "")
    #expect(model.isRevisingVisualInspiration == false)
    #expect(model.transientBanner?.text.contains("board-r002") == true)
}
