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

struct LayoutRowModel: Identifiable, Hashable, Sendable {
    let id: String
    let targetName: String
    let targetType: String
    let tagSummary: String
    let assignmentSummary: String
    let supportStateSummary: String
    let issuesSummary: String
    let actionSummaryText: String
    let submodelCount: Int
}

struct LayoutSelectedTargetModel: Sendable {
    let identity: String
    let type: String
    let sourcePathSummary: String
    let readinessState: LayoutReadinessState
    let reason: String
    let recommendedAction: String
    let currentTags: String
    let assignmentSummary: String
    let downstreamEffectSummary: String
}

enum LayoutSelectedPaneModel: Sendable {
    case none(String)
    case selected(LayoutSelectedTargetModel)
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
    let selectedTarget: LayoutSelectedPaneModel
    let banners: [LayoutBannerModel]
}
