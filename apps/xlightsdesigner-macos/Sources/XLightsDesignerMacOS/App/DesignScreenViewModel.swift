import Foundation
import Observation

@MainActor
@Observable
final class DesignScreenViewModel {
    private let workspace: ProjectWorkspace
    var screenModel: DesignScreenModel

    init(workspace: ProjectWorkspace) {
        self.workspace = workspace
        self.screenModel = DesignScreenViewModel.buildScreenModel(project: workspace.activeProject)
    }

    func refresh() {
        screenModel = Self.buildScreenModel(project: workspace.activeProject)
    }

    private static func buildScreenModel(project: ActiveProjectModel?) -> DesignScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let identity = PendingWorkIdentityModel(
            title: hasProject ? "Current design direction" : "No pending design context",
            subtitle: hasProject ? projectName : "Open or create a project to establish creative context.",
            state: hasProject ? .partial : .blocked,
            updatedSummary: hasProject ? "Using project context as the current pending-work anchor." : "Project context required"
        )
        let banners = hasProject ? [
            WorkflowBannerModel(id: "design-early-slice", text: "Design is on the first native slice. Summary and rationale are available before full authoring tools.", state: .partial)
        ] : [
            WorkflowBannerModel(id: "design-needs-project", text: "Project context is required before design work can become actionable.", state: .blocked)
        ]
        return DesignScreenModel(
            title: "Design",
            subtitle: "Creative direction, proposal intent, and rationale for the current work item.",
            summary: DesignSummaryBandModel(
                identity: identity,
                briefSummary: hasProject ? "Creative brief is anchored to \(projectName) and ready for refinement." : "No creative brief is active yet.",
                proposalSummary: hasProject ? "Proposal generation can build on project, layout, and audio context once sequencing work begins." : "Proposal work remains unavailable until a project is active.",
                readinessText: hasProject ? "Creative summary is available. Full native authoring remains a later slice." : "Blocked until project context exists."
            ),
            proposal: DesignProposalPaneModel(
                briefTitle: "Brief",
                briefSummary: hasProject ? "Establish the emotional arc, focal moments, and visual character before any sequence work is applied." : "No brief available.",
                proposalTitle: "Proposal",
                proposalSummary: hasProject ? "Use the assistant and downstream review flow to evolve one coherent proposal set rather than parallel drafts." : "Proposal generation is not available without project context.",
                referenceDirection: hasProject ? "Reference direction should remain readable, seasonal, and target-aware." : "No reference direction.",
                directorInfluence: hasProject ? "Director preferences will remain soft guidance, not hard design constraints." : "No director profile loaded."
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
                openQuestions: hasProject ? [
                    "Which sections should become the primary visual peaks?",
                    "Where should restraint matter more than motion or density?"
                ] : ["Which project should become the active working context?"],
                warnings: hasProject ? ["Full native design authoring and artifact editing are not part of this initial slice."] : ["No active project; downstream workflows will remain blocked."]
            ),
            banners: banners
        )
    }
}
