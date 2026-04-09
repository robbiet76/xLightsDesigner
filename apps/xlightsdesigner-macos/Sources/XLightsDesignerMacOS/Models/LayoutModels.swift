import Foundation

enum LayoutReadinessState: String, Sendable {
    case ready = "Ready"
    case needsReview = "Needs Review"
    case blocked = "Blocked"
}

struct LayoutHeaderModel: Sendable {
    let title: String
    let subtitle: String
    let activeProjectName: String
    let sourceSummary: String
}

struct LayoutReadinessSummaryModel: Sendable {
    let state: LayoutReadinessState
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

enum LayoutTagColor: String, CaseIterable, Codable, Sendable {
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

struct LayoutTagDefinitionModel: Identifiable, Hashable, Codable, Sendable {
    let id: String
    var name: String
    var description: String
    var usageCount: Int
    var color: LayoutTagColor
}

struct LayoutRowModel: Identifiable, Hashable, Sendable {
    let id: String
    let targetName: String
    let targetType: String
    let layoutGroup: String
    let nodeCount: Int
    let positionX: Double
    let positionY: Double
    let positionZ: Double
    let width: Double
    let height: Double
    let depth: Double
    let tagDefinitions: [LayoutTagDefinitionModel]
    let supportStateSummary: String
    let issuesSummary: String
    let submodelCount: Int

    var tagSummary: String {
        guard !tagDefinitions.isEmpty else { return "No tags" }
        return tagDefinitions
            .map(\.name)
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
            .joined(separator: ", ")
    }

    var tagFilterSummary: String {
        guard !tagDefinitions.isEmpty else { return "No tags" }
        return tagDefinitions
            .map { [$0.name, $0.description, $0.color == .none ? "" : $0.color.displayName].joined(separator: " ") }
            .joined(separator: " ")
    }
}

struct LayoutSelectedTargetModel: Sendable {
    let identity: String
    let type: String
    let layoutGroup: String
    let readinessState: LayoutReadinessState
    let reason: String
    let assignedTags: [LayoutTagDefinitionModel]
    let downstreamEffectSummary: String
}

struct LayoutMultiSelectionModel: Sendable {
    let selectionCount: Int
    let commonTags: [LayoutTagDefinitionModel]
    let mixedTagCount: Int
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
    let relatedTags: [LayoutTagDefinitionModel]
}

enum DisplayMetadataSelectedPaneModel: Sendable {
    case none(String)
    case selected(DisplayMetadataSelectionModel)
}

enum LayoutSelectedPaneModel: Sendable {
    case none(String)
    case selected(LayoutSelectedTargetModel)
    case multi(LayoutMultiSelectionModel)
    case error(String)
}

struct LayoutBannerModel: Identifiable, Sendable {
    let id: String
    let state: LayoutReadinessState
    let text: String
}

struct LayoutScreenModel: Sendable {
    let header: LayoutHeaderModel
    let readinessSummary: LayoutReadinessSummaryModel
    let rows: [LayoutRowModel]
    let metadataRows: [DisplayMetadataRowModel]
    let selectedMetadata: DisplayMetadataSelectedPaneModel
    let banners: [LayoutBannerModel]
    let tagDefinitions: [LayoutTagDefinitionModel]
    let discoveryProposals: [DisplayDiscoveryTagProposalModel]
    let openQuestions: [String]
}
