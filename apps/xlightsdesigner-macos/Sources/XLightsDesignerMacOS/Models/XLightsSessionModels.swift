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
}
