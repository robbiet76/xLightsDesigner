import Foundation
import Observation

@MainActor
@Observable
final class ReviewScreenViewModel {
    private let workspace: ProjectWorkspace
    private let pendingWorkService: PendingWorkService
    private let reviewExecutionService: ReviewExecutionService
    private let xlightsSessionService: XLightsSessionService
    var screenModel: ReviewScreenModel
    var transientBanner: WorkflowBannerModel?
    var isApplying = false

    init(
        workspace: ProjectWorkspace,
        pendingWorkService: PendingWorkService = LocalPendingWorkService(),
        reviewExecutionService: ReviewExecutionService = LocalReviewExecutionService(),
        xlightsSessionService: XLightsSessionService = LocalXLightsSessionService()
    ) {
        self.workspace = workspace
        self.pendingWorkService = pendingWorkService
        self.reviewExecutionService = reviewExecutionService
        self.xlightsSessionService = xlightsSessionService
        self.screenModel = Self.buildScreenModel(
            project: workspace.activeProject,
            pendingWork: try? pendingWorkService.loadPendingWork(for: workspace.activeProject),
            transientBanner: nil,
            isApplying: false
        )
    }

    func refresh() {
        let pendingWork = try? pendingWorkService.loadPendingWork(for: workspace.activeProject)
        screenModel = Self.buildScreenModel(
            project: workspace.activeProject,
            pendingWork: pendingWork,
            transientBanner: transientBanner,
            isApplying: isApplying
        )
    }

    func applyPendingWork() {
        guard !isApplying, let project = workspace.activeProject else { return }
        isApplying = true
        transientBanner = WorkflowBannerModel(
            id: "review-apply-running",
            text: "Applying pending work to xLights...",
            state: .partial
        )
        refresh()
        Task {
            do {
                let result = try await reviewExecutionService.applyPendingWork(
                    projectFilePath: project.projectFilePath,
                    appRootPath: AppEnvironment.canonicalAppRoot,
                    endpoint: AppEnvironment.xlightsOwnedAPIBaseURL
                )
                let saveSummary = try? await xlightsSessionService.saveCurrentSequence()
                isApplying = false
                transientBanner = WorkflowBannerModel(
                    id: "review-apply-success",
                    text: "Applied \(result.commandCount) commands via \(result.applyPath.isEmpty ? "sequence apply" : result.applyPath). Revision: \(result.nextRevision.isEmpty ? "updated" : result.nextRevision)." + (saveSummary.map { " \($0)" } ?? ""),
                    state: .ready
                )
                refresh()
            } catch {
                isApplying = false
                transientBanner = WorkflowBannerModel(
                    id: "review-apply-failed",
                    text: friendlyFailureText(error),
                    state: .blocked
                )
                refresh()
            }
        }
    }

    func deferPendingWork() {
        transientBanner = WorkflowBannerModel(
            id: "review-deferred",
            text: "Pending work deferred. No sequence changes were applied.",
            state: .partial
        )
        refresh()
    }

    private func friendlyFailureText(_ error: Error) -> String {
        let message = String(error.localizedDescription)
        if message.localizedCaseInsensitiveContains("Requested element was not found in the current sequence") {
            return "Pending review artifacts no longer match the active sequence/layout. Rebuild the proposal before apply."
        }
        return message
    }

    private static func buildScreenModel(
        project: ActiveProjectModel?,
        pendingWork: PendingWorkReadModel?,
        transientBanner: WorkflowBannerModel?,
        isApplying: Bool
    ) -> ReviewScreenModel {
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
                canApply: canApply && !isApplying,
                canDefer: hasProject && !isApplying,
                applyButtonTitle: isApplying ? "Applying..." : "Apply",
                deferButtonTitle: "Defer"
            ),
            banners: {
                var banners: [WorkflowBannerModel] = [
                    WorkflowBannerModel(
                    id: "review-slice",
                    text: hasProject ? "Review applies pending work through the shared sequencing backend while keeping approval local to this screen." : "Review is blocked until project context is active.",
                    state: state
                    )
                ]
                if let transientBanner { banners.append(transientBanner) }
                return banners
            }()
        )
    }
}
