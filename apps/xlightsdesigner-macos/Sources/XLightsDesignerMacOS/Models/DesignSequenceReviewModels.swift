import Foundation

enum PendingWorkState: String, Sendable {
    case ready = "Ready"
    case partial = "Partial"
    case blocked = "Blocked"
    case none = "None"
}

struct PendingWorkIdentityModel: Sendable {
    let title: String
    let subtitle: String
    let state: PendingWorkState
    let updatedSummary: String
}

struct WorkflowBannerModel: Identifiable, Sendable {
    let id: String
    let text: String
    let state: PendingWorkState
}

struct DesignSummaryBandModel: Sendable {
    let identity: PendingWorkIdentityModel
    let briefSummary: String
    let proposalSummary: String
    let readinessText: String
}

struct DesignProposalPaneModel: Sendable {
    let briefTitle: String
    let briefSummary: String
    let proposalTitle: String
    let proposalSummary: String
    let referenceDirection: String
    let directorInfluence: String
}

struct DesignRationalePaneModel: Sendable {
    let rationaleNotes: [String]
    let assumptions: [String]
    let openQuestions: [String]
    let warnings: [String]
}

struct DesignScreenModel: Sendable {
    let title: String
    let subtitle: String
    let summary: DesignSummaryBandModel
    let proposal: DesignProposalPaneModel
    let rationale: DesignRationalePaneModel
    let banners: [WorkflowBannerModel]
}

struct SequenceContextBandModel: Sendable {
    let identity: PendingWorkIdentityModel
    let activeSequenceName: String
    let sequencePathSummary: String
    let boundTrackSummary: String
    let timingSummary: String
}

struct SequenceTranslationSummaryModel: Sendable {
    let state: PendingWorkState
    let readinessSummary: String
    let blockers: [String]
    let warnings: [String]
    let handoffSummary: String
}

struct SequenceDetailPaneModel: Sendable {
    let revisionSummary: String
    let settingsSummary: String
    let bindingSummary: String
    let materializationSummary: String
    let technicalWarnings: [String]
}

struct SequenceScreenModel: Sendable {
    let title: String
    let subtitle: String
    let activeSequence: SequenceContextBandModel
    let translationSummary: SequenceTranslationSummaryModel
    let detail: SequenceDetailPaneModel
    let banners: [WorkflowBannerModel]
}

struct ReviewPendingBandModel: Sendable {
    let identity: PendingWorkIdentityModel
    let pendingSummary: String
    let targetSequenceSummary: String
    let readinessSummary: String
}

struct ReviewSupportSummaryModel: Sendable {
    let title: String
    let summary: String
    let highlights: [String]
}

struct ReviewReadinessModel: Sendable {
    let state: PendingWorkState
    let blockers: [String]
    let warnings: [String]
    let impactSummary: String
    let backupSummary: String
}

struct ReviewActionStateModel: Sendable {
    let canApply: Bool
    let canDefer: Bool
    let applyButtonTitle: String
    let deferButtonTitle: String
}

struct ReviewScreenModel: Sendable {
    let title: String
    let subtitle: String
    let pendingSummary: ReviewPendingBandModel
    let designSummary: ReviewSupportSummaryModel
    let sequenceSummary: ReviewSupportSummaryModel
    let readiness: ReviewReadinessModel
    let actions: ReviewActionStateModel
    let banners: [WorkflowBannerModel]
}
