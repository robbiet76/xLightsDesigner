import Foundation

enum HistoryEventResultState: String, Sendable {
    case recorded = "Recorded"
    case ready = "Ready"
    case warning = "Warning"
}

struct HistoryHeaderModel: Sendable {
    let title: String
    let subtitle: String
    let activeProjectName: String
}

struct HistorySummaryModel: Sendable {
    let totalEventCount: Int
    let latestEventSummary: String
    let latestEventTimestamp: String
    let groupedTypeSummaries: [String]
}

struct HistoryRowModel: Identifiable, Sendable, Hashable {
    let id: String
    let timestampSummary: String
    let eventType: String
    let summary: String
    let sequenceSummary: String
    let resultSummary: String
    let artifactAvailabilitySummary: String
}

struct HistorySelectedEventModel: Sendable {
    let identity: String
    let timestamp: String
    let eventType: String
    let relatedProjectSummary: String
    let relatedSequenceSummary: String
    let changeSummary: String
    let resultSummary: String
    let proofChain: [String]
    let artifactPath: String?
    let artifactReferences: [String]
    let warnings: [String]
    let followUpSummary: String
}

enum HistorySelectedEventState: Sendable {
    case none(String)
    case selected(HistorySelectedEventModel)
    case error(String)
}

struct HistoryScreenModel: Sendable {
    let header: HistoryHeaderModel
    let summary: HistorySummaryModel
    let rows: [HistoryRowModel]
    let selectedEvent: HistorySelectedEventState
    let banners: [WorkflowBannerModel]
}
