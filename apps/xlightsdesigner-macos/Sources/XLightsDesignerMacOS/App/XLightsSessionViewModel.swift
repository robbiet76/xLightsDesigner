import Foundation
import Observation

@MainActor
@Observable
final class XLightsSessionViewModel {
    private let workspace: ProjectWorkspace
    private let service: XLightsSessionService

    var snapshot = XLightsSessionSnapshotModel(
        runtimeState: "unknown",
        supportedCommands: [],
        isReachable: false,
        isSequenceOpen: false,
        sequencePath: "",
        revision: "",
        mediaFile: "",
        showDirectory: "",
        projectShowMatches: false,
        saveSupported: false,
        openSupported: false,
        createSupported: false,
        closeSupported: false,
        lastSaveSummary: ""
    )

    init(workspace: ProjectWorkspace, service: XLightsSessionService = LocalXLightsSessionService()) {
        self.workspace = workspace
        self.service = service
    }

    func refresh() {
        let projectShowFolder = workspace.activeProject?.showFolder ?? ""
        Task {
            guard let session = try? await service.loadSession(projectShowFolder: projectShowFolder) else { return }
            snapshot = XLightsSessionSnapshotModel(
                runtimeState: session.runtimeState,
                supportedCommands: session.supportedCommands,
                isReachable: session.isReachable,
                isSequenceOpen: session.isSequenceOpen,
                sequencePath: session.sequencePath,
                revision: session.revision,
                mediaFile: session.mediaFile,
                showDirectory: session.showDirectory,
                projectShowMatches: session.projectShowMatches,
                saveSupported: session.saveSupported,
                openSupported: session.openSupported,
                createSupported: session.createSupported,
                closeSupported: session.closeSupported,
                lastSaveSummary: snapshot.lastSaveSummary
            )
        }
    }

    func saveCurrentSequence() async throws {
        let summary = try await service.saveCurrentSequence()
        snapshot = XLightsSessionSnapshotModel(
            runtimeState: snapshot.runtimeState,
            supportedCommands: snapshot.supportedCommands,
            isReachable: snapshot.isReachable,
            isSequenceOpen: snapshot.isSequenceOpen,
            sequencePath: snapshot.sequencePath,
            revision: snapshot.revision,
            mediaFile: snapshot.mediaFile,
            showDirectory: snapshot.showDirectory,
            projectShowMatches: snapshot.projectShowMatches,
            saveSupported: snapshot.saveSupported,
            openSupported: snapshot.openSupported,
            createSupported: snapshot.createSupported,
            closeSupported: snapshot.closeSupported,
            lastSaveSummary: summary
        )
        refresh()
    }
}
