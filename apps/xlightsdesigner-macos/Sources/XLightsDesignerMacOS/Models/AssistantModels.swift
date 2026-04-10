import Foundation

enum AssistantMessageRole: String, Codable {
    case user
    case assistant
}

enum WorkflowPhaseID: String, Codable, Sendable, CaseIterable {
    case setup
    case projectMission = "project_mission"
    case audioAnalysis = "audio_analysis"
    case displayDiscovery = "display_discovery"
    case design
    case sequencing
    case review

    var title: String {
        switch self {
        case .setup: return "Setup"
        case .projectMission: return "Project Mission"
        case .audioAnalysis: return "Audio Analysis"
        case .displayDiscovery: return "Display Discovery"
        case .design: return "Design"
        case .sequencing: return "Sequencing"
        case .review: return "Review"
        }
    }
}

enum WorkflowPhaseStatus: String, Codable, Sendable {
    case notStarted = "not_started"
    case inProgress = "in_progress"
    case readyToClose = "ready_to_close"
    case handoffPending = "handoff_pending"
    case completed
    case blocked
}

struct WorkflowPhaseStateModel: Sendable, Equatable {
    let phaseID: WorkflowPhaseID
    let ownerRole: String
    let status: WorkflowPhaseStatus
    let entryReason: String
    let nextRecommendedPhases: [WorkflowPhaseID]
}

struct AssistantMessageModel: Identifiable, Codable, Equatable {
    let id: String
    let role: AssistantMessageRole
    let text: String
    let timestamp: String
    let handledBy: String?
    let routeDecision: String?
    let displayName: String?
    let artifactCard: AssistantArtifactCardModel?

    init(
        id: String,
        role: AssistantMessageRole,
        text: String,
        timestamp: String,
        handledBy: String?,
        routeDecision: String?,
        displayName: String?,
        artifactCard: AssistantArtifactCardModel? = nil
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.timestamp = timestamp
        self.handledBy = handledBy
        self.routeDecision = routeDecision
        self.displayName = displayName
        self.artifactCard = artifactCard
    }
}

struct AssistantArtifactCardModel: Codable, Equatable, Sendable {
    let artifactType: String
    let title: String
    let summary: String
    let chips: [String]
}

struct AssistantDisplayDiscoveryResult: Sendable {
    let status: DisplayDiscoveryStatus
    let scope: String
    let shouldCaptureTurn: Bool
    let candidateProps: [DisplayDiscoveryCandidateModel]
    let insights: [DisplayDiscoveryInsightModel]
    let unresolvedBranches: [String]
    let resolvedBranches: [String]
    let tagProposals: [DisplayDiscoveryTagProposalModel]
}

struct AssistantProjectMissionResult: Sendable {
    let document: String

    var hasContent: Bool {
        !document.isEmpty
    }
}

struct AssistantPhaseTransitionResult: Sendable {
    let phaseID: WorkflowPhaseID
    let reason: String
}

struct AssistantDiagnosticsResult: Sendable {
    let artifactType: String
    let routeDecision: String
    let addressedTo: String
    let bridgeOk: Bool
    let responseCode: String
    let sequenceOpen: Bool
    let planOnlyMode: Bool
    let generatedAt: String
}

struct AssistantActionRequestResult: Sendable {
    let actionType: String
    let payload: [String: String]
    let reason: String
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
    let interactionStyle: String
    let workflowPhaseID: String
    let workflowPhaseOwnerRole: String
    let workflowPhaseStatus: String
    let workflowPhaseEntryReason: String
    let workflowPhaseNextRecommended: [String]
    let workflowPhaseOutputSummary: String
    let focusedSummary: String
    let projectMissionDocument: String
    let rollingConversationSummary: String
    let activeSequenceLoaded: Bool
    let planOnlyMode: Bool
    let showFolder: String
    let displayTargetCount: Int
    let displayLabeledTargetCount: Int
    let displayLabelNames: [String]
    let selectedDisplaySubject: String
    let selectedDisplayLabels: [String]
    let displayDiscoveryCandidates: [[String: String]]
    let displayDiscoveryFamilies: [[String: String]]
    let displayTypeBreakdown: [[String: String]]
    let displayModelSamples: [[String: String]]
    let displayAllTargetNames: [String]
    let displayGroupMemberships: [[String: String]]
    let xlightsLayoutFamilies: [[String: String]]
    let xlightsLayoutTypeBreakdown: [[String: String]]
    let xlightsLayoutModelSamples: [[String: String]]
    let xlightsLayoutAllTargetNames: [String]
    let xlightsLayoutGroupMemberships: [[String: String]]
    let displayDiscoveryStatus: String
    let displayDiscoveryTranscriptCount: Int
    let displayDiscoveryInsights: [[String: String]]
    let displayDiscoveryUnresolvedBranches: [String]
    let displayDiscoveryResolvedBranches: [String]
    let teamChatIdentities: [String: [String: String]]
    let userPreferredName: String
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
        interactionStyle: String = "guided",
        workflowPhaseID: String = WorkflowPhaseID.setup.rawValue,
        workflowPhaseOwnerRole: String = "app_assistant",
        workflowPhaseStatus: String = WorkflowPhaseStatus.notStarted.rawValue,
        workflowPhaseEntryReason: String = "",
        workflowPhaseNextRecommended: [String] = [],
        workflowPhaseOutputSummary: String = "",
        focusedSummary: String,
        projectMissionDocument: String = "",
        rollingConversationSummary: String = "",
        activeSequenceLoaded: Bool,
        planOnlyMode: Bool,
        showFolder: String = "",
        displayTargetCount: Int = 0,
        displayLabeledTargetCount: Int = 0,
        displayLabelNames: [String] = [],
        selectedDisplaySubject: String = "",
        selectedDisplayLabels: [String] = [],
        displayDiscoveryCandidates: [[String: String]] = [],
        displayDiscoveryFamilies: [[String: String]] = [],
        displayTypeBreakdown: [[String: String]] = [],
        displayModelSamples: [[String: String]] = [],
        displayAllTargetNames: [String] = [],
        displayGroupMemberships: [[String: String]] = [],
        xlightsLayoutFamilies: [[String: String]] = [],
        xlightsLayoutTypeBreakdown: [[String: String]] = [],
        xlightsLayoutModelSamples: [[String: String]] = [],
        xlightsLayoutAllTargetNames: [String] = [],
        xlightsLayoutGroupMemberships: [[String: String]] = [],
        displayDiscoveryStatus: String = "not_started",
        displayDiscoveryTranscriptCount: Int = 0,
        displayDiscoveryInsights: [[String: String]] = [],
        displayDiscoveryUnresolvedBranches: [String] = [],
        displayDiscoveryResolvedBranches: [String] = [],
        teamChatIdentities: [String: [String: String]] = [:],
        userPreferredName: String = "",
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
        self.interactionStyle = interactionStyle
        self.workflowPhaseID = workflowPhaseID
        self.workflowPhaseOwnerRole = workflowPhaseOwnerRole
        self.workflowPhaseStatus = workflowPhaseStatus
        self.workflowPhaseEntryReason = workflowPhaseEntryReason
        self.workflowPhaseNextRecommended = workflowPhaseNextRecommended
        self.workflowPhaseOutputSummary = workflowPhaseOutputSummary
        self.focusedSummary = focusedSummary
        self.projectMissionDocument = projectMissionDocument
        self.rollingConversationSummary = rollingConversationSummary
        self.activeSequenceLoaded = activeSequenceLoaded
        self.planOnlyMode = planOnlyMode
        self.showFolder = showFolder
        self.displayTargetCount = displayTargetCount
        self.displayLabeledTargetCount = displayLabeledTargetCount
        self.displayLabelNames = displayLabelNames
        self.selectedDisplaySubject = selectedDisplaySubject
        self.selectedDisplayLabels = selectedDisplayLabels
        self.displayDiscoveryCandidates = displayDiscoveryCandidates
        self.displayDiscoveryFamilies = displayDiscoveryFamilies
        self.displayTypeBreakdown = displayTypeBreakdown
        self.displayModelSamples = displayModelSamples
        self.displayAllTargetNames = displayAllTargetNames
        self.displayGroupMemberships = displayGroupMemberships
        self.xlightsLayoutFamilies = xlightsLayoutFamilies
        self.xlightsLayoutTypeBreakdown = xlightsLayoutTypeBreakdown
        self.xlightsLayoutModelSamples = xlightsLayoutModelSamples
        self.xlightsLayoutAllTargetNames = xlightsLayoutAllTargetNames
        self.xlightsLayoutGroupMemberships = xlightsLayoutGroupMemberships
        self.displayDiscoveryStatus = displayDiscoveryStatus
        self.displayDiscoveryTranscriptCount = displayDiscoveryTranscriptCount
        self.displayDiscoveryInsights = displayDiscoveryInsights
        self.displayDiscoveryUnresolvedBranches = displayDiscoveryUnresolvedBranches
        self.displayDiscoveryResolvedBranches = displayDiscoveryResolvedBranches
        self.teamChatIdentities = teamChatIdentities
        self.userPreferredName = userPreferredName
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
            "interactionStyle": interactionStyle,
            "workflowPhase": [
                "phaseId": workflowPhaseID,
                "ownerRole": workflowPhaseOwnerRole,
                "status": workflowPhaseStatus,
                "entryReason": workflowPhaseEntryReason,
                "nextRecommendedPhases": workflowPhaseNextRecommended,
                "outputSummary": workflowPhaseOutputSummary
            ],
            "focusedSummary": focusedSummary,
            "projectMission": [
                "document": projectMissionDocument
            ],
            "rollingConversationSummary": rollingConversationSummary,
            "activeSequenceLoaded": activeSequenceLoaded,
            "planOnlyMode": planOnlyMode,
            "showFolder": showFolder,
            "display": [
                "targetCount": displayTargetCount,
                "labeledTargetCount": displayLabeledTargetCount,
                "labelNames": displayLabelNames,
                "selectedSubject": selectedDisplaySubject,
                "selectedLabels": selectedDisplayLabels,
                "displayDiscoveryCandidates": displayDiscoveryCandidates,
                "displayDiscoveryFamilies": displayDiscoveryFamilies,
                "typeBreakdown": displayTypeBreakdown,
                "modelSamples": displayModelSamples,
                "allTargetNames": displayAllTargetNames,
                "groupMemberships": displayGroupMemberships
            ],
            "xlightsLayout": [
                "families": xlightsLayoutFamilies,
                "typeBreakdown": xlightsLayoutTypeBreakdown,
                "modelSamples": xlightsLayoutModelSamples,
                "allTargetNames": xlightsLayoutAllTargetNames,
                "groupMemberships": xlightsLayoutGroupMemberships
            ],
            "displayDiscovery": [
                "status": displayDiscoveryStatus,
                "transcriptCount": displayDiscoveryTranscriptCount,
                "insights": displayDiscoveryInsights,
                "unresolvedBranches": displayDiscoveryUnresolvedBranches,
                "resolvedBranches": displayDiscoveryResolvedBranches
            ],
            "teamChat": [
                "identities": teamChatIdentities
            ],
            "userProfile": [
                "preferredName": userPreferredName,
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
