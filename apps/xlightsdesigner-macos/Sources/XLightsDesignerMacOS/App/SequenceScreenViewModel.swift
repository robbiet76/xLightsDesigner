import Foundation
import Observation

@MainActor
@Observable
final class SequenceScreenViewModel {
    private let workspace: ProjectWorkspace
    private let pendingWorkService: PendingWorkService
    var screenModel: SequenceScreenModel

    init(workspace: ProjectWorkspace, pendingWorkService: PendingWorkService = LocalPendingWorkService()) {
        self.workspace = workspace
        self.pendingWorkService = pendingWorkService
        self.screenModel = Self.buildScreenModel(project: workspace.activeProject, pendingWork: try? pendingWorkService.loadPendingWork(for: workspace.activeProject))
    }

    func refresh() {
        let pendingWork = try? pendingWorkService.loadPendingWork(for: workspace.activeProject)
        screenModel = Self.buildScreenModel(project: workspace.activeProject, pendingWork: pendingWork)
    }

    private static func buildScreenModel(project: ActiveProjectModel?, pendingWork: PendingWorkReadModel?) -> SequenceScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let state: PendingWorkState = hasProject ? .partial : .blocked
        let activeSequenceName = pendingWork?.activeSequenceName ?? "No sequence selected yet"
        let activeSequencePath = pendingWork?.activeSequencePath ?? "No sequence path available."
        let targetSummary: String
        if let pendingWork, !pendingWork.intentTargetIDs.isEmpty {
            targetSummary = "Targets: \(pendingWork.intentTargetIDs.count) in current intent handoff."
        } else {
            targetSummary = "No target scope available yet."
        }
        let timingSummary: String
        if let pendingWork, !pendingWork.musicSectionLabels.isEmpty {
            timingSummary = "\(pendingWork.musicSectionLabels.count) music sections available from design context."
        } else {
            timingSummary = "No timing substrate available."
        }
        let handoffSummary = pendingWork?.intentGoal ?? "Sequence handoff is unavailable."

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
                activeSequenceName: hasProject ? activeSequenceName : "No sequence",
                sequencePathSummary: hasProject ? activeSequencePath : "No sequence path available.",
                boundTrackSummary: hasProject ? targetSummary : "No bound track available.",
                timingSummary: hasProject ? timingSummary : "No timing substrate available."
            ),
            translationSummary: SequenceTranslationSummaryModel(
                state: state,
                readinessSummary: hasProject ? "Technical translation context is visible and tied to the latest project snapshot and pending-work artifacts." : "Sequence workflow is blocked until a project is active.",
                blockers: hasProject
                    ? ((activeSequenceName == "No active sequence" || activeSequenceName == "No sequence selected yet") ? ["No active sequence has been selected or opened."] : [])
                    : ["Active project required."],
                warnings: hasProject
                    ? ["Apply ownership remains in Review, not here."]
                    : ["Sequence workflow remains informational without project context."],
                handoffSummary: hasProject ? handoffSummary : "Sequence handoff is unavailable."
            ),
            detail: SequenceDetailPaneModel(
                revisionSummary: hasProject ? "Project snapshot currently anchors \(pendingWork?.artifactTimestampSummary ?? project?.updatedAt ?? "unknown revision time")." : "No revision available.",
                settingsSummary: hasProject ? "Recent sequences recorded: \(pendingWork?.recentSequenceCount ?? 0)." : "No settings summary.",
                bindingSummary: hasProject ? targetSummary : "No binding available.",
                materializationSummary: hasProject ? timingSummary : "No materialization summary.",
                technicalWarnings: hasProject
                    ? ["This first slice is read-oriented and intentionally stops short of apply behavior."]
                    : ["Project context missing."]
            ),
            banners: [
                WorkflowBannerModel(
                    id: "sequence-slice",
                    text: hasProject ? "Sequence currently establishes context and readiness only." : "Sequence is blocked until project context is active.",
                    state: state
                )
            ]
        )
    }
}
