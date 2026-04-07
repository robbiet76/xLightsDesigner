import Foundation
import Observation

@MainActor
@Observable
final class DesignScreenViewModel {
    private let workspace: ProjectWorkspace
    private let pendingWorkService: PendingWorkService
    var screenModel: DesignScreenModel

    init(workspace: ProjectWorkspace, pendingWorkService: PendingWorkService = LocalPendingWorkService()) {
        self.workspace = workspace
        self.pendingWorkService = pendingWorkService
        self.screenModel = Self.buildScreenModel(project: workspace.activeProject, pendingWork: try? pendingWorkService.loadPendingWork(for: workspace.activeProject))
    }

    func refresh() {
        let pendingWork = try? pendingWorkService.loadPendingWork(for: workspace.activeProject)
        screenModel = Self.buildScreenModel(project: workspace.activeProject, pendingWork: pendingWork)
    }

    private static func buildScreenModel(project: ActiveProjectModel?, pendingWork: PendingWorkReadModel?) -> DesignScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let briefSummary = pendingWork?.briefSummary ?? "No creative brief is active yet."
        let proposalSummary = pendingWork?.proposalSummary ?? "Proposal work remains unavailable until a project is active."
        let directorSummary = pendingWork?.directorSummary ?? "No director profile loaded."
        let sceneSummary = pendingWork?.designSceneSummary ?? "No design-scene context available."
        let openQuestions = pendingWork?.briefSections.prefix(3).map { "How should \($0) evolve visually?" } ?? []

        let identity = PendingWorkIdentityModel(
            title: hasProject ? "Current design direction" : "No pending design context",
            subtitle: hasProject ? projectName : "Open or create a project to establish creative context.",
            state: hasProject ? .partial : .blocked,
            updatedSummary: hasProject ? "Using project context as the current pending-work anchor." : "Project context required"
        )

        let banners = hasProject ? [
            WorkflowBannerModel(
                id: "design-early-slice",
                text: "Design is on the first native slice. Summary and rationale are available before full authoring tools.",
                state: .partial
            )
        ] : [
            WorkflowBannerModel(
                id: "design-needs-project",
                text: "Project context is required before design work can become actionable.",
                state: .blocked
            )
        ]

        return DesignScreenModel(
            title: "Design",
            subtitle: "Creative direction, proposal intent, and rationale for the current work item.",
            summary: DesignSummaryBandModel(
                identity: identity,
                briefSummary: hasProject ? briefSummary : "No creative brief is active yet.",
                proposalSummary: hasProject ? proposalSummary : "Proposal work remains unavailable until a project is active.",
                readinessText: hasProject ? "Creative summary is available. Full native authoring remains a later slice." : "Blocked until project context exists."
            ),
            proposal: DesignProposalPaneModel(
                briefTitle: "Brief",
                briefSummary: hasProject ? briefSummary : "No brief available.",
                proposalTitle: "Proposal",
                proposalSummary: hasProject ? proposalSummary : "Proposal generation is not available without project context.",
                referenceDirection: hasProject ? sceneSummary : "No reference direction.",
                directorInfluence: hasProject ? directorSummary : "No director profile loaded."
            ),
            rationale: DesignRationalePaneModel(
                rationaleNotes: hasProject ? [
                    "Design remains meaning-first and does not duplicate sequence mechanics.",
                    "Pending work identity stays shared across Design, Sequence, and Review."
                ] : ["Design cannot proceed until the app has an active project context."],
                assumptions: hasProject ? [
                    "Audio analysis and layout readiness inform design quality but do not own the creative direction.",
                    "One primary proposal remains easier to review than fragmented alternatives."
                ] : ["The user still needs to select an active project."],
                openQuestions: hasProject
                    ? (openQuestions.isEmpty
                        ? [
                            "Which sections should become the primary visual peaks?",
                            "Where should restraint matter more than motion or density?"
                        ]
                        : openQuestions)
                    : ["Which project should become the active working context?"],
                warnings: hasProject
                    ? ["Full native design authoring and artifact editing are not part of this initial slice."]
                    : ["No active project; downstream workflows will remain blocked."]
            ),
            banners: banners
        )
    }
}
