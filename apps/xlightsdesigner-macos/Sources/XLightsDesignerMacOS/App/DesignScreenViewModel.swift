import Foundation
import Observation

@MainActor
@Observable
final class DesignScreenViewModel {
    private let workspace: ProjectWorkspace
    private let pendingWorkService: PendingWorkService
    private let projectService: ProjectService
    var screenModel: DesignScreenModel
    var intentDraft: DesignIntentDraftModel
    var savedIntentDraft: DesignIntentDraftModel
    var transientBanner: WorkflowBannerModel?

    init(
        workspace: ProjectWorkspace,
        pendingWorkService: PendingWorkService = LocalPendingWorkService(),
        projectService: ProjectService = LocalProjectService()
    ) {
        self.workspace = workspace
        self.pendingWorkService = pendingWorkService
        self.projectService = projectService
        let loadedDraft = Self.intentDraft(from: workspace.activeProject)
        self.intentDraft = loadedDraft
        self.savedIntentDraft = loadedDraft
        self.screenModel = Self.buildScreenModel(
            project: workspace.activeProject,
            pendingWork: try? pendingWorkService.loadPendingWork(for: workspace.activeProject),
            intentDraft: loadedDraft,
            isDirty: false
        )
    }

    func refresh() {
        let pendingWork = try? pendingWorkService.loadPendingWork(for: workspace.activeProject)
        let loadedDraft = Self.intentDraft(from: workspace.activeProject)
        intentDraft = loadedDraft
        savedIntentDraft = loadedDraft
        screenModel = Self.buildScreenModel(
            project: workspace.activeProject,
            pendingWork: pendingWork,
            intentDraft: loadedDraft,
            isDirty: false
        )
    }

    func updateAuthoringState() {
        screenModel = Self.buildScreenModel(
            project: workspace.activeProject,
            pendingWork: try? pendingWorkService.loadPendingWork(for: workspace.activeProject),
            intentDraft: intentDraft,
            isDirty: intentDraft != savedIntentDraft
        )
    }

    func saveDesignIntent() {
        guard var activeProject = workspace.activeProject else { return }
        var draft = intentDraft
        draft.updatedAt = Self.isoNow()
        activeProject.snapshot["nativeDesignIntent"] = AnyCodable(Self.snapshotPayload(from: draft))
        do {
            let saved = try projectService.saveProject(activeProject)
            workspace.setProject(saved)
            intentDraft = draft
            savedIntentDraft = draft
            transientBanner = WorkflowBannerModel(
                id: "design-intent-saved",
                text: "Design intent saved.",
                state: .ready
            )
            screenModel = Self.buildScreenModel(
                project: saved,
                pendingWork: try? pendingWorkService.loadPendingWork(for: saved),
                intentDraft: draft,
                isDirty: false
            )
        } catch {
            transientBanner = WorkflowBannerModel(
                id: "design-intent-save-failed",
                text: error.localizedDescription,
                state: .blocked
            )
            updateAuthoringState()
        }
    }

    func applyDesignIntentPayload(_ payload: [String: String]) {
        let fields: [(String, WritableKeyPath<DesignIntentDraftModel, String>)] = [
            ("goal", \.goal),
            ("mood", \.mood),
            ("constraints", \.constraints),
            ("targetScope", \.targetScope),
            ("references", \.references),
            ("approvalNotes", \.approvalNotes)
        ]
        for (key, path) in fields {
            if let value = payload[key]?.trimmingCharacters(in: .whitespacesAndNewlines) {
                intentDraft[keyPath: path] = value
            }
        }
        saveDesignIntent()
    }

    func resetDesignIntentEdits() {
        intentDraft = savedIntentDraft
        transientBanner = WorkflowBannerModel(
            id: "design-intent-reset",
            text: "Design intent edits reverted.",
            state: .partial
        )
        updateAuthoringState()
    }

    private static func buildScreenModel(
        project: ActiveProjectModel?,
        pendingWork: PendingWorkReadModel?,
        intentDraft: DesignIntentDraftModel,
        isDirty: Bool
    ) -> DesignScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let briefSummary = pendingWork?.briefSummary ?? "No creative brief is active yet."
        let proposalSummary = pendingWork?.proposalSummary ?? "Proposal work remains unavailable until a project is active."
        let directorSummary = pendingWork?.directorSummary ?? "No director profile loaded."
        let sceneSummary = pendingWork?.designSceneSummary ?? "No design-scene context available."
        let openQuestions = pendingWork?.guidedQuestions ?? []

        let identity = PendingWorkIdentityModel(
            title: hasProject ? "Current design direction" : "No pending design context",
            subtitle: hasProject ? projectName : "Open or create a project to establish creative context.",
            state: hasProject ? .partial : .blocked,
            updatedSummary: hasProject ? "Using project context as the current pending-work anchor." : "Project context required"
        )

        let banners = hasProject ? [
            WorkflowBannerModel(
                id: "design-authoring-active",
                text: isDirty ? "Design intent has unsaved edits." : "Design intent is editable and stored with the active project.",
                state: isDirty ? .partial : .ready
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
                briefSummary: hasProject ? "\(briefSummary)\n\nGoals: \(pendingWork?.briefGoalsSummary ?? "No explicit goals captured.")" : "No brief available.",
                proposalTitle: "Proposal",
                proposalSummary: hasProject ? proposalSummary : "Proposal generation is not available without project context.",
                referenceDirection: hasProject ? "\(pendingWork?.visualCues ?? "No visual cues available.")\n\nScene: \(sceneSummary)" : "No reference direction.",
                directorInfluence: hasProject ? "\(directorSummary)\n\n\(pendingWork?.directorPreferenceSummary ?? "No director preference summary available.")" : "No director profile loaded."
            ),
            authoring: DesignAuthoringPaneModel(
                title: "Design Intent",
                summary: hasProject
                    ? (intentDraft.isEmpty
                        ? "Capture native design direction before sequencing."
                        : "Native design direction is stored with this project and can feed sequencing handoff.")
                    : "Open or create a project before authoring design intent.",
                canSave: hasProject && isDirty,
                lastSavedSummary: intentDraft.updatedAt.isEmpty ? "Not saved yet." : "Last saved \(intentDraft.updatedAt)."
            ),
            rationale: DesignRationalePaneModel(
                rationaleNotes: hasProject ? [
                    pendingWork?.moodEnergyArc ?? "No mood/energy arc available.",
                    pendingWork?.narrativeCues ?? "No narrative cues available.",
                    "Design remains meaning-first and does not duplicate sequence mechanics."
                ] : ["Design cannot proceed until the app has an active project context."],
                assumptions: hasProject ? [
                    pendingWork?.briefInspirationSummary ?? "No explicit inspiration captured.",
                    pendingWork?.constraintsSummary ?? "No sequencing constraints recorded.",
                    pendingWork?.executionModeSummary ?? "No execution plan available."
                ] : ["The user still needs to select an active project."],
                openQuestions: hasProject
                    ? (openQuestions.isEmpty
                        ? Array((pendingWork?.briefSections.prefix(3) ?? []).map { "How should \($0) evolve visually?" })
                        : Array(openQuestions.prefix(4)))
                    : ["Which project should become the active working context?"],
                warnings: hasProject
                    ? (pendingWork?.riskNotes.isEmpty == false
                        ? Array((pendingWork?.riskNotes.prefix(4) ?? []).map { String($0) })
                        : ["Full native design authoring and artifact editing are not part of this initial slice."])
                    : ["No active project; downstream workflows will remain blocked."]
            ),
            banners: banners
        )
    }

    private static func intentDraft(from project: ActiveProjectModel?) -> DesignIntentDraftModel {
        let payload = project?.snapshot["nativeDesignIntent"]?.value as? [String: Any] ?? [:]
        return DesignIntentDraftModel(
            goal: string(payload["goal"]),
            mood: string(payload["mood"]),
            constraints: string(payload["constraints"]),
            targetScope: string(payload["targetScope"]),
            references: string(payload["references"]),
            approvalNotes: string(payload["approvalNotes"]),
            updatedAt: string(payload["updatedAt"])
        )
    }

    private static func snapshotPayload(from draft: DesignIntentDraftModel) -> [String: Any] {
        [
            "goal": draft.goal.trimmingCharacters(in: .whitespacesAndNewlines),
            "mood": draft.mood.trimmingCharacters(in: .whitespacesAndNewlines),
            "constraints": draft.constraints.trimmingCharacters(in: .whitespacesAndNewlines),
            "targetScope": draft.targetScope.trimmingCharacters(in: .whitespacesAndNewlines),
            "references": draft.references.trimmingCharacters(in: .whitespacesAndNewlines),
            "approvalNotes": draft.approvalNotes.trimmingCharacters(in: .whitespacesAndNewlines),
            "updatedAt": draft.updatedAt
        ]
    }

    private static func string(_ value: Any?) -> String {
        (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    private static func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
