import Foundation
import Observation

@MainActor
@Observable
final class SequenceScreenViewModel {
    private let workspace: ProjectWorkspace
    var screenModel: SequenceScreenModel

    init(workspace: ProjectWorkspace) {
        self.workspace = workspace
        self.screenModel = SequenceScreenViewModel.buildScreenModel(project: workspace.activeProject)
    }

    func refresh() {
        screenModel = Self.buildScreenModel(project: workspace.activeProject)
    }

    private static func buildScreenModel(project: ActiveProjectModel?) -> SequenceScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let state: PendingWorkState = hasProject ? .partial : .blocked
        return SequenceScreenModel(
            title: "Sequence",
            subtitle: "Technical translation of the current creative work into sequence context.",
            activeSequence: SequenceContextBandModel(
                identity: PendingWorkIdentityModel(
                    title: hasProject ? "Current sequence context" : "No active sequence context",
                    subtitle: hasProject ? projectName : "Project context is required before sequence readiness matters.",
                    state: state,
                    updatedSummary: hasProject ? "Sequence-side translation remains pending in this native slice." : "Blocked until project context exists"
                ),
                activeSequenceName: hasProject ? "No sequence selected yet" : "No sequence",
                sequencePathSummary: hasProject ? "Sequence selection and binding come in the next native sequencing slice." : "No sequence path available.",
                boundTrackSummary: hasProject ? "Track binding will resolve from the shared track library once a sequence is active." : "No bound track available.",
                timingSummary: hasProject ? "Timing substrate will derive from bound track metadata, not ad hoc sequence state." : "No timing substrate available."
            ),
            translationSummary: SequenceTranslationSummaryModel(
                state: state,
                readinessSummary: hasProject ? "Technical translation context is visible, but no active sequence is loaded yet." : "Sequence workflow is blocked until a project is active.",
                blockers: hasProject ? ["No active sequence has been selected or opened."] : ["Active project required."],
                warnings: hasProject ? ["Apply ownership remains in Review, not here."] : ["Sequence workflow remains informational without project context."],
                handoffSummary: hasProject ? "Use this screen to understand readiness and binding before moving to Review." : "Sequence handoff is unavailable."
            ),
            detail: SequenceDetailPaneModel(
                revisionSummary: hasProject ? "Revision tracking will become active once sequence context is live." : "No revision available.",
                settingsSummary: hasProject ? "Sequence settings summary is deferred until active sequence loading is implemented." : "No settings summary.",
                bindingSummary: hasProject ? "Shared track metadata remains the future binding source of truth." : "No binding available.",
                materializationSummary: hasProject ? "Timing-track materialization remains part of downstream sequencing work." : "No materialization summary.",
                technicalWarnings: hasProject ? ["This first slice is read-oriented and intentionally stops short of apply behavior."] : ["Project context missing."]
            ),
            banners: [WorkflowBannerModel(id: "sequence-slice", text: hasProject ? "Sequence currently establishes context and readiness only." : "Sequence is blocked until project context is active.", state: state)]
        )
    }
}
