import Foundation

enum AssistantMessageRole: String, Codable {
    case user
    case assistant
}

struct AssistantMessageModel: Identifiable, Codable, Equatable {
    let id: String
    let role: AssistantMessageRole
    let text: String
    let timestamp: String
    let handledBy: String?
    let routeDecision: String?
    let displayName: String?
}

struct AssistantDisplayDiscoveryResult: Sendable {
    let status: DisplayDiscoveryStatus
    let scope: String
    let shouldCaptureTurn: Bool
    let candidateProps: [DisplayDiscoveryCandidateModel]
    let insights: [DisplayDiscoveryInsightModel]
    let openQuestions: [String]
}

struct AssistantConversationState: Codable, Sendable {
    var version: Int = 1
    var rollingSummary: String
    var messages: [AssistantMessageModel]

    init(rollingSummary: String = "", messages: [AssistantMessageModel] = []) {
        self.rollingSummary = rollingSummary
        self.messages = messages
    }
}

struct AssistantContextModel {
    let activeProjectName: String
    let workflowName: String
    let route: String
    let focusedSummary: String
    let rollingConversationSummary: String
    let activeSequenceLoaded: Bool
    let planOnlyMode: Bool
    let showFolder: String
    let layoutTargetCount: Int
    let layoutTaggedTargetCount: Int
    let layoutTagNames: [String]
    let selectedLayoutTarget: String
    let selectedLayoutTags: [String]
    let displayDiscoveryCandidates: [[String: String]]
    let displayDiscoveryFamilies: [[String: String]]
    let layoutTypeBreakdown: [[String: String]]
    let layoutModelSamples: [[String: String]]
    let displayDiscoveryStatus: String
    let displayDiscoveryTranscriptCount: Int
    let userPreferenceNotes: [String]
    let xlightsSequenceOpen: Bool
    let xlightsSequencePath: String
    let xlightsMediaFile: String
    let xlightsDirtyState: String
    let projectShowMatches: Bool
    let sequenceItemCount: Int
    let sequenceWarningCount: Int
    let sequenceValidationIssueCount: Int
    let timingReviewNeeded: Bool

    init(
        activeProjectName: String,
        workflowName: String,
        route: String,
        focusedSummary: String,
        rollingConversationSummary: String = "",
        activeSequenceLoaded: Bool,
        planOnlyMode: Bool,
        showFolder: String = "",
        layoutTargetCount: Int = 0,
        layoutTaggedTargetCount: Int = 0,
        layoutTagNames: [String] = [],
        selectedLayoutTarget: String = "",
        selectedLayoutTags: [String] = [],
        displayDiscoveryCandidates: [[String: String]] = [],
        displayDiscoveryFamilies: [[String: String]] = [],
        layoutTypeBreakdown: [[String: String]] = [],
        layoutModelSamples: [[String: String]] = [],
        displayDiscoveryStatus: String = "not_started",
        displayDiscoveryTranscriptCount: Int = 0,
        userPreferenceNotes: [String] = [],
        xlightsSequenceOpen: Bool = false,
        xlightsSequencePath: String = "",
        xlightsMediaFile: String = "",
        xlightsDirtyState: String = "unknown",
        projectShowMatches: Bool = false,
        sequenceItemCount: Int = 0,
        sequenceWarningCount: Int = 0,
        sequenceValidationIssueCount: Int = 0,
        timingReviewNeeded: Bool = false
    ) {
        self.activeProjectName = activeProjectName
        self.workflowName = workflowName
        self.route = route
        self.focusedSummary = focusedSummary
        self.rollingConversationSummary = rollingConversationSummary
        self.activeSequenceLoaded = activeSequenceLoaded
        self.planOnlyMode = planOnlyMode
        self.showFolder = showFolder
        self.layoutTargetCount = layoutTargetCount
        self.layoutTaggedTargetCount = layoutTaggedTargetCount
        self.layoutTagNames = layoutTagNames
        self.selectedLayoutTarget = selectedLayoutTarget
        self.selectedLayoutTags = selectedLayoutTags
        self.displayDiscoveryCandidates = displayDiscoveryCandidates
        self.displayDiscoveryFamilies = displayDiscoveryFamilies
        self.layoutTypeBreakdown = layoutTypeBreakdown
        self.layoutModelSamples = layoutModelSamples
        self.displayDiscoveryStatus = displayDiscoveryStatus
        self.displayDiscoveryTranscriptCount = displayDiscoveryTranscriptCount
        self.userPreferenceNotes = userPreferenceNotes
        self.xlightsSequenceOpen = xlightsSequenceOpen
        self.xlightsSequencePath = xlightsSequencePath
        self.xlightsMediaFile = xlightsMediaFile
        self.xlightsDirtyState = xlightsDirtyState
        self.projectShowMatches = projectShowMatches
        self.sequenceItemCount = sequenceItemCount
        self.sequenceWarningCount = sequenceWarningCount
        self.sequenceValidationIssueCount = sequenceValidationIssueCount
        self.timingReviewNeeded = timingReviewNeeded
    }

    func asPayload() -> [String: Any] {
        [
            "activeProjectName": activeProjectName,
            "workflowName": workflowName,
            "route": route,
            "focusedSummary": focusedSummary,
            "rollingConversationSummary": rollingConversationSummary,
            "activeSequenceLoaded": activeSequenceLoaded,
            "planOnlyMode": planOnlyMode,
            "showFolder": showFolder,
            "layout": [
                "targetCount": layoutTargetCount,
                "taggedTargetCount": layoutTaggedTargetCount,
                "tagNames": layoutTagNames,
                "selectedTarget": selectedLayoutTarget,
                "selectedTargetTags": selectedLayoutTags,
                "displayDiscoveryCandidates": displayDiscoveryCandidates,
                "displayDiscoveryFamilies": displayDiscoveryFamilies,
                "typeBreakdown": layoutTypeBreakdown,
                "modelSamples": layoutModelSamples
            ],
            "displayDiscovery": [
                "status": displayDiscoveryStatus,
                "transcriptCount": displayDiscoveryTranscriptCount
            ],
            "userProfile": [
                "preferenceNotes": userPreferenceNotes
            ],
            "xlights": [
                "sequenceOpen": xlightsSequenceOpen,
                "sequencePath": xlightsSequencePath,
                "mediaFile": xlightsMediaFile,
                "dirtyState": xlightsDirtyState,
                "projectShowMatches": projectShowMatches
            ],
            "sequence": [
                "itemCount": sequenceItemCount,
                "warningCount": sequenceWarningCount,
                "validationIssueCount": sequenceValidationIssueCount,
                "timingReviewNeeded": timingReviewNeeded
            ]
        ]
    }
}
