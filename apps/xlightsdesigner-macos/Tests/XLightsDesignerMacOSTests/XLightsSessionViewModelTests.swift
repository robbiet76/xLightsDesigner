import Foundation
import Testing
@testable import XLightsDesignerMacOS

private struct StubXLightsSessionProjectStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

private final class StubXLightsSessionService: XLightsSessionService, @unchecked Sendable {
    var nextLoad: (@Sendable (String) async throws -> XLightsSessionSnapshotModel)?

    func loadSession(projectShowFolder: String) async throws -> XLightsSessionSnapshotModel {
        if let nextLoad {
            return try await nextLoad(projectShowFolder)
        }
        throw XLightsSessionServiceError.invalidResponse("unconfigured session stub")
    }

    func saveCurrentSequence() async throws -> String { "saved" }
    func closeCurrentSequence() async throws -> String { "closed" }
    func renderCurrentSequence() async throws -> String { "rendered" }
    func openSequence(filePath: String, saveBeforeSwitch: Bool) async throws -> String { "opened" }
    func createSequence(filePath: String, mediaFile: String?, durationMs: Int?, frameMs: Int?, saveBeforeSwitch: Bool) async throws -> String { "created" }
}

private actor XLightsSessionLoadGate {
    private var shouldFail = true

    func markReachable() {
        shouldFail = false
    }

    func isFailing() -> Bool {
        shouldFail
    }
}

@MainActor
@Test func xlightsSessionRefreshMarksOwnedApiFailuresUnreachable() async throws {
    let workspace = ProjectWorkspace(sessionStore: StubXLightsSessionProjectStore())
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
    let service = StubXLightsSessionService()
    service.nextLoad = { _ in
        throw XLightsSessionServiceError.invalidResponse("connection refused")
    }
    let model = XLightsSessionViewModel(workspace: workspace, service: service)

    let refreshed = await model.refreshNow()

    #expect(refreshed.isReachable == false)
    #expect(refreshed.runtimeState == "unreachable")
    #expect(refreshed.isSequenceOpen == false)
    #expect(refreshed.saveSupported == false)
    #expect(refreshed.dirtyStateReason.contains("/tmp/show"))
}

@MainActor
@Test func xlightsSessionRefreshRecoversAfterUnreachableState() async throws {
    let workspace = ProjectWorkspace(sessionStore: StubXLightsSessionProjectStore())
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
    let service = StubXLightsSessionService()
    let gate = XLightsSessionLoadGate()
    service.nextLoad = { projectShowFolder in
        if await gate.isFailing() {
            throw XLightsSessionServiceError.invalidResponse("connection refused")
        }
        return XLightsSessionSnapshotModel(
            runtimeState: "ready",
            supportedCommands: ["sequence.open"],
            isReachable: true,
            isSequenceOpen: true,
            sequencePath: "/tmp/show/HolidayRoad.xsq",
            revision: "rev-1",
            mediaFile: "",
            showDirectory: projectShowFolder,
            projectShowMatches: true,
            sequenceType: "Media",
            durationMs: 0,
            frameMs: 25,
            dirtyState: "clean",
            dirtyStateReason: "Current xLights sequence is saved.",
            hasUnsavedChanges: false,
            saveSupported: true,
            renderSupported: true,
            openSupported: true,
            createSupported: true,
            closeSupported: true,
            lastSaveSummary: "",
            lastRenderSummary: ""
        )
    }
    let model = XLightsSessionViewModel(workspace: workspace, service: service)

    model.refresh()
    try await Task.sleep(for: .milliseconds(80))
    #expect(model.snapshot.isReachable == false)

    await gate.markReachable()
    model.refresh()
    try await Task.sleep(for: .milliseconds(80))

    #expect(model.snapshot.isReachable == true)
    #expect(model.snapshot.isSequenceOpen == true)
    #expect(model.snapshot.sequencePath == "/tmp/show/HolidayRoad.xsq")
}
