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
            let preview = pendingWork.intentTargetIDs.prefix(4).joined(separator: ", ")
            targetSummary = "Targets: \(pendingWork.intentTargetIDs.count) in current intent handoff. \(preview)"
        } else {
            targetSummary = "No target scope available yet."
        }
        let timingSummary: String
        if let pendingWork, !pendingWork.musicSectionLabels.isEmpty {
            let sectionPreview = pendingWork.musicSectionLabels.prefix(4).joined(separator: ", ")
            timingSummary = "\(pendingWork.musicSectionLabels.count) music sections available from design context. \(sectionPreview)"
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
                readinessSummary: hasProject ? "Technical translation context is tied to the latest project snapshot, current intent handoff, and real design artifacts." : "Sequence workflow is blocked until a project is active.",
                blockers: hasProject
                    ? ((activeSequenceName == "No active sequence" || activeSequenceName == "No sequence selected yet") ? ["No active sequence has been selected or opened."] : [])
                    : ["Active project required."],
                warnings: hasProject
                    ? {
                        var warnings = ["Apply ownership remains in Review, not here."]
                        if let pendingWork, pendingWork.riskNotes.isEmpty == false {
                            warnings.append(contentsOf: pendingWork.riskNotes.prefix(2))
                        }
                        return warnings
                    }()
                    : ["Sequence workflow remains informational without project context."],
                handoffSummary: hasProject ? handoffSummary : "Sequence handoff is unavailable."
            ),
            detail: SequenceDetailPaneModel(
                revisionSummary: hasProject ? "Project snapshot currently anchors \(pendingWork?.artifactTimestampSummary ?? project?.updatedAt ?? "unknown revision time")." : "No revision available.",
                settingsSummary: hasProject ? "Recent sequences: \(pendingWork?.recentSequenceCount ?? 0). Audio: \(pendingWork?.audioPath ?? "No audio path selected")." : "No settings summary.",
                bindingSummary: hasProject ? "\(targetSummary)\n\nConstraints: \(pendingWork?.constraintsSummary ?? "No sequencing constraints recorded.")" : "No binding available.",
                materializationSummary: hasProject ? "\(timingSummary)\n\nExecution: \(pendingWork?.executionModeSummary ?? "No execution plan available.")" : "No materialization summary.",
                technicalWarnings: hasProject
                    ? {
                        var warnings = ["This first slice is read-oriented and intentionally stops short of apply behavior."]
                        if let pendingWork, pendingWork.musicHoldMoments.isEmpty == false {
                            warnings.append("Hold moments: \(pendingWork.musicHoldMoments.prefix(4).joined(separator: ", "))")
                        }
                        if let pendingWork, pendingWork.layoutModelCount > 0 {
                            warnings.append("Scene footprint: \(pendingWork.layoutModelCount) models, \(pendingWork.layoutGroupCount) groups.")
                        }
                        return warnings
                    }()
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
