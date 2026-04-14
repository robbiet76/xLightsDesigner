import Testing
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
        pendingWorkService: LocalPendingWorkService(),
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

    model.applyPendingWork()
    try await Task.sleep(for: .milliseconds(120))

    #expect(model.isApplying == false)
    #expect(model.transientBanner?.state == .ready)
    #expect(model.transientBanner?.text.contains("Applied 12 commands") == true)
    #expect(model.transientBanner?.text.contains("Render feedback unavailable") == true)
    #expect(model.transientBanner?.text.contains("Rendered xLights sequence") == true)
    #expect(model.transientBanner?.text.contains("Saved xLights sequence") == true)
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
