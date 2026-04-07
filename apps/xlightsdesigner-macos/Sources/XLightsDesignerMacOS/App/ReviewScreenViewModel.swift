import Foundation
import Observation

@MainActor
@Observable
final class ReviewScreenViewModel {
    private let workspace: ProjectWorkspace
    private let pendingWorkService: PendingWorkService
    var screenModel: ReviewScreenModel

    init(workspace: ProjectWorkspace, pendingWorkService: PendingWorkService = LocalPendingWorkService()) {
        self.workspace = workspace
        self.pendingWorkService = pendingWorkService
        self.screenModel = Self.buildScreenModel(project: workspace.activeProject, pendingWork: try? pendingWorkService.loadPendingWork(for: workspace.activeProject))
    }

    func refresh() {
        let pendingWork = try? pendingWorkService.loadPendingWork(for: workspace.activeProject)
        screenModel = Self.buildScreenModel(project: workspace.activeProject, pendingWork: pendingWork)
    }

    func applyPendingWork() {}
    func deferPendingWork() {}

    private static func buildScreenModel(project: ActiveProjectModel?, pendingWork: PendingWorkReadModel?) -> ReviewScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let state: PendingWorkState = hasProject ? .partial : .blocked
        let activeSequenceName = pendingWork?.activeSequenceName ?? "No active sequence"
        let canApply = hasProject && activeSequenceName != "No active sequence" && activeSequenceName != "No sequence selected yet"
        let pendingSummary = pendingWork?.proposalSummary ?? "There is no pending implementation context yet."
        let targetSequenceSummary = hasProject ? activeSequenceName : "No target sequence."
        let readinessSummary = hasProject
            ? "Pending work is visible and can be evaluated before native apply execution is added."
            : "Project context is required before review becomes actionable."

        let designHighlights = (pendingWork?.proposalLines.prefix(3).map { String($0) } ?? [])
        let sequenceHighlights: [String] = hasProject
            ? [
                activeSequenceName,
                "\(pendingWork?.intentTargetIDs.count ?? 0) targets in handoff",
                "\(pendingWork?.musicSectionLabels.count ?? 0) music sections available"
            ]
            : ["Project required"]

        return ReviewScreenModel(
            title: "Review",
            subtitle: "Implementation gate for pending design and sequence work.",
            pendingSummary: ReviewPendingBandModel(
                identity: PendingWorkIdentityModel(
                    title: hasProject ? "Pending implementation context" : "No pending work",
                    subtitle: hasProject ? projectName : "Project context is required before review becomes actionable.",
                    state: state,
                    updatedSummary: hasProject ? "The same pending-work identity is shared with Design and Sequence." : "Blocked until project context exists"
                ),
                pendingSummary: pendingSummary,
                targetSequenceSummary: targetSequenceSummary,
                readinessSummary: readinessSummary
            ),
            designSummary: ReviewSupportSummaryModel(
                title: "Design Summary",
                summary: hasProject ? (pendingWork?.briefSummary ?? "No design summary available.") : "No design summary available.",
                highlights: hasProject
                    ? (designHighlights.isEmpty
                        ? [pendingWork?.moodEnergyArc ?? "Meaning-first direction", pendingWork?.narrativeCues ?? "Proposal remains reviewable", pendingWork?.visualCues ?? "Warnings stay concise"]
                        : Array(designHighlights))
                    : ["Project required"]
            ),
            sequenceSummary: ReviewSupportSummaryModel(
                title: "Sequence Summary",
                summary: hasProject ? (pendingWork?.intentGoal ?? "No sequence summary available.") : "No sequence summary available.",
                highlights: sequenceHighlights
            ),
            readiness: ReviewReadinessModel(
                state: state,
                blockers: hasProject ? (canApply ? [] : ["No active sequence loaded."]) : ["Project context missing."],
                warnings: hasProject
                    ? {
                        var warnings = ["This initial slice establishes the review gate before apply execution is wired."]
                        if let pendingWork, pendingWork.riskNotes.isEmpty == false {
                            warnings.append(contentsOf: pendingWork.riskNotes.prefix(3))
                        }
                        return warnings
                    }()
                    : ["Review cannot proceed without project context."],
                impactSummary: hasProject
                    ? "Estimated proposal impact: \(pendingWork?.estimatedImpact ?? 0). Lifecycle: \(pendingWork?.proposalLifecycleStatus ?? "unknown"). Execution: \(pendingWork?.executionModeSummary ?? "No execution plan available.")."
                    : "No implementation impact available.",
                backupSummary: hasProject
                    ? "Backup and restore details will surface when native apply actions become active. Current constraints: \(pendingWork?.constraintsSummary ?? "No sequencing constraints recorded.")."
                    : "No backup context available."
            ),
            actions: ReviewActionStateModel(
                canApply: canApply,
                canDefer: hasProject,
                applyButtonTitle: "Apply",
                deferButtonTitle: "Defer"
            ),
            banners: [
                WorkflowBannerModel(
                    id: "review-slice",
                    text: hasProject ? "Review currently establishes the apply gate and supporting summaries before native apply execution is added." : "Review is blocked until project context is active.",
                    state: state
                )
            ]
        )
    }
}
