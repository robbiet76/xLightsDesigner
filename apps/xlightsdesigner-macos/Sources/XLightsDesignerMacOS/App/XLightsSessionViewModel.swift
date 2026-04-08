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
        setLastSaveSummary(summary)
        refresh()
    }

    func openSequence(filePath: String, saveBeforeSwitch: Bool = true) async throws -> String {
        let summary = try await service.openSequence(filePath: filePath, saveBeforeSwitch: saveBeforeSwitch)
        setLastSaveSummary(summary)
        refresh()
        return summary
    }

    func createSequence(filePath: String, mediaFile: String?, durationMs: Int?, frameMs: Int?, saveBeforeSwitch: Bool = true) async throws -> String {
        let summary = try await service.createSequence(
            filePath: filePath,
            mediaFile: mediaFile,
            durationMs: durationMs,
            frameMs: frameMs,
            saveBeforeSwitch: saveBeforeSwitch
        )
        setLastSaveSummary(summary)
        refresh()
        return summary
    }

    private func setLastSaveSummary(_ summary: String) {
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
    }
}
