import Foundation
import Testing
@testable import XLightsDesignerMacOS

private struct SequenceTestProjectSessionStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

private final class StubSequenceProposalService: SequenceProposalService, @unchecked Sendable {
    private(set) var prompt = ""
    private(set) var projectFilePath = ""
    private(set) var selectedTagNames: [String] = []
    private(set) var callCount = 0

    func generateProposal(projectFilePath: String, appRootPath: String, endpoint: String, prompt: String, selectedTagNames: [String]) async throws -> SequenceProposalGenerationResult {
        callCount += 1
        self.projectFilePath = projectFilePath
        self.prompt = prompt
        self.selectedTagNames = selectedTagNames
        return SequenceProposalGenerationResult(
            summary: "Generated proposal.",
            proposalArtifactID: "proposal-1",
            intentArtifactID: "intent-1",
            warningCount: 0
        )
    }
}

@MainActor
@Test func sequencePassesSelectedMetadataTagsToProposalGeneration() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-sequence-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Metadata Tag Proposal \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    var projectWithIntent = project
    projectWithIntent.snapshot["audioPathInput"] = AnyCodable("/tmp/show/song.mp3")
    projectWithIntent.snapshot["sequencePathInput"] = AnyCodable("/tmp/show/Metadata Tag Proposal.xsq")
    projectWithIntent.snapshot["nativeDesignIntent"] = AnyCodable([
        "goal": "Make the chorus read through the lead display element."
    ])
    let workspace = ProjectWorkspace(sessionStore: SequenceTestProjectSessionStore())
    workspace.setProject(projectWithIntent)
    let proposalService = StubSequenceProposalService()
    let model = SequenceScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: projectService,
        proposalService: proposalService
    )

    model.generateProposalFromDesignIntent(selectedTagNames: ["lead", "centerpiece"])
    try await Task.sleep(for: .milliseconds(120))

    #expect(proposalService.selectedTagNames == ["lead", "centerpiece"])
    #expect(model.isGeneratingProposal == false)
    #expect(model.transientBanner?.state == .ready)
}

@MainActor
private final class ProjectArtifactNotificationRecorder {
    private let projectFilePath: String
    private(set) var count = 0

    init(projectFilePath: String) {
        self.projectFilePath = projectFilePath
    }

    func record(projectFilePath candidate: String?) {
        guard candidate == projectFilePath else { return }
        count += 1
    }
}

@MainActor
@Test func sequenceGeneratesProposalFromNativeDesignIntent() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-sequence-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Native Test Project \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    var projectWithIntent = project
    projectWithIntent.snapshot["audioPathInput"] = AnyCodable("/tmp/show/song.mp3")
    projectWithIntent.snapshot["sequencePathInput"] = AnyCodable("/tmp/show/Native Test Project.xsq")
    projectWithIntent.snapshot["nativeDesignIntent"] = AnyCodable([
        "goal": "Make the chorus feel like a clean red and white canopy.",
        "mood": "Warm, crisp, elegant.",
        "constraints": "Keep dense sparkle off the singing faces.",
        "targetScope": "Mega tree, roofline, and window frames.",
        "references": "Use the warm neighborhood mission as the anchor.",
        "approvalNotes": "Ready to hand off after one more target pass."
    ])
    let workspace = ProjectWorkspace(sessionStore: SequenceTestProjectSessionStore())
    workspace.setProject(projectWithIntent)
    let proposalService = StubSequenceProposalService()
    let model = SequenceScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: projectService,
        proposalService: proposalService
    )

    model.generateProposalFromDesignIntent()
    try await Task.sleep(for: .milliseconds(120))

    #expect(proposalService.projectFilePath == project.projectFilePath)
    #expect(proposalService.prompt.contains("Goal: Make the chorus feel like a clean red and white canopy."))
    #expect(proposalService.prompt.contains("Target scope: Mega tree, roofline, and window frames."))
    #expect(model.isGeneratingProposal == false)
    #expect(model.transientBanner?.state == .ready)
}

@MainActor
@Test func sequencePostsProjectArtifactsDidChangeAfterProposalGeneration() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-sequence-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Artifact Notification \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    var projectWithIntent = project
    projectWithIntent.snapshot["audioPathInput"] = AnyCodable("/tmp/show/song.mp3")
    projectWithIntent.snapshot["sequencePathInput"] = AnyCodable("/tmp/show/Artifact Notification.xsq")
    projectWithIntent.snapshot["nativeDesignIntent"] = AnyCodable([
        "goal": "Create a clean red and white chorus."
    ])
    let workspace = ProjectWorkspace(sessionStore: SequenceTestProjectSessionStore())
    workspace.setProject(projectWithIntent)
    let proposalService = StubSequenceProposalService()
    let model = SequenceScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: projectService,
        proposalService: proposalService
    )
    let recorder = ProjectArtifactNotificationRecorder(projectFilePath: project.projectFilePath)
    let observer = NotificationCenter.default.addObserver(
        forName: .projectArtifactsDidChange,
        object: nil,
        queue: nil
    ) { notification in
        let projectFilePath = notification.object as? String
        Task { @MainActor in
            recorder.record(projectFilePath: projectFilePath)
        }
    }
    defer {
        NotificationCenter.default.removeObserver(observer)
    }

    model.generateProposalFromDesignIntent()
    try await Task.sleep(for: .milliseconds(120))

    #expect(recorder.count == 1)
    #expect(model.isGeneratingProposal == false)
}

@MainActor
@Test func sequenceBlocksProposalGenerationUntilAudioAndSequenceAreSelected() async throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-sequence-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectService = LocalProjectService(projectsRootPath: root.path)
    let project = try projectService.createProject(
        draft: ProjectDraftModel(
            projectName: "Missing Prerequisites \(UUID().uuidString.prefix(6))",
            showFolder: "/tmp/show",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: ""
        )
    )
    var projectWithIntent = project
    projectWithIntent.snapshot["nativeDesignIntent"] = AnyCodable([
        "goal": "Make the chorus feel like a clean red and white canopy."
    ])
    let workspace = ProjectWorkspace(sessionStore: SequenceTestProjectSessionStore())
    workspace.setProject(projectWithIntent)
    let proposalService = StubSequenceProposalService()
    let model = SequenceScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        projectService: projectService,
        proposalService: proposalService
    )

    model.generateProposalFromDesignIntent()
    try await Task.sleep(for: .milliseconds(40))

    #expect(proposalService.callCount == 0)
    #expect(model.transientBanner?.state == .blocked)
    #expect(model.transientBanner?.text.contains("Choose or analyze audio") == true)
    #expect(model.transientBanner?.text.contains("Create or select the project sequence") == true)
}
