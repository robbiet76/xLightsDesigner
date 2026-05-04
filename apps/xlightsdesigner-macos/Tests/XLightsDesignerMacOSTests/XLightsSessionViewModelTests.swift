import Foundation
import Testing
@testable import XLightsDesignerMacOS

private struct StubXLightsSessionProjectStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

private final class StubXLightsSessionService: XLightsSessionService, @unchecked Sendable {
    var nextLoad: (@Sendable (String) async throws -> XLightsSessionSnapshotModel)?
    var setShowDirectoryCalls: [String] = []
    var requestShowDirectoryAccessCalls: [String] = []

    func loadSession(projectShowFolder: String) async throws -> XLightsSessionSnapshotModel {
        if let nextLoad {
            return try await nextLoad(projectShowFolder)
        }
        throw XLightsSessionServiceError.invalidResponse("unconfigured session stub")
    }

    func setShowDirectory(_ showDirectory: String, force: Bool, permanent: Bool) async throws -> String {
        setShowDirectoryCalls.append(showDirectory)
        return "set"
    }

    func requestShowDirectoryAccess(_ showDirectory: String, force: Bool, permanent: Bool) async throws -> String {
        requestShowDirectoryAccessCalls.append(showDirectory)
        return "granted"
    }

    func saveCurrentSequence() async throws -> String { "saved" }
    func closeCurrentSequence() async throws -> String { "closed" }
    func renderCurrentSequence() async throws -> String { "rendered" }
    func openSequence(filePath: String, saveBeforeSwitch: Bool) async throws -> String { "opened" }
    func createSequence(filePath: String, mediaFile: String?, durationMs: Int?, frameMs: Int?, saveBeforeSwitch: Bool) async throws -> String { "created" }
}

private func sessionSnapshot(
    projectShowFolder: String,
    showDirectory: String,
    sequenceOpen: Bool = false,
    hasUnsavedChanges: Bool? = false
) -> XLightsSessionSnapshotModel {
    XLightsSessionSnapshotModel(
        runtimeState: "ready",
        supportedCommands: ["media.setShowDirectory", "media.requestShowDirectoryAccess"],
        isReachable: true,
        isSequenceOpen: sequenceOpen,
        sequencePath: sequenceOpen ? "\(showDirectory)/Current.xsq" : "",
        revision: "rev-1",
        mediaFile: "",
        showDirectory: showDirectory,
        projectShowMatches: URL(fileURLWithPath: showDirectory).standardizedFileURL.path == URL(fileURLWithPath: projectShowFolder).standardizedFileURL.path,
        sequenceType: "Media",
        durationMs: 0,
        frameMs: 25,
        dirtyState: hasUnsavedChanges == true ? "dirty" : "clean",
        dirtyStateReason: "",
        hasUnsavedChanges: hasUnsavedChanges,
        saveSupported: true,
        renderSupported: true,
        openSupported: true,
        createSupported: true,
        closeSupported: true,
        lastSaveSummary: "",
        lastRenderSummary: ""
    )
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

@MainActor
@Test func xlightsSessionRefreshPreservesRuntimeStateReason() async throws {
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
    service.nextLoad = { projectShowFolder in
        XLightsSessionSnapshotModel(
            runtimeState: "starting",
            runtimeStateReason: "xLights is blocked by a modal dialog: Save Changes.",
            supportedCommands: ["sequence.open"],
            isReachable: true,
            isSequenceOpen: false,
            sequencePath: "",
            revision: "",
            mediaFile: "",
            showDirectory: projectShowFolder,
            projectShowMatches: true,
            sequenceType: "unknown",
            durationMs: 0,
            frameMs: 0,
            dirtyState: "unknown",
            dirtyStateReason: "",
            hasUnsavedChanges: nil,
            saveSupported: false,
            renderSupported: false,
            openSupported: false,
            createSupported: false,
            closeSupported: false,
            lastSaveSummary: "",
            lastRenderSummary: ""
        )
    }
    let model = XLightsSessionViewModel(workspace: workspace, service: service)

    let refreshed = await model.refreshNow()

    #expect(refreshed.runtimeState == "starting")
    #expect(refreshed.runtimeStateReason.contains("modal dialog"))
    #expect(model.snapshot.runtimeStateReason.contains("Save Changes"))
}

@MainActor
@Test func xlightsSessionReconcileSwitchesToProjectShowFolderWhenMismatchIsClean() async throws {
    let workspace = ProjectWorkspace(sessionStore: StubXLightsSessionProjectStore())
    workspace.setProject(
        ActiveProjectModel(
            id: "project-1",
            projectName: "Christmas 2026",
            projectFilePath: "/tmp/Christmas 2026.xdproj",
            showFolder: "/tmp/show-b",
            mediaPath: "",
            appRootPath: AppEnvironment.canonicalAppRoot,
            createdAt: "2026-04-07T00:00:00Z",
            updatedAt: "2026-04-07T00:00:00Z",
            snapshot: [:]
        )
    )
    let service = StubXLightsSessionService()
    service.nextLoad = { projectShowFolder in
        let current = service.setShowDirectoryCalls.isEmpty ? "/tmp/show-a" : projectShowFolder
        return sessionSnapshot(projectShowFolder: projectShowFolder, showDirectory: current)
    }
    let model = XLightsSessionViewModel(workspace: workspace, service: service)

    let refreshed = await model.reconcileProjectShowFolder()

    #expect(service.setShowDirectoryCalls == ["/tmp/show-b"])
    #expect(refreshed.projectShowMatches == true)
    #expect(refreshed.showDirectory == "/tmp/show-b")
}

@MainActor
@Test func xlightsSessionReconcileDoesNotSwitchWhenOpenSequenceIsDirty() async throws {
    let workspace = ProjectWorkspace(sessionStore: StubXLightsSessionProjectStore())
    workspace.setProject(
        ActiveProjectModel(
            id: "project-1",
            projectName: "Christmas 2026",
            projectFilePath: "/tmp/Christmas 2026.xdproj",
            showFolder: "/tmp/show-b",
            mediaPath: "",
            appRootPath: AppEnvironment.canonicalAppRoot,
            createdAt: "2026-04-07T00:00:00Z",
            updatedAt: "2026-04-07T00:00:00Z",
            snapshot: [:]
        )
    )
    let service = StubXLightsSessionService()
    service.nextLoad = { projectShowFolder in
        sessionSnapshot(projectShowFolder: projectShowFolder, showDirectory: "/tmp/show-a", sequenceOpen: true, hasUnsavedChanges: true)
    }
    let model = XLightsSessionViewModel(workspace: workspace, service: service)

    let refreshed = await model.reconcileProjectShowFolder()

    #expect(service.setShowDirectoryCalls.isEmpty)
    #expect(refreshed.projectShowMatches == false)
    #expect(refreshed.showDirectory == "/tmp/show-a")
}

@MainActor
@Test func xlightsSessionAccessRequestSwitchesToProjectShowFolderWhenMismatchIsClean() async throws {
    let workspace = ProjectWorkspace(sessionStore: StubXLightsSessionProjectStore())
    workspace.setProject(
        ActiveProjectModel(
            id: "project-1",
            projectName: "Christmas 2026",
            projectFilePath: "/tmp/Christmas 2026.xdproj",
            showFolder: "/tmp/show-b",
            mediaPath: "",
            appRootPath: AppEnvironment.canonicalAppRoot,
            createdAt: "2026-04-07T00:00:00Z",
            updatedAt: "2026-04-07T00:00:00Z",
            snapshot: [:]
        )
    )
    let service = StubXLightsSessionService()
    service.nextLoad = { projectShowFolder in
        let current = service.requestShowDirectoryAccessCalls.isEmpty ? "/tmp/show-a" : projectShowFolder
        return sessionSnapshot(projectShowFolder: projectShowFolder, showDirectory: current)
    }
    let model = XLightsSessionViewModel(workspace: workspace, service: service)

    let refreshed = await model.requestProjectShowFolderAccess()

    #expect(service.requestShowDirectoryAccessCalls == ["/tmp/show-b"])
    #expect(service.setShowDirectoryCalls.isEmpty)
    #expect(refreshed.projectShowMatches == true)
    #expect(refreshed.showDirectory == "/tmp/show-b")
}

@MainActor
@Test func xlightsSessionAccessRequestDoesNotSwitchWhenOpenSequenceIsDirty() async throws {
    let workspace = ProjectWorkspace(sessionStore: StubXLightsSessionProjectStore())
    workspace.setProject(
        ActiveProjectModel(
            id: "project-1",
            projectName: "Christmas 2026",
            projectFilePath: "/tmp/Christmas 2026.xdproj",
            showFolder: "/tmp/show-b",
            mediaPath: "",
            appRootPath: AppEnvironment.canonicalAppRoot,
            createdAt: "2026-04-07T00:00:00Z",
            updatedAt: "2026-04-07T00:00:00Z",
            snapshot: [:]
        )
    )
    let service = StubXLightsSessionService()
    service.nextLoad = { projectShowFolder in
        sessionSnapshot(projectShowFolder: projectShowFolder, showDirectory: "/tmp/show-a", sequenceOpen: true, hasUnsavedChanges: true)
    }
    let model = XLightsSessionViewModel(workspace: workspace, service: service)

    let refreshed = await model.requestProjectShowFolderAccess()

    #expect(service.requestShowDirectoryAccessCalls.isEmpty)
    #expect(service.setShowDirectoryCalls.isEmpty)
    #expect(refreshed.projectShowMatches == false)
    #expect(model.lastShowFolderReconcileError.contains("unsaved changes"))
}
