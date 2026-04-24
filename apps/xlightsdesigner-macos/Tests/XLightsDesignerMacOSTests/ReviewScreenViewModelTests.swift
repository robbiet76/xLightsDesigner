import Testing
import Foundation
@testable import XLightsDesignerMacOS

private struct StubReviewExecutionService: ReviewExecutionService, Sendable {
    let onApply: @Sendable (String, String, String) async throws -> ReviewApplyExecutionResult

    func applyPendingWork(projectFilePath: String, appRootPath: String, endpoint: String) async throws -> ReviewApplyExecutionResult {
        try await onApply(projectFilePath, appRootPath, endpoint)
    }
}

private struct StubXLightsSessionService: XLightsSessionService, Sendable {
    func loadSession(projectShowFolder: String) async throws -> XLightsSessionSnapshotModel {
        XLightsSessionSnapshotModel(
            runtimeState: "ready",
            supportedCommands: [],
            isReachable: true,
            isSequenceOpen: true,
            sequencePath: "/tmp/HolidayRoad.xsq",
            revision: "rev-1",
            mediaFile: "",
            showDirectory: projectShowFolder,
            projectShowMatches: true,
            sequenceType: "Media",
            durationMs: 0,
            frameMs: 25,
            dirtyState: "clean",
            dirtyStateReason: "",
            hasUnsavedChanges: false,
            saveSupported: true,
            renderSupported: true,
            openSupported: true,
            createSupported: true,
            closeSupported: false,
            lastSaveSummary: "",
            lastRenderSummary: ""
        )
    }

    func saveCurrentSequence() async throws -> String {
        "Saved xLights sequence: /tmp/HolidayRoad.xsq"
    }

    func closeCurrentSequence() async throws -> String {
        "Closed xLights sequence: /tmp/HolidayRoad.xsq"
    }

    func renderCurrentSequence() async throws -> String {
        "Rendered xLights sequence: /tmp/HolidayRoad.xsq"
    }

    func openSequence(filePath: String, saveBeforeSwitch: Bool) async throws -> String {
        "Opened xLights sequence: \(filePath)"
    }

    func createSequence(filePath: String, mediaFile: String?, durationMs: Int?, frameMs: Int?, saveBeforeSwitch: Bool) async throws -> String {
        "Created xLights sequence: \(filePath)"
    }
}

private struct StubReviewPendingWorkService: PendingWorkService, Sendable {
    let pendingWork: PendingWorkReadModel?

    func loadPendingWork(for project: ActiveProjectModel?) throws -> PendingWorkReadModel? {
        pendingWork
    }
}

@MainActor
private final class ReviewArtifactNotificationRecorder {
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

private func reviewPendingWork(
    translationSource: String = "Canonical Plan",
    proposalCommandCount: Int = 3,
    activeSequenceName: String = "HolidayRoad.xsq"
) -> PendingWorkReadModel {
    PendingWorkReadModel(
        projectName: "Christmas 2026",
        activeSequenceName: activeSequenceName,
        activeSequencePath: "/tmp/HolidayRoad.xsq",
        recentSequenceCount: 1,
        audioPath: "/tmp/song.mp3",
        briefSummary: "Bright clean canopy.",
        briefGoalsSummary: "Make the chorus lift.",
        briefInspirationSummary: "Warm neighborhood mission.",
        briefSections: ["Chorus 1"],
        moodEnergyArc: "Warm, crisp, elegant.",
        narrativeCues: "Lift on chorus.",
        visualCues: "Red and white canopy.",
        proposalSummary: "Apply canopy effects to selected targets.",
        proposalLines: ["Chorus 1 / Mega Tree / apply Color Wash."],
        guidedQuestions: [],
        riskNotes: [],
        proposalLifecycleStatus: "ready",
        estimatedImpact: 3,
        executionModeSummary: "owned batch plan, selected scope, 2 targets, 1 sections",
        constraintsSummary: "Preserve singing faces.",
        intentGoal: "Make the chorus lift.",
        intentTargetIDs: ["Mega Tree", "Roofline"],
        intentSectionCount: 1,
        nativeDesignGoal: "Make the chorus lift.",
        nativeDesignMood: "Warm, crisp, elegant.",
        nativeDesignConstraints: "Preserve singing faces.",
        nativeDesignTargetScope: "Mega tree and roofline.",
        nativeDesignReferences: "Neighborhood mission.",
        nativeDesignApprovalNotes: "Ready to apply.",
        nativeDesignUpdatedAt: "2026-04-23T00:00:00Z",
        directorPreferenceSummary: "Focus bias toward Mega Tree, Roofline",
        directorSummary: "No director profile available.",
        designSceneSummary: "2 models, 0 groups, 0 submodels, 2D scene",
        layoutModelCount: 2,
        layoutGroupCount: 0,
        musicSectionLabels: ["Chorus 1"],
        musicHoldMoments: [],
        artifactTimestampSummary: "2026-04-23T00:00:00Z",
        translationSource: translationSource,
        proposalSectionCount: 1,
        proposalTargetCount: 2,
        proposalCommandCount: proposalCommandCount,
        proposalShouldUseFullSongStructureTrack: true,
        proposalEffectPlacements: []
    )
}

@MainActor
@Test func reviewApplyPublishesSuccessBanner() async throws {
    let workspace = ProjectWorkspace()
    workspace.setProject(
        ActiveProjectModel(
            id: "project-1",
            projectName: "Christmas 2026",
            projectFilePath: "/tmp/Christmas 2026.xdproj",
            showFolder: "/tmp/show",
            mediaPath: "",
            appRootPath: AppEnvironment.canonicalAppRoot,
            createdAt: "2026-04-07T00:00:00Z",
            updatedAt: "2026-04-07T00:00:00Z",
            snapshot: [:]
        )
    )
    let model = ReviewScreenViewModel(
        workspace: workspace,
        pendingWorkService: StubReviewPendingWorkService(pendingWork: reviewPendingWork()),
        reviewExecutionService: StubReviewExecutionService { projectFilePath, appRootPath, endpoint in
            #expect(projectFilePath == "/tmp/Christmas 2026.xdproj")
            #expect(appRootPath == AppEnvironment.canonicalAppRoot)
            #expect(endpoint == AppEnvironment.xlightsOwnedAPIBaseURL)
            return ReviewApplyExecutionResult(
                summary: "Applied pending work.",
                commandCount: 12,
                nextRevision: "rev-2",
                applyPath: "owned_batch_plan",
                sequencePath: "/tmp/HolidayRoad.xsq",
                renderFeedbackCaptured: false,
                renderFeedbackStatus: "owned_routes_unavailable",
                renderFeedbackMissingRequirements: ["layout.scene", "sequence.render-samples"]
            )
        },
        xlightsSessionService: StubXLightsSessionService()
    )
    let recorder = ReviewArtifactNotificationRecorder(projectFilePath: "/tmp/Christmas 2026.xdproj")
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

    model.applyPendingWork()
    try await Task.sleep(for: .milliseconds(120))

    #expect(model.isApplying == false)
    #expect(model.transientBanner?.state == .ready)
    #expect(model.transientBanner?.text.contains("Applied 12 commands") == true)
    #expect(model.transientBanner?.text.contains("Render feedback observation skipped") == true)
    #expect(model.transientBanner?.text.contains("Rendered xLights sequence") == true)
    #expect(model.transientBanner?.text.contains("Saved xLights sequence") == true)
    #expect(recorder.count == 1)
}

@MainActor
@Test func reviewApplyBlocksUntilCanonicalProposalExists() {
    let workspace = ProjectWorkspace()
    workspace.setProject(
        ActiveProjectModel(
            id: "project-1",
            projectName: "Christmas 2026",
            projectFilePath: "/tmp/Christmas 2026.xdproj",
            showFolder: "/tmp/show",
            mediaPath: "",
            appRootPath: AppEnvironment.canonicalAppRoot,
            createdAt: "2026-04-07T00:00:00Z",
            updatedAt: "2026-04-07T00:00:00Z",
            snapshot: [:]
        )
    )
    let model = ReviewScreenViewModel(
        workspace: workspace,
        pendingWorkService: StubReviewPendingWorkService(
            pendingWork: reviewPendingWork(translationSource: "Native Design Intent", proposalCommandCount: 0)
        ),
        reviewExecutionService: StubReviewExecutionService { _, _, _ in
            Issue.record("applyPendingWork should not be called without a canonical proposal")
            return ReviewApplyExecutionResult(
                summary: "",
                commandCount: 0,
                nextRevision: "",
                applyPath: "",
                sequencePath: "",
                renderFeedbackCaptured: false,
                renderFeedbackStatus: "",
                renderFeedbackMissingRequirements: []
            )
        }
    )

    model.refresh()
    #expect(model.screenModel.actions.canApply == false)
    #expect(model.screenModel.readiness.blockers.contains("Generate a sequencing proposal before apply."))

    model.applyPendingWork()

    #expect(model.transientBanner?.state == .blocked)
    #expect(model.transientBanner?.text.contains("Generate a sequencing proposal before apply.") == true)
}

@MainActor
@Test func reviewEnablesApplyForSectionPlanProposalArtifacts() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-review-tests-\(UUID().uuidString)", isDirectory: true)
    let projectDir = root.appendingPathComponent("Project", isDirectory: true)
    let proposalDir = projectDir.appendingPathComponent("artifacts/proposals", isDirectory: true)
    let intentDir = projectDir.appendingPathComponent("artifacts/intent-handoffs", isDirectory: true)
    try FileManager.default.createDirectory(at: proposalDir, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: intentDir, withIntermediateDirectories: true)
    try writeReviewJSON([
        "artifactType": "proposal_bundle_v1",
        "artifactId": "proposal_bundle_v1-test",
        "createdAt": "2026-04-23T13:00:00Z",
        "summary": "Apply On effect to MegaTree during Chorus 1.",
        "proposalLines": ["Chorus 1 / MegaTree / apply On effect"],
        "impact": [
            "estimatedImpact": 1
        ],
        "scope": [
            "sections": ["Chorus 1"],
            "targetIds": ["MegaTree"]
        ],
        "executionPlan": [
            "sectionCount": 1,
            "targetCount": 1,
            "shouldUseFullSongStructureTrack": true,
            "sectionPlans": [
                [
                    "section": "Chorus 1",
                    "targetIds": ["MegaTree"],
                    "effectHints": ["On"]
                ]
            ],
            "effectPlacements": []
        ]
    ] as [String: Any], to: proposalDir.appendingPathComponent("proposal_bundle_v1-test.json"))
    try writeReviewJSON([
        "artifactType": "intent_handoff_v1",
        "artifactId": "intent_handoff_v1-test",
        "createdAt": "2026-04-23T13:00:00Z",
        "goal": "Apply On effect to MegaTree during Chorus 1.",
        "scope": [
            "sections": ["Chorus 1"],
            "targetIds": ["MegaTree"]
        ]
    ] as [String: Any], to: intentDir.appendingPathComponent("intent_handoff_v1-test.json"))
    let workspace = ProjectWorkspace()
    workspace.setProject(
        ActiveProjectModel(
            id: "project-1",
            projectName: "Christmas 2026",
            projectFilePath: projectDir.appendingPathComponent("Christmas 2026.xdproj").path,
            showFolder: "/tmp/show",
            mediaPath: "",
            appRootPath: AppEnvironment.canonicalAppRoot,
            createdAt: "2026-04-07T00:00:00Z",
            updatedAt: "2026-04-07T00:00:00Z",
            snapshot: [
                "activeSequence": AnyCodable("HolidayRoad"),
                "sequencePathInput": AnyCodable("/tmp/show/HolidayRoad.xsq")
            ]
        )
    )
    let model = ReviewScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        reviewExecutionService: StubReviewExecutionService { _, _, _ in
            Issue.record("This test only verifies Review readiness.")
            return ReviewApplyExecutionResult(
                summary: "",
                commandCount: 0,
                nextRevision: "",
                applyPath: "",
                sequencePath: "",
                renderFeedbackCaptured: false,
                renderFeedbackStatus: "",
                renderFeedbackMissingRequirements: []
            )
        }
    )

    model.refresh()

    #expect(model.screenModel.actions.canApply == true)
    #expect(model.screenModel.readiness.blockers.isEmpty)
    #expect(model.screenModel.readiness.impactSummary.contains("Estimated proposal impact: 1"))
}

@MainActor
@Test func reviewDeferPublishesNonDestructiveBanner() {
    let workspace = ProjectWorkspace()
    let model = ReviewScreenViewModel(
        workspace: workspace,
        pendingWorkService: LocalPendingWorkService(),
        reviewExecutionService: StubReviewExecutionService { _, _, _ in
            Issue.record("applyPendingWork should not be called")
            return ReviewApplyExecutionResult(
                summary: "",
                commandCount: 0,
                nextRevision: "",
                applyPath: "",
                sequencePath: "",
                renderFeedbackCaptured: false,
                renderFeedbackStatus: "",
                renderFeedbackMissingRequirements: []
            )
        }
    )

    model.deferPendingWork()

    #expect(model.transientBanner?.state == .partial)
    #expect(model.transientBanner?.text == "Pending work deferred. No sequence changes were applied.")
}

private func writeReviewJSON(_ object: [String: Any], to url: URL) throws {
    let data = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
    try data.write(to: url)
}
