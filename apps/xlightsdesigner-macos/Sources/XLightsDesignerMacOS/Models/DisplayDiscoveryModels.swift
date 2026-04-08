import Foundation

struct DisplayDiscoveryCandidateModel: Codable, Hashable, Sendable {
    let name: String
    let type: String
    let reason: String
}

enum DisplayDiscoveryStatus: String, Codable, Sendable {
    case notStarted = "not_started"
    case inProgress = "in_progress"
    case readyForProposal = "ready_for_proposal"
}

struct DisplayDiscoveryTranscriptEntry: Codable, Hashable, Sendable {
    let id: String
    let role: AssistantMessageRole
    let text: String
    let timestamp: String
    let handledBy: String?
}

struct DisplayDiscoveryDocument: Codable, Sendable {
    var version: Int = 1
    var status: DisplayDiscoveryStatus = .notStarted
    var scope: String = "groups_models_v1"
    var startedAt: String?
    var updatedAt: String?
    var candidateProps: [DisplayDiscoveryCandidateModel] = []
    var transcript: [DisplayDiscoveryTranscriptEntry] = []
}

struct DisplayDiscoverySummaryModel: Sendable {
    let status: DisplayDiscoveryStatus
    let scope: String
    let startedAt: String
    let updatedAt: String
    let transcriptCount: Int
    let candidateProps: [DisplayDiscoveryCandidateModel]

    static let empty = DisplayDiscoverySummaryModel(
        status: .notStarted,
        scope: "groups_models_v1",
        startedAt: "",
        updatedAt: "",
        transcriptCount: 0,
        candidateProps: []
    )
}
