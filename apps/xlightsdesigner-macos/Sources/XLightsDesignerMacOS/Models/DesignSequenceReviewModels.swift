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

struct DesignPaletteColorModel: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let hex: String
    let role: String
}

struct DesignVisualRevisionModel: Identifiable, Hashable, Sendable {
    let id: String
    let mode: String
    let relativePath: String
    let summary: String
    let isCurrent: Bool
    let isSelected: Bool
}

struct DesignVisualInspirationModel: Sendable {
    let available: Bool
    let sequenceId: String
    let title: String
    let summary: String
    let imagePath: String
    let currentRevisionId: String
    let displayedRevisionId: String
    let revisionSummary: String
    let revisionHistory: [DesignVisualRevisionModel]
    let paletteSummary: String
    let paletteDisplayMode: String
    let paletteCoordinationRule: String
    let paletteValidationSummary: String
    let paletteValidationNeedsRevision: Bool
    let paletteRevisionRequest: String
    let palette: [DesignPaletteColorModel]
}

struct DesignIntentDraftModel: Equatable, Sendable {
    var goal: String
    var mood: String
    var constraints: String
    var targetScope: String
    var references: String
    var approvalNotes: String
    var updatedAt: String

    var isEmpty: Bool {
        [goal, mood, constraints, targetScope, references, approvalNotes]
            .allSatisfy { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
}

struct DesignAuthoringPaneModel: Sendable {
    let title: String
    let summary: String
    let canSave: Bool
    let lastSavedSummary: String
}

struct DesignScreenModel: Sendable {
    let title: String
    let subtitle: String
    let summary: DesignSummaryBandModel
    let proposal: DesignProposalPaneModel
    let authoring: DesignAuthoringPaneModel
    let visualInspiration: DesignVisualInspirationModel
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

struct SequenceOverviewModel: Sendable {
    let state: PendingWorkState
    let activeSequenceSummary: String
    let translationSource: String
    let itemCount: Int
    let commandCount: Int
    let targetCount: Int
    let sectionCount: Int
    let warningCount: Int
    let validationIssueCount: Int
    let explanationText: String
}

struct SequenceInventoryRowModel: Identifiable, Hashable, Sendable {
    let id: String
    let designLabel: String
    let kind: String
    let timing: String
    let section: String
    let target: String
    let level: String
    let summary: String
    let effects: Int
}

struct SequenceValidationIssueModel: Identifiable, Hashable, Sendable {
    let id: String
    let severity: PendingWorkState
    let code: String
    let message: String
}

struct SequenceTimingReviewRowModel: Identifiable, Hashable, Sendable {
    let id: String
    let trackName: String
    let status: String
    let coverage: String
    let capturedAt: String
    let diffSummary: String
    let canAcceptReview: Bool
}

struct SequenceTimingReviewSummaryModel: Sendable {
    let status: String
    let summaryText: String
    let trackCount: Int
    let needsReview: Bool
    let rows: [SequenceTimingReviewRowModel]
}

struct SequenceScreenModel: Sendable {
    let title: String
    let subtitle: String
    let hasLiveSequence: Bool
    let planOnlyMode: Bool
    let overview: SequenceOverviewModel
    let activeSequence: SequenceContextBandModel
    let translationSummary: SequenceTranslationSummaryModel
    let detail: SequenceDetailPaneModel
    let validationIssues: [SequenceValidationIssueModel]
    let timingReview: SequenceTimingReviewSummaryModel
    let inventoryRows: [SequenceInventoryRowModel]
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
    let applyPreviewLines: [String]
    let impactSummary: String
    let backupSummary: String
}

struct ReviewActionStateModel: Sendable {
    let canApply: Bool
    let canDefer: Bool
    let canRestoreBackup: Bool
    let applyButtonTitle: String
    let deferButtonTitle: String
    let restoreBackupButtonTitle: String
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
