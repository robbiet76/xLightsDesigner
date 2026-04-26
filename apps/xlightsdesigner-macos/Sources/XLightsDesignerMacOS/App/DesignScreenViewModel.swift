import Foundation
import Observation

@MainActor
@Observable
final class DesignScreenViewModel {
    private let workspace: ProjectWorkspace
    private let pendingWorkService: PendingWorkService
    private let projectService: ProjectService
    private let visualAssetGenerationService: VisualDesignAssetGenerationService
    var screenModel: DesignScreenModel
    var intentDraft: DesignIntentDraftModel
    var savedIntentDraft: DesignIntentDraftModel
    var transientBanner: WorkflowBannerModel?
    var isGeneratingVisualInspiration = false

    init(
        workspace: ProjectWorkspace,
        pendingWorkService: PendingWorkService = LocalPendingWorkService(),
        projectService: ProjectService = LocalProjectService(),
        visualAssetGenerationService: VisualDesignAssetGenerationService = LocalVisualDesignAssetGenerationService()
    ) {
        self.workspace = workspace
        self.pendingWorkService = pendingWorkService
        self.projectService = projectService
        self.visualAssetGenerationService = visualAssetGenerationService
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

    func generateVisualInspiration() {
        guard !isGeneratingVisualInspiration, let activeProject = workspace.activeProject else { return }
        let intentText = Self.visualGenerationIntentText(from: intentDraft, project: activeProject)
        guard !intentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            transientBanner = WorkflowBannerModel(
                id: "visual-inspiration-missing-intent",
                text: "Save or enter design intent before generating visual inspiration.",
                state: .blocked
            )
            return
        }
        isGeneratingVisualInspiration = true
        transientBanner = WorkflowBannerModel(
            id: "visual-inspiration-running",
            text: "Generating visual inspiration board.",
            state: .partial
        )
        Task {
            do {
                let result = try await visualAssetGenerationService.generateVisualDesignAssetPack(
                    projectFilePath: activeProject.projectFilePath,
                    sequenceID: Self.visualSequenceID(from: activeProject),
                    intentText: intentText,
                    themeSummary: Self.visualThemeSummary(from: intentDraft),
                    baseURL: ""
                )
                transientBanner = WorkflowBannerModel(
                    id: "visual-inspiration-success",
                    text: "Generated visual inspiration \(result.artifactID.isEmpty ? "" : result.artifactID).",
                    state: .ready
                )
                isGeneratingVisualInspiration = false
                NotificationCenter.default.post(name: .projectArtifactsDidChange, object: activeProject.projectFilePath)
                refresh()
            } catch {
                transientBanner = WorkflowBannerModel(
                    id: "visual-inspiration-failed",
                    text: error.localizedDescription,
                    state: .blocked
                )
                isGeneratingVisualInspiration = false
                updateAuthoringState()
            }
        }
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
        let visualInspiration = loadVisualInspiration(for: project)

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
            visualInspiration: visualInspiration,
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

    private static func visualGenerationIntentText(from draft: DesignIntentDraftModel, project: ActiveProjectModel) -> String {
        [
            draft.goal,
            draft.mood,
            draft.targetScope,
            draft.constraints,
            draft.references,
            project.projectName
        ]
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: "\n")
    }

    private static func visualThemeSummary(from draft: DesignIntentDraftModel) -> String {
        let summary = [draft.goal, draft.mood]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        return summary.isEmpty ? "custom visual inspiration for the active sequence" : summary
    }

    private static func visualSequenceID(from project: ActiveProjectModel) -> String {
        let snapshot = project.snapshot
        let candidates = [
            string(snapshot["sequencePathInput"]?.value),
            string(snapshot["activeSequence"]?.value),
            string(snapshot["mediaPath"]?.value),
            project.projectName
        ]
        return candidates.first(where: { !$0.isEmpty }) ?? project.projectName
    }

    private static func loadVisualInspiration(for project: ActiveProjectModel?) -> DesignVisualInspirationModel {
        guard let project else {
            return emptyVisualInspiration(summary: "Open or create a project to generate visual inspiration.")
        }
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        let visualRoot = projectDir.appendingPathComponent("artifacts/visual-design", isDirectory: true)
        guard let manifestURL = latestVisualDesignManifest(in: visualRoot),
              let manifest = readJSONDictionary(from: manifestURL) else {
            return emptyVisualInspiration(summary: "No visual inspiration board has been generated yet.")
        }
        let creativeIntent = manifest["creativeIntent"] as? [String: Any] ?? [:]
        let displayAsset = manifest["displayAsset"] as? [String: Any] ?? [:]
        let paletteObject = manifest["palette"] as? [String: Any] ?? [:]
        let colors = paletteRows(from: paletteObject["colors"] as? [[String: Any]] ?? creativeIntent["palette"] as? [[String: Any]] ?? [])
        let currentRevisionId = string(displayAsset["currentRevisionId"])
        let currentRevision = currentRevision(from: manifest["imageRevisions"] as? [[String: Any]] ?? [], currentRevisionId: currentRevisionId)
        let relativeImagePath = string(currentRevision["relativePath"]).isEmpty
            ? string(displayAsset["relativePath"])
            : string(currentRevision["relativePath"])
        let imagePath = relativeImagePath.isEmpty
            ? ""
            : manifestURL.deletingLastPathComponent().appendingPathComponent(relativeImagePath).path
        let paletteSummary = colors.isEmpty
            ? "Palette is required but no palette colors were found in the manifest."
            : colors.map { color in
                [color.name, color.hex, color.role].filter { !$0.isEmpty }.joined(separator: " ")
            }.joined(separator: " / ")
        let revisionSummary = revisionSummary(from: currentRevision)
        return DesignVisualInspirationModel(
            available: true,
            title: "Visual Inspiration",
            summary: string(creativeIntent["themeSummary"], fallback: "Visual inspiration board is available."),
            imagePath: imagePath,
            currentRevisionId: currentRevisionId,
            revisionSummary: revisionSummary,
            paletteSummary: paletteSummary,
            paletteDisplayMode: string(paletteObject["displayMode"], fallback: "separate_and_optional_in_image"),
            paletteCoordinationRule: string(paletteObject["coordinationRule"], fallback: "Image colors must reflect or coordinate with the approved palette."),
            palette: colors
        )
    }

    private static func emptyVisualInspiration(summary: String) -> DesignVisualInspirationModel {
        DesignVisualInspirationModel(
            available: false,
            title: "Visual Inspiration",
            summary: summary,
            imagePath: "",
            currentRevisionId: "",
            revisionSummary: "No board revision available.",
            paletteSummary: "No palette available.",
            paletteDisplayMode: "",
            paletteCoordinationRule: "Palette is required once a visual inspiration board exists.",
            palette: []
        )
    }

    private static func latestVisualDesignManifest(in root: URL) -> URL? {
        guard let enumerator = FileManager.default.enumerator(
            at: root,
            includingPropertiesForKeys: [.contentModificationDateKey, .isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return nil }
        var latest: (url: URL, modifiedAt: Date)?
        for case let url as URL in enumerator {
            guard url.lastPathComponent == "visual-design-manifest.json" else { continue }
            let values = try? url.resourceValues(forKeys: [.contentModificationDateKey, .isRegularFileKey])
            guard values?.isRegularFile == true else { continue }
            let modifiedAt = values?.contentModificationDate ?? .distantPast
            if latest == nil || modifiedAt > latest!.modifiedAt {
                latest = (url, modifiedAt)
            }
        }
        return latest?.url
    }

    private static func readJSONDictionary(from url: URL) -> [String: Any]? {
        guard let data = try? Data(contentsOf: url),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return object
    }

    private static func paletteRows(from rows: [[String: Any]]) -> [DesignPaletteColorModel] {
        rows.enumerated().map { index, row in
            let name = string(row["name"])
            let hex = string(row["hex"])
            let role = string(row["role"])
            return DesignPaletteColorModel(
                id: [name, hex, role].filter { !$0.isEmpty }.joined(separator: "::").isEmpty ? "palette-\(index)" : [name, hex, role].filter { !$0.isEmpty }.joined(separator: "::"),
                name: name,
                hex: hex,
                role: role
            )
        }
        .filter { !$0.name.isEmpty || !$0.hex.isEmpty || !$0.role.isEmpty }
    }

    private static func currentRevision(from rows: [[String: Any]], currentRevisionId: String) -> [String: Any] {
        if let row = rows.first(where: { string($0["revisionId"]) == currentRevisionId }) {
            return row
        }
        return rows.last ?? [:]
    }

    private static func revisionSummary(from row: [String: Any]) -> String {
        let revisionId = string(row["revisionId"])
        let mode = string(row["mode"])
        let changeSummary = string(row["changeSummary"])
        let paletteLocked = (row["paletteLocked"] as? Bool) ?? true
        let paletteText = paletteLocked ? "Palette preserved." : string(row["paletteChangeSummary"], fallback: "Palette changed.")
        return [
            revisionId.isEmpty ? "" : "Revision \(revisionId)",
            mode.isEmpty ? "" : mode.replacingOccurrences(of: "_", with: " "),
            changeSummary,
            paletteText
        ].filter { !$0.isEmpty }.joined(separator: " • ")
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

    private static func string(_ value: Any?, fallback: String) -> String {
        let out = string(value)
        return out.isEmpty ? fallback : out
    }

    private static func isoNow() -> String {
        ISO8601DateFormatter().string(from: Date())
    }
}
