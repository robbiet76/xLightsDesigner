import Foundation

struct XLightsSessionSnapshotModel: Sendable {
    let runtimeState: String
    let supportedCommands: [String]
    let isReachable: Bool
    let isSequenceOpen: Bool
    let sequencePath: String
    let revision: String
    let mediaFile: String
    let showDirectory: String
    let projectShowMatches: Bool
    let layoutSignature: String
    let hasUnsavedLayoutChanges: Bool?
    let hasUnsavedRgbEffectsChanges: Bool?
    let hasUnsavedNetworkChanges: Bool?
    let rgbEffectsFile: String
    let rgbEffectsModifiedAt: String
    let networksFile: String
    let networksModifiedAt: String
    let layoutDirtyStateReason: String
    let sequenceType: String
    let durationMs: Int
    let frameMs: Int
    let dirtyState: String
    let dirtyStateReason: String
    let hasUnsavedChanges: Bool?
    let saveSupported: Bool
    let renderSupported: Bool
    let openSupported: Bool
    let createSupported: Bool
    let closeSupported: Bool
    let lastSaveSummary: String
    let lastRenderSummary: String

    init(
        runtimeState: String,
        supportedCommands: [String],
        isReachable: Bool,
        isSequenceOpen: Bool,
        sequencePath: String,
        revision: String,
        mediaFile: String,
        showDirectory: String,
        projectShowMatches: Bool,
        layoutSignature: String = "",
        hasUnsavedLayoutChanges: Bool? = nil,
        hasUnsavedRgbEffectsChanges: Bool? = nil,
        hasUnsavedNetworkChanges: Bool? = nil,
        rgbEffectsFile: String = "",
        rgbEffectsModifiedAt: String = "",
        networksFile: String = "",
        networksModifiedAt: String = "",
        layoutDirtyStateReason: String = "",
        sequenceType: String,
        durationMs: Int,
        frameMs: Int,
        dirtyState: String,
        dirtyStateReason: String,
        hasUnsavedChanges: Bool?,
        saveSupported: Bool,
        renderSupported: Bool,
        openSupported: Bool,
        createSupported: Bool,
        closeSupported: Bool,
        lastSaveSummary: String,
        lastRenderSummary: String
    ) {
        self.runtimeState = runtimeState
        self.supportedCommands = supportedCommands
        self.isReachable = isReachable
        self.isSequenceOpen = isSequenceOpen
        self.sequencePath = sequencePath
        self.revision = revision
        self.mediaFile = mediaFile
        self.showDirectory = showDirectory
        self.projectShowMatches = projectShowMatches
        self.layoutSignature = layoutSignature
        self.hasUnsavedLayoutChanges = hasUnsavedLayoutChanges
        self.hasUnsavedRgbEffectsChanges = hasUnsavedRgbEffectsChanges
        self.hasUnsavedNetworkChanges = hasUnsavedNetworkChanges
        self.rgbEffectsFile = rgbEffectsFile
        self.rgbEffectsModifiedAt = rgbEffectsModifiedAt
        self.networksFile = networksFile
        self.networksModifiedAt = networksModifiedAt
        self.layoutDirtyStateReason = layoutDirtyStateReason
        self.sequenceType = sequenceType
        self.durationMs = durationMs
        self.frameMs = frameMs
        self.dirtyState = dirtyState
        self.dirtyStateReason = dirtyStateReason
        self.hasUnsavedChanges = hasUnsavedChanges
        self.saveSupported = saveSupported
        self.renderSupported = renderSupported
        self.openSupported = openSupported
        self.createSupported = createSupported
        self.closeSupported = closeSupported
        self.lastSaveSummary = lastSaveSummary
        self.lastRenderSummary = lastRenderSummary
    }
}
