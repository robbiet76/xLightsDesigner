import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    private let displayDiscoveryStore: DisplayDiscoveryStateStore
    private let userProfileStore: AssistantUserProfileStore

    var selectedWorkflow: WorkflowID = .project
    var showSettings = false
    var showAssistantPanel = true

    let workspace: ProjectWorkspace
    let assistantModel: AssistantWindowViewModel
    let audioScreenModel: AudioScreenViewModel
    let projectScreenModel: ProjectScreenViewModel
    let displayScreenModel: DisplayScreenViewModel
    let designScreenModel: DesignScreenViewModel
    let sequenceScreenModel: SequenceScreenViewModel
    let reviewScreenModel: ReviewScreenViewModel
    let historyScreenModel: HistoryScreenViewModel
    let settingsScreenModel: SettingsScreenViewModel
    let xlightsSessionModel: XLightsSessionViewModel

    init(
        displayDiscoveryStore: DisplayDiscoveryStateStore = LocalDisplayDiscoveryStateStore(),
        userProfileStore: AssistantUserProfileStore = LocalAssistantUserProfileStore()
    ) {
        self.displayDiscoveryStore = displayDiscoveryStore
        self.userProfileStore = userProfileStore
        let workspace = ProjectWorkspace()
        self.workspace = workspace
        self.xlightsSessionModel = XLightsSessionViewModel(workspace: workspace)
        self.assistantModel = AssistantWindowViewModel()
        self.audioScreenModel = AudioScreenViewModel.sample()
        self.projectScreenModel = ProjectScreenViewModel(workspace: workspace)
        self.displayScreenModel = DisplayScreenViewModel(workspace: workspace)
        self.designScreenModel = DesignScreenViewModel(workspace: workspace)
        self.sequenceScreenModel = SequenceScreenViewModel(workspace: workspace)
        self.reviewScreenModel = ReviewScreenViewModel(workspace: workspace)
        self.historyScreenModel = HistoryScreenViewModel(workspace: workspace)
        self.settingsScreenModel = SettingsScreenViewModel()
        self.xlightsSessionModel.refresh()
    }

    func workflowRoute() -> String {
        switch selectedWorkflow {
        case .project:
            return "project"
        case .display:
            return "display"
        case .audio:
            return "audio"
        case .design:
            return "design"
        case .sequence:
            return "sequence"
        case .review:
            return "review"
        case .history:
            return "history"
        }
    }

    func focusedSummary() -> String {
        switch selectedWorkflow {
        case .project:
            return workspace.activeProject?.projectFilePath ?? "Project summary"
        case .display:
            switch displayScreenModel.screenModel.selectedMetadata {
            case let .selected(entry):
                return "\(entry.subject): \(entry.value)"
            default:
                return "No metadata entry selected"
            }
        case .audio:
            switch audioScreenModel.currentResult {
            case let .track(track):
                return track.displayName
            case let .batchComplete(batch):
                return batch.batchLabel
            case let .batchRunning(batch):
                return batch.batchLabel
            default:
                return "No track selected"
            }
        case .sequence:
            return sequenceScreenModel.selectedRow?.summary ?? "No sequencing item selected"
        case .review:
            return reviewScreenModel.screenModel.pendingSummary.pendingSummary
        case .design:
            return designScreenModel.screenModel.proposal.proposalSummary
        case .history:
            switch historyScreenModel.screenModel.selectedEvent {
            case let .selected(event):
                return event.changeSummary
            default:
                return "No history item selected"
            }
        }
    }

    func assistantContext() -> AssistantContextModel {
        let layoutRows = displayScreenModel.screenModel.rows
        let taggedTargetCount = layoutRows.filter { !$0.tagDefinitions.isEmpty }.count
        let allTagNames = Set(displayScreenModel.screenModel.tagDefinitions.map(\.name))
        let discoverySummary = displayDiscoveryStore.summary(for: workspace.activeProject)
        let discoveryCandidates = buildDisplayDiscoveryCandidates(from: layoutRows, discoverySummary: discoverySummary)
        let discoveryFamilies = buildDisplayDiscoveryFamilies(from: layoutRows)
        let displayTypeBreakdown = buildDisplayTypeBreakdown(from: layoutRows)
        let displayModelSamples = buildDisplayModelSamples(from: layoutRows)
        let userPreferenceNotes = (try? userProfileStore.load().preferenceNotes.map(\.text)) ?? []
        let selectedDisplaySubject: String
        let selectedDisplayLabels: [String]
        switch displayScreenModel.screenModel.selectedMetadata {
        case let .selected(entry):
            selectedDisplaySubject = entry.subject
            selectedDisplayLabels = entry.relatedTags.map(\.name)
        default:
            selectedDisplaySubject = ""
            selectedDisplayLabels = []
        }
        let xlights = xlightsSessionModel.snapshot
        let sequence = sequenceScreenModel.screenModel
        return AssistantContextModel(
            activeProjectName: workspace.activeProject?.projectName ?? "No Project",
            workflowName: selectedWorkflow.rawValue,
            route: workflowRoute(),
            focusedSummary: focusedSummary(),
            rollingConversationSummary: assistantModel.rollingConversationSummary,
            activeSequenceLoaded: sequenceScreenModel.screenModel.hasLiveSequence,
            planOnlyMode: sequenceScreenModel.screenModel.planOnlyMode,
            showFolder: workspace.activeProject?.showFolder ?? "",
            displayTargetCount: layoutRows.count,
            displayTaggedTargetCount: taggedTargetCount,
            displayLabelNames: allTagNames.sorted(),
            selectedDisplaySubject: selectedDisplaySubject,
            selectedDisplayLabels: selectedDisplayLabels.sorted(),
            displayDiscoveryCandidates: discoveryCandidates,
            displayDiscoveryFamilies: discoveryFamilies,
            displayTypeBreakdown: displayTypeBreakdown,
            displayModelSamples: displayModelSamples,
            displayDiscoveryStatus: discoverySummary.status.rawValue,
            displayDiscoveryTranscriptCount: discoverySummary.transcriptCount,
            userPreferenceNotes: userPreferenceNotes,
            xlightsSequenceOpen: xlights.isSequenceOpen,
            xlightsSequencePath: xlights.sequencePath,
            xlightsMediaFile: xlights.mediaFile,
            xlightsDirtyState: xlights.dirtyState,
            projectShowMatches: xlights.projectShowMatches,
            sequenceItemCount: sequence.overview.itemCount,
            sequenceWarningCount: sequence.overview.warningCount,
            sequenceValidationIssueCount: sequence.overview.validationIssueCount,
            timingReviewNeeded: sequence.timingReview.needsReview
        )
    }

    private func buildDisplayDiscoveryCandidates(
        from rows: [DisplayLayoutRowModel],
        discoverySummary: DisplayDiscoverySummaryModel
    ) -> [[String: String]] {
        if !discoverySummary.candidateProps.isEmpty {
            return discoverySummary.candidateProps.map {
                [
                    "name": $0.name,
                    "type": $0.type,
                    "reason": $0.reason
                ]
            }
        }
        let scoredRows = rows
            .map { row in
                (
                    row: row,
                    score: displayDiscoveryScore(for: row)
                )
            }
            .filter { $0.score > 0 }

        let models = scoredRows
            .filter { !$0.row.targetType.lowercased().contains("modelgroup") }
            .sorted { lhs, rhs in
                if lhs.score != rhs.score { return lhs.score > rhs.score }
                return lhs.row.targetName.localizedCaseInsensitiveCompare(rhs.row.targetName) == .orderedAscending
            }

        let groups = scoredRows
            .filter { $0.row.targetType.lowercased().contains("modelgroup") }
            .sorted { lhs, rhs in
                if lhs.score != rhs.score { return lhs.score > rhs.score }
                return lhs.row.targetName.localizedCaseInsensitiveCompare(rhs.row.targetName) == .orderedAscending
            }

        let candidates = Array((models + groups).prefix(8))

        return candidates.map { candidate in
            [
                "name": candidate.row.targetName,
                "type": candidate.row.targetType,
                "reason": displayDiscoveryReason(for: candidate.row)
            ]
        }
    }

    private func buildDisplayDiscoveryFamilies(from rows: [DisplayLayoutRowModel]) -> [[String: String]] {
        struct FamilyBucket {
            let key: String
            let baseName: String
            let type: String
            var rows: [DisplayLayoutRowModel]
        }

        let eligible = rows.filter { row in
            let type = row.targetType.lowercased()
            return !type.contains("modelgroup") && !type.contains("submodel")
        }

        var buckets: [String: FamilyBucket] = [:]
        for row in eligible {
            let baseName = normalizedFamilyBaseName(for: row.targetName)
            let key = "\(row.targetType.lowercased())|\(baseName.lowercased())"
            if var existing = buckets[key] {
                existing.rows.append(row)
                buckets[key] = existing
            } else {
                buckets[key] = FamilyBucket(key: key, baseName: baseName, type: row.targetType, rows: [row])
            }
        }

        return buckets.values
            .filter { bucket in
                guard bucket.rows.count >= 2 else { return false }
                let nodeCounts = bucket.rows.map(\.nodeCount)
                let minNodes = nodeCounts.min() ?? 0
                let maxNodes = nodeCounts.max() ?? 0
                return maxNodes - minNodes <= max(10, Int(Double(maxNodes) * 0.12))
            }
            .sorted { lhs, rhs in
                if lhs.rows.count != rhs.rows.count { return lhs.rows.count > rhs.rows.count }
                return lhs.baseName.localizedCaseInsensitiveCompare(rhs.baseName) == .orderedAscending
            }
            .prefix(6)
            .map { bucket in
                let examples = bucket.rows
                    .map(\.targetName)
                    .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
                let nodeCount = bucket.rows.first?.nodeCount ?? 0
                return [
                    "name": bucket.baseName,
                    "type": bucket.type,
                    "count": String(bucket.rows.count),
                    "examples": Array(examples.prefix(4)).joined(separator: ", "),
                    "reason": nodeCount > 0
                        ? "\(bucket.rows.count) similarly named \(bucket.type) models with comparable node counts"
                        : "\(bucket.rows.count) similarly named \(bucket.type) models"
                ]
            }
    }

    private func buildDisplayTypeBreakdown(from rows: [DisplayLayoutRowModel]) -> [[String: String]] {
        Dictionary(grouping: rows) { $0.targetType }
            .map { type, typeRows in
                [
                    "type": type,
                    "count": String(typeRows.count)
                ]
            }
            .sorted { lhs, rhs in
                let left = Int(lhs["count"] ?? "") ?? 0
                let right = Int(rhs["count"] ?? "") ?? 0
                if left != right { return left > right }
                return (lhs["type"] ?? "").localizedCaseInsensitiveCompare(rhs["type"] ?? "") == .orderedAscending
            }
            .prefix(10)
            .map { $0 }
    }

    private func buildDisplayModelSamples(from rows: [DisplayLayoutRowModel]) -> [[String: String]] {
        rows
            .filter { row in
                let type = row.targetType.lowercased()
                return !type.contains("modelgroup") && !type.contains("submodel")
            }
            .sorted { lhs, rhs in
                let leftScore = layoutSamplePriority(for: lhs)
                let rightScore = layoutSamplePriority(for: rhs)
                if leftScore != rightScore { return leftScore > rightScore }
                return lhs.targetName.localizedCaseInsensitiveCompare(rhs.targetName) == .orderedAscending
            }
            .prefix(24)
            .map { row in
                [
                    "name": row.targetName,
                    "type": row.targetType,
                    "nodeCount": String(row.nodeCount),
                    "positionX": String(format: "%.2f", row.positionX),
                    "positionY": String(format: "%.2f", row.positionY),
                    "positionZ": String(format: "%.2f", row.positionZ),
                    "width": String(format: "%.2f", row.width),
                    "height": String(format: "%.2f", row.height),
                    "depth": String(format: "%.2f", row.depth),
                    "submodelCount": String(row.submodelCount)
                ]
            }
    }

    private func layoutSamplePriority(for row: DisplayLayoutRowModel) -> Int {
        var score = displayDiscoveryScore(for: row)
        if row.nodeCount >= 300 { score += 3 }
        else if row.nodeCount >= 100 { score += 2 }
        if abs(row.positionX) < 2.5 { score += 1 }
        return score
    }

    private func normalizedFamilyBaseName(for name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let pattern = #"([_\-\s]?\d+)$"#
        let stripped = trimmed.replacingOccurrences(of: pattern, with: "", options: .regularExpression)
        return stripped.isEmpty ? trimmed : stripped
    }

    private func displayDiscoveryScore(for row: DisplayLayoutRowModel) -> Int {
        let name = row.targetName.lowercased()
        let type = row.targetType.lowercased()
        if type.contains("submodel") {
            return 0
        }
        var score = 0
        let keywords = [
            "snowman", "santa", "tree", "mega", "star", "matrix",
            "arch", "window", "roof", "house", "flake", "snow",
            "cane", "candy", "gift", "present", "spinner", "wreath"
        ]
        for keyword in keywords where name.contains(keyword) {
            score += 4
        }
        if type.contains("modelgroup") {
            score -= 2
        } else {
            score += 2
        }
        if row.nodeCount >= 500 { score += 3 }
        else if row.nodeCount >= 150 { score += 2 }
        else if row.nodeCount >= 50 { score += 1 }
        if row.positionX != 0, abs(row.positionX) < 2.0 { score += 1 }
        if row.width >= 4.0 || row.height >= 4.0 { score += 1 }
        if row.submodelCount > 0 { score += 1 }
        if row.targetName.count > 2 { score += 1 }
        return score
    }

    private func displayDiscoveryReason(for row: DisplayLayoutRowModel) -> String {
        let name = row.targetName.lowercased()
        if name.contains("snowman") || name.contains("santa") {
            return "named prop that may have character significance"
        }
        if name.contains("tree") || name.contains("mega") || name.contains("star") || name.contains("matrix") {
            return "large or likely focal display structure"
        }
        if row.nodeCount >= 500 {
            return "large visual footprint or node count suggests it may drive major scenes"
        }
        if row.positionX != 0, abs(row.positionX) < 2.0 {
            return "central position suggests it may need explicit role guidance"
        }
        if name.contains("arch") || name.contains("roof") || name.contains("window") {
            return "architectural or repeating structure that may need grouping guidance"
        }
        if name.contains("cane") || name.contains("candy") || name.contains("gift") || name.contains("present") {
            return "named themed prop that may deserve explicit role guidance"
        }
        return "name or structure suggests it may be worth clarifying early"
    }
}
