import Foundation

struct DisplayDiscoveryCandidateModel: Codable, Hashable, Sendable {
    let name: String
    let type: String
    let reason: String
}

struct DisplayDiscoveryInsightModel: Codable, Hashable, Sendable {
    let subject: String
    let subjectType: String
    let category: String
    let value: String
    let rationale: String
}

struct DisplayDiscoveryTagProposalModel: Codable, Hashable, Sendable, Identifiable {
    var id: String { "\(tagName.lowercased())::\(targetNames.sorted().joined(separator: "|"))" }
    let tagName: String
    let tagDescription: String
    let rationale: String
    let targetNames: [String]
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
    var version: Int = 4
    var status: DisplayDiscoveryStatus = .notStarted
    var scope: String = "groups_models_v1"
    var startedAt: String?
    var updatedAt: String?
    var candidateProps: [DisplayDiscoveryCandidateModel] = []
    var insights: [DisplayDiscoveryInsightModel] = []
    var unresolvedBranches: [String] = []
    var resolvedBranches: [String] = []
    var proposedTags: [DisplayDiscoveryTagProposalModel] = []
    var transcript: [DisplayDiscoveryTranscriptEntry] = []

    enum CodingKeys: String, CodingKey {
        case version
        case status
        case scope
        case startedAt
        case updatedAt
        case candidateProps
        case insights
        case unresolvedBranches
        case resolvedBranches
        case openQuestions
        case proposedTags
        case transcript
    }

    init() {}

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 4
        status = try container.decodeIfPresent(DisplayDiscoveryStatus.self, forKey: .status) ?? .notStarted
        scope = try container.decodeIfPresent(String.self, forKey: .scope) ?? "groups_models_v1"
        startedAt = try container.decodeIfPresent(String.self, forKey: .startedAt)
        updatedAt = try container.decodeIfPresent(String.self, forKey: .updatedAt)
        candidateProps = try container.decodeIfPresent([DisplayDiscoveryCandidateModel].self, forKey: .candidateProps) ?? []
        insights = try container.decodeIfPresent([DisplayDiscoveryInsightModel].self, forKey: .insights) ?? []
        let legacyOpenQuestions = try container.decodeIfPresent([String].self, forKey: .openQuestions)
        unresolvedBranches = try container.decodeIfPresent([String].self, forKey: .unresolvedBranches) ?? legacyOpenQuestions ?? []
        resolvedBranches = try container.decodeIfPresent([String].self, forKey: .resolvedBranches) ?? []
        proposedTags = try container.decodeIfPresent([DisplayDiscoveryTagProposalModel].self, forKey: .proposedTags) ?? []
        transcript = try container.decodeIfPresent([DisplayDiscoveryTranscriptEntry].self, forKey: .transcript) ?? []
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(version, forKey: .version)
        try container.encode(status, forKey: .status)
        try container.encode(scope, forKey: .scope)
        try container.encodeIfPresent(startedAt, forKey: .startedAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encode(candidateProps, forKey: .candidateProps)
        try container.encode(insights, forKey: .insights)
        try container.encode(unresolvedBranches, forKey: .unresolvedBranches)
        try container.encode(resolvedBranches, forKey: .resolvedBranches)
        try container.encode(proposedTags, forKey: .proposedTags)
        try container.encode(transcript, forKey: .transcript)
    }
}

struct DisplayDiscoverySummaryModel: Sendable {
    let status: DisplayDiscoveryStatus
    let scope: String
    let startedAt: String
    let updatedAt: String
    let transcriptCount: Int
    let candidateProps: [DisplayDiscoveryCandidateModel]
    let insights: [DisplayDiscoveryInsightModel]
    let unresolvedBranches: [String]
    let resolvedBranches: [String]
    let proposedTags: [DisplayDiscoveryTagProposalModel]

    static let empty = DisplayDiscoverySummaryModel(
        status: .notStarted,
        scope: "groups_models_v1",
        startedAt: "",
        updatedAt: "",
        transcriptCount: 0,
        candidateProps: [],
        insights: [],
        unresolvedBranches: [],
        resolvedBranches: [],
        proposedTags: []
    )
}
