import Foundation
import Observation

@MainActor
@Observable
final class ReviewScreenViewModel {
    private let workspace: ProjectWorkspace
    var screenModel: ReviewScreenModel

    init(workspace: ProjectWorkspace) {
        self.workspace = workspace
        self.screenModel = ReviewScreenViewModel.buildScreenModel(project: workspace.activeProject)
    }

    func refresh() {
        screenModel = Self.buildScreenModel(project: workspace.activeProject)
    }

    func applyPendingWork() {}
    func deferPendingWork() {}

    private static func buildScreenModel(project: ActiveProjectModel?) -> ReviewScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let state: PendingWorkState = hasProject ? .partial : .blocked
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
                pendingSummary: hasProject ? "Review is ready to show one pending work item with supporting summaries." : "There is no pending implementation context yet.",
                targetSequenceSummary: hasProject ? "Target sequence is not selected yet; review remains pre-apply." : "No target sequence.",
                readinessSummary: hasProject ? "Blocked by missing active sequence and apply payload." : "Blocked by missing project context."
            ),
            designSummary: ReviewSupportSummaryModel(
                title: "Design Summary",
                summary: hasProject ? "Creative direction is available as a supporting summary, not a second design workspace." : "No design summary available.",
                highlights: hasProject ? ["Meaning-first direction", "Proposal remains reviewable", "Warnings stay concise"] : ["Project required"]
            ),
            sequenceSummary: ReviewSupportSummaryModel(
                title: "Sequence Summary",
                summary: hasProject ? "Technical translation is visible as readiness and sequence context, not a live operator console." : "No sequence summary available.",
                highlights: hasProject ? ["No active sequence yet", "Binding remains pending", "Apply does not live on Sequence"] : ["Project required"]
            ),
            readiness: ReviewReadinessModel(
                state: state,
                blockers: hasProject ? ["No active sequence loaded.", "No approved apply payload available yet."] : ["Project context missing."],
                warnings: hasProject ? ["This initial slice establishes the review gate before apply execution is wired."] : ["Review cannot proceed without project context."],
                impactSummary: hasProject ? "Impact remains unquantified until sequence and apply services are connected." : "No implementation impact available.",
                backupSummary: hasProject ? "Backup and restore details will surface when apply actions become active." : "No backup context available."
            ),
            actions: ReviewActionStateModel(
                canApply: false,
                canDefer: hasProject,
                applyButtonTitle: "Apply",
                deferButtonTitle: "Defer"
            ),
            banners: [WorkflowBannerModel(id: "review-slice", text: hasProject ? "Review currently establishes the apply gate and supporting summaries before native apply execution is added." : "Review is blocked until project context is active.", state: state)]
        )
    }
}
