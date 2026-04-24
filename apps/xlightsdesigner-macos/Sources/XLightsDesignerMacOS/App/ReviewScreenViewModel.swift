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
        let pendingWork = try? pendingWorkService.loadPendingWork(for: project)
        let blockers = Self.reviewBlockers(project: project, pendingWork: pendingWork)
        guard blockers.isEmpty else {
            transientBanner = WorkflowBannerModel(
                id: "review-apply-blocked",
                text: blockers.joined(separator: " "),
                state: .blocked
            )
            refresh()
            return
        }
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
                let renderSummary = try? await xlightsSessionService.renderCurrentSequence()
                let saveSummary = try? await xlightsSessionService.saveCurrentSequence()
                isApplying = false
                let feedbackSummary: String
                if result.renderFeedbackCaptured {
                    feedbackSummary = " Render feedback artifacts captured."
                } else if result.renderFeedbackStatus == "owned_routes_unavailable" {
                    let missing = result.renderFeedbackMissingRequirements.joined(separator: ", ")
                    feedbackSummary = missing.isEmpty
                        ? " Render feedback observation skipped: owned render-feedback routes are unavailable."
                        : " Render feedback observation skipped: missing owned routes \(missing)."
                } else if !result.renderFeedbackStatus.isEmpty {
                    feedbackSummary = " Render feedback status: \(result.renderFeedbackStatus)."
                } else {
                    feedbackSummary = ""
                }
                transientBanner = WorkflowBannerModel(
                    id: "review-apply-success",
                    text: "Applied \(result.commandCount) commands via \(result.applyPath.isEmpty ? "sequence apply" : result.applyPath). Revision: \(result.nextRevision.isEmpty ? "updated" : result.nextRevision)." + feedbackSummary + (renderSummary.map { " \($0)" } ?? "") + (saveSummary.map { " \($0)" } ?? ""),
                    state: .ready
                )
                NotificationCenter.default.post(name: .projectArtifactsDidChange, object: project.projectFilePath)
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
        let blockers = reviewBlockers(project: project, pendingWork: pendingWork)
        let canApply = blockers.isEmpty
        let pendingSummary = pendingWork?.proposalSummary ?? "There is no pending implementation context yet."
        let targetSequenceSummary = hasProject ? activeSequenceName : "No target sequence."
        let readinessSummary = hasProject
            ? "Pending work is visible and can be evaluated before owned API apply execution."
            : "Project context is required before review becomes actionable."

        let nativeDesignHighlights = [
            pendingWork?.nativeDesignMood,
            pendingWork?.nativeDesignTargetScope,
            pendingWork?.nativeDesignConstraints
        ].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
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
                        ? (nativeDesignHighlights.isEmpty
                            ? [pendingWork?.moodEnergyArc ?? "Meaning-first direction", pendingWork?.narrativeCues ?? "Proposal remains reviewable", pendingWork?.visualCues ?? "Warnings stay concise"]
                            : nativeDesignHighlights)
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
                blockers: blockers,
                warnings: hasProject
                    ? {
                        var warnings = ["Apply uses the owned xLights API and should be reviewed before it changes the active sequence."]
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
                    ? "Current constraints: \(pendingWork?.constraintsSummary ?? "No sequencing constraints recorded."). Validate backup expectations before applying to user-selected sequences."
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

    private static func reviewBlockers(project: ActiveProjectModel?, pendingWork: PendingWorkReadModel?) -> [String] {
        guard project != nil else { return ["Project context missing."] }
        guard let pendingWork else { return ["Generate a sequencing proposal before apply."] }
        let activeSequenceName = pendingWork.activeSequenceName.trimmingCharacters(in: .whitespacesAndNewlines)
        if activeSequenceName.isEmpty || activeSequenceName == "No active sequence" || activeSequenceName == "No sequence selected yet" {
            return ["No active sequence loaded."]
        }
        if pendingWork.translationSource != "Canonical Plan" {
            return ["Generate a sequencing proposal before apply."]
        }
        if pendingWork.proposalCommandCount <= 0 {
            return ["Generated proposal has no sequence commands to apply."]
        }
        return []
    }
}
