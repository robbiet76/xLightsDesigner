import Foundation

enum DisplayReadinessState: String, Sendable {
    case ready = "Ready"
    case needsReview = "Needs Review"
    case blocked = "Blocked"
}

struct DisplayHeaderModel: Sendable {
    let title: String
    let subtitle: String
    let activeProjectName: String
    let sourceSummary: String
}

struct DisplayReadinessSummaryModel: Sendable {
    let state: DisplayReadinessState
    let totalTargets: Int
    let readyCount: Int
    let unresolvedCount: Int
    let orphanCount: Int
    let explanationText: String
    let nextStepText: String
}

enum DisplayMetadataStatus: String, Sendable {
    case confirmed = "Confirmed"
    case proposed = "Proposed"
}

enum DisplayMetadataSource: String, Sendable {
    case userAndAgent = "User + Agent"
    case agent = "Agent"
}

enum DisplayLabelColor: String, CaseIterable, Codable, Sendable {
    case none
    case red
    case orange
    case yellow
    case green
    case teal
    case blue
    case purple
    case pink
    case gray

    var displayName: String {
        rawValue.capitalized
    }
}

struct DisplayLabelDefinitionModel: Identifiable, Hashable, Codable, Sendable {
    let id: String
    var name: String
    var description: String
    var usageCount: Int
    var color: DisplayLabelColor
}

struct DisplayLayoutRowModel: Identifiable, Hashable, Sendable {
    let id: String
    let targetName: String
    let targetType: String
    let nodeCount: Int
    let positionX: Double
    let positionY: Double
    let positionZ: Double
    let width: Double
    let height: Double
    let depth: Double
    let labelDefinitions: [DisplayLabelDefinitionModel]
    let submodelCount: Int
}

struct DisplayMetadataRowModel: Identifiable, Hashable, Sendable {
    let id: String
    let subject: String
    let subjectType: String
    let category: String
    let value: String
    let status: DisplayMetadataStatus
    let source: DisplayMetadataSource
    let rationale: String
    let linkedTargets: [String]

    var linkedTargetCount: Int { linkedTargets.count }
    var statusSummary: String { status.rawValue }
    var sourceSummary: String { source.rawValue }
    var linkedTargetSummary: String {
        guard !linkedTargets.isEmpty else { return "Needs mapping review" }
        return "\(linkedTargets.count)"
    }
}

struct DisplayMetadataSelectionModel: Sendable {
    let subject: String
    let subjectType: String
    let category: String
    let value: String
    let status: DisplayMetadataStatus
    let source: DisplayMetadataSource
    let rationale: String
    let linkedTargets: [String]
    let relatedLabels: [DisplayLabelDefinitionModel]
}

enum DisplayMetadataSelectedPaneModel: Sendable {
    case none(String)
    case selected(DisplayMetadataSelectionModel)
}

struct DisplayBannerModel: Identifiable, Sendable {
    let id: String
    let state: DisplayReadinessState
    let text: String
}

struct DisplayScreenModel: Sendable {
    let header: DisplayHeaderModel
    let readinessSummary: DisplayReadinessSummaryModel
    let rows: [DisplayLayoutRowModel]
    let metadataRows: [DisplayMetadataRowModel]
    let selectedMetadata: DisplayMetadataSelectedPaneModel
    let banners: [DisplayBannerModel]
    let labelDefinitions: [DisplayLabelDefinitionModel]
    let discoveryProposals: [DisplayDiscoveryTagProposalModel]
    let openQuestions: [String]
}
