import Foundation

enum AudioMode: String, CaseIterable, Identifiable {
    case singleTrack = "Single Track"
    case folderBatch = "Folder Batch"

    var id: String { rawValue }
}

enum AudioTrackStatus: String, CaseIterable {
    case complete = "Complete"
    case partial = "Partial"
    case needsReview = "Needs Review"
    case failed = "Failed"
}

enum AudioIdentityState: String {
    case verified = "Verified"
    case needsReview = "Needs Review"
}

struct AudioHeaderModel {
    let title: String
    let subtitle: String
    let totalCount: Int
    let completeCount: Int
    let partialCount: Int
    let needsReviewCount: Int
    let failedCount: Int
}

struct AudioLibraryRowModel: Identifiable, Hashable {
    let id: String
    var displayName: String
    var artist: String
    var status: AudioTrackStatus
    var availableTimingsSummary: String
    var missingIssuesSummary: String
    var identitySummary: String
    var identityState: AudioIdentityState
    var lastAnalyzedSummary: String
    var actionSummaryText: String
    var reason: String
    var canConfirmIdentity: Bool
}

struct AudioBatchProgressModel {
    let batchLabel: String
    let processedCount: Int
    let totalCount: Int
    let completeCount: Int
    let partialCount: Int
    let needsReviewCount: Int
    let failedCount: Int
    let progressNote: String
}

struct AudioBatchCompleteModel {
    let batchLabel: String
    let processedCount: Int
    let completeCount: Int
    let partialCount: Int
    let needsReviewCount: Int
    let failedCount: Int
    let topIssueCategories: String
    let followUpActionText: String
}

struct AudioErrorModel {
    let title: String
    let explanation: String
    let canRetry: Bool
}

struct AudioTrackResultModel {
    let rowID: String
    var displayName: String
    var artist: String
    var lastAnalyzedSummary: String
    var status: AudioTrackStatus
    var identityState: AudioIdentityState
    var availableTimingsSummary: String
    var missingIssuesSummary: String
    var reason: String
    var recommendedActionText: String
    var editableTitleDraft: String
    var editableArtistDraft: String
    var canConfirmIdentity: Bool
}

enum AudioCurrentResultModel {
    case empty
    case track(AudioTrackResultModel)
    case batchRunning(AudioBatchProgressModel)
    case batchComplete(AudioBatchCompleteModel)
    case error(AudioErrorModel)
}
