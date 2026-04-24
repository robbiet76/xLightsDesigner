import Foundation
import Observation

@MainActor
@Observable
final class XLightsSessionViewModel {
    private let workspace: ProjectWorkspace
    private let service: XLightsSessionService
    private var refreshTask: Task<Void, Never>?
    var onSignificantChange: ((XLightsSessionSnapshotModel, XLightsSessionSnapshotModel) -> Void)?

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
        layoutSignature: "",
        hasUnsavedLayoutChanges: nil,
        hasUnsavedRgbEffectsChanges: nil,
        hasUnsavedNetworkChanges: nil,
        rgbEffectsFile: "",
        rgbEffectsModifiedAt: "",
        networksFile: "",
        networksModifiedAt: "",
        layoutDirtyStateReason: "Owned xLights API does not currently expose layout save state.",
        sequenceType: "unknown",
        durationMs: 0,
        frameMs: 0,
        dirtyState: "unknown",
        dirtyStateReason: "Owned xLights API does not currently expose unsaved sequence state.",
        hasUnsavedChanges: nil,
        saveSupported: false,
        renderSupported: false,
        openSupported: false,
        createSupported: false,
        closeSupported: false,
        lastSaveSummary: "",
        lastRenderSummary: ""
    )

    init(workspace: ProjectWorkspace, service: XLightsSessionService = LocalXLightsSessionService()) {
        self.workspace = workspace
        self.service = service
    }

    func refresh() {
        let projectShowFolder = workspace.activeProject?.showFolder ?? ""
        Task {
            let previous = snapshot
            guard let session = try? await service.loadSession(projectShowFolder: projectShowFolder) else {
                snapshot = unreachableSnapshot(from: previous, projectShowFolder: projectShowFolder)
                if didChangeSignificantly(from: previous, to: snapshot) {
                    onSignificantChange?(previous, snapshot)
                }
                return
            }
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
                layoutSignature: session.layoutSignature,
                hasUnsavedLayoutChanges: session.hasUnsavedLayoutChanges,
                hasUnsavedRgbEffectsChanges: session.hasUnsavedRgbEffectsChanges,
                hasUnsavedNetworkChanges: session.hasUnsavedNetworkChanges,
                rgbEffectsFile: session.rgbEffectsFile,
                rgbEffectsModifiedAt: session.rgbEffectsModifiedAt,
                networksFile: session.networksFile,
                networksModifiedAt: session.networksModifiedAt,
                layoutDirtyStateReason: session.layoutDirtyStateReason,
                sequenceType: session.sequenceType,
                durationMs: session.durationMs,
                frameMs: session.frameMs,
                dirtyState: session.dirtyState,
                dirtyStateReason: session.dirtyStateReason,
                hasUnsavedChanges: session.hasUnsavedChanges,
                saveSupported: session.saveSupported,
                renderSupported: session.renderSupported,
                openSupported: session.openSupported,
                createSupported: session.createSupported,
                closeSupported: session.closeSupported,
                lastSaveSummary: snapshot.lastSaveSummary,
                lastRenderSummary: snapshot.lastRenderSummary
            )
            if didChangeSignificantly(from: previous, to: snapshot) {
                onSignificantChange?(previous, snapshot)
            }
        }
    }

    func startMonitoring(intervalSeconds: TimeInterval = 3.0) {
        guard refreshTask == nil else { return }
        refreshTask = Task { [weak self] in
            while let self, !Task.isCancelled {
                self.refresh()
                let delay = UInt64(max(intervalSeconds, 1.0) * 1_000_000_000)
                try? await Task.sleep(nanoseconds: delay)
            }
        }
    }

    func stopMonitoring() {
        refreshTask?.cancel()
        refreshTask = nil
    }

    func saveCurrentSequence() async throws {
        let summary = try await service.saveCurrentSequence()
        setLastSaveSummary(summary)
        refresh()
    }

    func renderCurrentSequence() async throws {
        let summary = try await service.renderCurrentSequence()
        setLastRenderSummary(summary)
        refresh()
    }

    func openSequence(filePath: String, saveBeforeSwitch: Bool) async throws -> String {
        let summary = try await service.openSequence(filePath: filePath, saveBeforeSwitch: saveBeforeSwitch)
        setLastSaveSummary(summary)
        refresh()
        return summary
    }

    func createSequence(filePath: String, mediaFile: String?, durationMs: Int?, frameMs: Int?, saveBeforeSwitch: Bool) async throws -> String {
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

    func shouldSaveBeforeSwitch(policy: String) -> Bool {
        guard snapshot.isSequenceOpen else { return false }
        let normalized = policy.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch normalized {
        case "discard-unsaved":
            return false
        case "save-if-needed":
            return snapshot.hasUnsavedChanges == true
        default:
            return snapshot.hasUnsavedChanges == true
        }
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
            layoutSignature: snapshot.layoutSignature,
            hasUnsavedLayoutChanges: snapshot.hasUnsavedLayoutChanges,
            hasUnsavedRgbEffectsChanges: snapshot.hasUnsavedRgbEffectsChanges,
            hasUnsavedNetworkChanges: snapshot.hasUnsavedNetworkChanges,
            rgbEffectsFile: snapshot.rgbEffectsFile,
            rgbEffectsModifiedAt: snapshot.rgbEffectsModifiedAt,
            networksFile: snapshot.networksFile,
            networksModifiedAt: snapshot.networksModifiedAt,
            layoutDirtyStateReason: snapshot.layoutDirtyStateReason,
            sequenceType: snapshot.sequenceType,
            durationMs: snapshot.durationMs,
            frameMs: snapshot.frameMs,
            dirtyState: snapshot.dirtyState,
            dirtyStateReason: snapshot.dirtyStateReason,
            hasUnsavedChanges: snapshot.hasUnsavedChanges,
            saveSupported: snapshot.saveSupported,
            renderSupported: snapshot.renderSupported,
            openSupported: snapshot.openSupported,
            createSupported: snapshot.createSupported,
            closeSupported: snapshot.closeSupported,
            lastSaveSummary: summary,
            lastRenderSummary: snapshot.lastRenderSummary
        )
    }

    private func setLastRenderSummary(_ summary: String) {
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
            layoutSignature: snapshot.layoutSignature,
            hasUnsavedLayoutChanges: snapshot.hasUnsavedLayoutChanges,
            hasUnsavedRgbEffectsChanges: snapshot.hasUnsavedRgbEffectsChanges,
            hasUnsavedNetworkChanges: snapshot.hasUnsavedNetworkChanges,
            rgbEffectsFile: snapshot.rgbEffectsFile,
            rgbEffectsModifiedAt: snapshot.rgbEffectsModifiedAt,
            networksFile: snapshot.networksFile,
            networksModifiedAt: snapshot.networksModifiedAt,
            layoutDirtyStateReason: snapshot.layoutDirtyStateReason,
            sequenceType: snapshot.sequenceType,
            durationMs: snapshot.durationMs,
            frameMs: snapshot.frameMs,
            dirtyState: snapshot.dirtyState,
            dirtyStateReason: snapshot.dirtyStateReason,
            hasUnsavedChanges: snapshot.hasUnsavedChanges,
            saveSupported: snapshot.saveSupported,
            renderSupported: snapshot.renderSupported,
            openSupported: snapshot.openSupported,
            createSupported: snapshot.createSupported,
            closeSupported: snapshot.closeSupported,
            lastSaveSummary: snapshot.lastSaveSummary,
            lastRenderSummary: summary
        )
    }

    private func didChangeSignificantly(from previous: XLightsSessionSnapshotModel, to current: XLightsSessionSnapshotModel) -> Bool {
        if previous.showDirectory != current.showDirectory ||
            previous.projectShowMatches != current.projectShowMatches ||
            previous.sequencePath != current.sequencePath ||
            previous.isReachable != current.isReachable {
            return true
        }

        let committedLayoutSaveDetected =
            (previous.hasUnsavedLayoutChanges == true && current.hasUnsavedLayoutChanges == false) ||
            (!current.rgbEffectsModifiedAt.isEmpty && previous.rgbEffectsModifiedAt != current.rgbEffectsModifiedAt) ||
            (!current.networksModifiedAt.isEmpty && previous.networksModifiedAt != current.networksModifiedAt)
        if committedLayoutSaveDetected {
            return true
        }

        let fallbackStructuralChange = previous.layoutSignature != current.layoutSignature && current.hasUnsavedLayoutChanges != true
        if fallbackStructuralChange {
            return true
        }

        return false
    }

    private func unreachableSnapshot(from previous: XLightsSessionSnapshotModel, projectShowFolder: String) -> XLightsSessionSnapshotModel {
        XLightsSessionSnapshotModel(
            runtimeState: "unreachable",
            supportedCommands: [],
            isReachable: false,
            isSequenceOpen: false,
            sequencePath: "",
            revision: "",
            mediaFile: "",
            showDirectory: previous.showDirectory,
            projectShowMatches: false,
            layoutSignature: previous.layoutSignature,
            hasUnsavedLayoutChanges: nil,
            hasUnsavedRgbEffectsChanges: nil,
            hasUnsavedNetworkChanges: nil,
            rgbEffectsFile: previous.rgbEffectsFile,
            rgbEffectsModifiedAt: previous.rgbEffectsModifiedAt,
            networksFile: previous.networksFile,
            networksModifiedAt: previous.networksModifiedAt,
            layoutDirtyStateReason: "xLights owned API is not reachable. Start the API-enabled xLights build, then refresh.",
            sequenceType: "unknown",
            durationMs: 0,
            frameMs: 0,
            dirtyState: "unreachable",
            dirtyStateReason: projectShowFolder.isEmpty
                ? "xLights owned API is not reachable."
                : "xLights owned API is not reachable for project show folder: \(projectShowFolder)",
            hasUnsavedChanges: nil,
            saveSupported: false,
            renderSupported: false,
            openSupported: false,
            createSupported: false,
            closeSupported: false,
            lastSaveSummary: previous.lastSaveSummary,
            lastRenderSummary: previous.lastRenderSummary
        )
    }
}
