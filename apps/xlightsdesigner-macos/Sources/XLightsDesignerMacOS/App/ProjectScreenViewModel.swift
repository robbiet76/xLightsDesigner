import Foundation
import Observation

@MainActor
@Observable
final class ProjectScreenViewModel {
    struct ProjectBriefEditorModel {
        var document: String = ""
    }

    private let workspace: ProjectWorkspace
    private let projectService: ProjectService
    private let projectSequenceStore: ProjectSequenceStore
    private let fileSelectionService: FileSelectionService
    private let sessionStore: ProjectSessionStore

    var projectDraft = ProjectDraftModel(projectName: "", showFolder: "", mediaPath: "", migrateMetadata: false, migrationSourceProjectPath: "")
    var availableProjects: [ProjectReferenceModel] = []
    var selectedOpenProjectPath = ""
    var isShowingProjectSheet = false
    var isShowingOpenProjectSheet = false
    var isEditingProjectBrief = false
    var projectBriefEditor = ProjectBriefEditorModel()
    var screenBanner: ProjectBannerModel?

    init(
        workspace: ProjectWorkspace,
        projectService: ProjectService = LocalProjectService(),
        projectSequenceStore: ProjectSequenceStore = LocalProjectSequenceStore(),
        fileSelectionService: FileSelectionService = MacOSFileSelectionService(),
        sessionStore: ProjectSessionStore = LocalProjectSessionStore()
    ) {
        self.workspace = workspace
        self.projectService = projectService
        self.projectSequenceStore = projectSequenceStore
        self.fileSelectionService = fileSelectionService
        self.sessionStore = sessionStore
    }

    var screenModel: ProjectScreenModel {
        let active = workspace.activeProject
        let readiness = active.map(readinessLevel(for:)) ?? .blocked
        return ProjectScreenModel(
            header: ProjectHeaderModel(
                title: "Project",
                subtitle: "Establish the active project and confirm its single show folder.",
                statusBadge: active == nil ? "No Project" : readiness.rawValue
            ),
            summary: active.map { project in
                ProjectSummaryModel(
                    projectName: project.projectName,
                    projectFilePath: project.projectFilePath,
                    showFolderSummary: project.showFolderSummary,
                    readiness: readinessLevel(for: project),
                    readinessExplanation: readinessExplanation(for: project)
                )
            },
            brief: active.map(projectBrief(for:)),
            actions: ProjectActionState(
                canCreate: true,
                canOpen: true
            ),
            readinessItems: active.map(readinessItems(for:)) ?? [],
            hints: active.map(downstreamHints(for:)) ?? [ProjectDownstreamHint(id: "start", text: "Create or open a project before moving to Display or Audio.")],
            banners: [workspace.projectBanner, screenBanner].compactMap { $0 }
        )
    }

    func loadInitialProject() {
        loadAvailableProjects()
        guard workspace.activeProject == nil else { return }
        do {
            if let rememberedPath = sessionStore.loadLastProjectPath(),
               FileManager.default.fileExists(atPath: rememberedPath) {
                let remembered = try projectService.openProject(filePath: rememberedPath)
                if isGeneratedTestProject(remembered) {
                    if let recent = try projectService.loadMostRecentProject() {
                        workspace.setProject(recent)
                    }
                } else {
                    workspace.setProject(remembered)
                }
            } else {
                if let recent = try projectService.loadMostRecentProject() {
                    workspace.setProject(recent)
                }
            }
            workspace.projectBanner = nil
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "load-failed", level: .blocked, text: String(error.localizedDescription))
            do {
                workspace.setProject(try projectService.loadMostRecentProject())
            } catch {}
        }
        syncSelectedProjectFromActive()
    }

    func startOpenProject() {
        loadAvailableProjects()
        syncSelectedProjectFromActive()
        isShowingOpenProjectSheet = true
    }

    func openSelectedProject() {
        let folderPath = selectedOpenProjectPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !folderPath.isEmpty else { return }
        do {
            let project = try projectService.openProject(filePath: folderPath)
            workspace.setProject(project)
            workspace.projectBanner = ProjectBannerModel(id: "opened", level: .ready, text: "Opened \(project.projectName).")
            syncSelectedProjectFromActive()
            isShowingOpenProjectSheet = false
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "open-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func startCreateProject() {
        loadAvailableProjects()
        let activeProjectFolder = workspace.activeProject.map { URL(fileURLWithPath: $0.projectFilePath).deletingLastPathComponent().path } ?? availableProjects.first?.projectFolderPath ?? ""
        projectDraft = ProjectDraftModel(
            projectName: "",
            showFolder: workspace.activeProject?.showFolder ?? "",
            mediaPath: "",
            migrateMetadata: false,
            migrationSourceProjectPath: activeProjectFolder
        )
        isShowingProjectSheet = true
    }

    func chooseDraftShowFolder() {
        if let path = fileSelectionService.chooseFolder(prompt: "Choose Project Show Folder") {
            projectDraft.showFolder = path
        }
    }

    var migrationSourceDisplayPath: String {
        let path = projectDraft.migrationSourceProjectPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !path.isEmpty else { return "" }
        let root = AppEnvironment.projectsRootPath
        if path == root { return "." }
        if path.hasPrefix(root + "/") {
            return String(path.dropFirst(root.count + 1))
        }
        return URL(fileURLWithPath: path).lastPathComponent
    }

    func confirmProjectSheet() {
        do {
            let project = try projectService.createProject(draft: projectDraft)
            workspace.setProject(project)
            workspace.projectBanner = ProjectBannerModel(
                id: "saved",
                level: .ready,
                text: projectDraft.migrateMetadata ? "Created \(project.projectName) from migrated project metadata." : "Created \(project.projectName)."
            )
            isShowingProjectSheet = false
        } catch {
            screenBanner = ProjectBannerModel(id: "sheet-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func chooseShowFolderForActiveProject() {
        guard var active = workspace.activeProject else { return }
        guard let path = fileSelectionService.chooseFolder(prompt: "Choose Project Show Folder") else { return }
        let trimmedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPath.isEmpty else { return }
        let previousShowFolder = active.showFolder.trimmingCharacters(in: .whitespacesAndNewlines)
        guard previousShowFolder != trimmedPath else {
            workspace.projectBanner = ProjectBannerModel(id: "show-folder-unchanged", level: .ready, text: "Show folder is already linked to this project.")
            return
        }
        active.showFolder = trimmedPath
        active.snapshot["showFolderRelink"] = AnyCodable([
            "previousShowFolder": previousShowFolder,
            "showFolder": trimmedPath,
            "updatedAt": ISO8601DateFormatter().string(from: Date()),
            "behavior": "Preserve project metadata and refresh display, sequence, design, and review state against the new show folder."
        ])
        relinkSequenceSnapshotPaths(
            in: &active,
            previousShowFolder: previousShowFolder,
            newShowFolder: trimmedPath
        )
        do {
            try projectSequenceStore.relinkSequences(
                project: &active,
                previousShowFolder: previousShowFolder,
                newShowFolder: trimmedPath
            )
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "show-folder-sequence-relink-failed", level: .blocked, text: "Unable to refresh project sequence records: \(error.localizedDescription)")
            return
        }
        relinkMediaSnapshotPaths(
            in: &active,
            previousShowFolder: previousShowFolder,
            newShowFolder: trimmedPath
        )
        var flags = (active.snapshot["flags"]?.value as? [String: Any]) ?? [:]
        let proposedRows = active.snapshot["proposed"]?.value as? [Any] ?? []
        flags["proposalStale"] = true
        flags["hasDraftProposal"] = !proposedRows.isEmpty
        active.snapshot["flags"] = AnyCodable(flags)
        var runtime = (active.snapshot["sequenceAgentRuntime"]?.value as? [String: Any]) ?? [:]
        runtime["displayRelink"] = [
            "previousShowFolder": previousShowFolder,
            "showFolder": trimmedPath,
            "reason": "show folder changed",
            "changedAt": ISO8601DateFormatter().string(from: Date())
        ]
        active.snapshot["sequenceAgentRuntime"] = AnyCodable(runtime)
        do {
            let saved = try projectService.saveProject(active)
            workspace.setProject(saved)
            NotificationCenter.default.post(name: .projectShowFolderDidRelink, object: saved.projectFilePath)
            workspace.projectBanner = ProjectBannerModel(id: "show-folder-relinked", level: .ready, text: "Relinked show folder. Existing project metadata was kept; Display, Sequence, Design, and Review will refresh against the new folder.")
            loadAvailableProjects()
            syncSelectedProjectFromActive()
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "show-folder-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func startEditProjectBrief() {
        let brief = workspace.activeProject.map(projectBrief(for:))
        projectBriefEditor = ProjectBriefEditorModel(
            document: brief?.document ?? ""
        )
        isEditingProjectBrief = true
    }

    func saveProjectBrief() {
        guard var active = workspace.activeProject else { return }
        let payload: [String: Any] = [
            "document": projectBriefEditor.document.trimmingCharacters(in: .whitespacesAndNewlines),
            "updatedAt": ISO8601DateFormatter().string(from: Date())
        ]
        active.snapshot["projectBrief"] = AnyCodable(payload)
        do {
            let saved = try projectService.saveProject(active)
            workspace.setProject(saved)
            workspace.projectBanner = ProjectBannerModel(id: "project-brief-saved", level: .ready, text: "Project brief updated.")
            isEditingProjectBrief = false
        } catch {
            screenBanner = ProjectBannerModel(id: "project-brief-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func cancelProjectBriefEditing() {
        isEditingProjectBrief = false
    }

    func clearProjectBrief() {
        guard var active = workspace.activeProject else { return }
        active.snapshot.removeValue(forKey: "projectBrief")
        do {
            let saved = try projectService.saveProject(active)
            workspace.setProject(saved)
            projectBriefEditor = ProjectBriefEditorModel()
            isEditingProjectBrief = false
        } catch {
            screenBanner = ProjectBannerModel(id: "project-brief-clear-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }


    func dismissProjectSheet() {
        isShowingProjectSheet = false
        screenBanner = nil
    }

    func dismissOpenProjectSheet() {
        isShowingOpenProjectSheet = false
    }

    private func loadAvailableProjects() {
        do {
            availableProjects = try projectService.listProjects()
            if selectedOpenProjectPath.isEmpty {
                syncSelectedProjectFromActive()
            }
        } catch {
            availableProjects = []
            screenBanner = ProjectBannerModel(id: "project-list-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    private func syncSelectedProjectFromActive() {
        if let activePath = workspace.activeProject.map({ URL(fileURLWithPath: $0.projectFilePath).deletingLastPathComponent().path }),
           availableProjects.contains(where: { $0.projectFolderPath == activePath }) {
            selectedOpenProjectPath = activePath
        } else if selectedOpenProjectPath.isEmpty {
            selectedOpenProjectPath = availableProjects.first?.projectFolderPath ?? ""
        }
    }

    private func relinkSequenceSnapshotPaths(in project: inout ActiveProjectModel, previousShowFolder: String, newShowFolder: String) {
        let previousPath = string(project.snapshot["sequencePathInput"]?.value)
        if let resolved = resolveRelinkedSequencePath(previousPath, previousShowFolder: previousShowFolder, newShowFolder: newShowFolder) {
            project.snapshot["sequencePathInput"] = AnyCodable(resolved)
            let sequenceName = ProjectTargetContext.nameWithoutExtension(resolved)
            if !sequenceName.isEmpty {
                project.snapshot["activeSequence"] = AnyCodable(sequenceName)
            }
        }

        if let recentSequences = project.snapshot["recentSequences"]?.value as? [Any] {
            project.snapshot["recentSequences"] = AnyCodable(recentSequences.map { value in
                let path = string(value)
                return resolveRelinkedSequencePath(path, previousShowFolder: previousShowFolder, newShowFolder: newShowFolder) ?? path
            })
        }

        guard var projectSequences = project.snapshot["projectSequences"]?.value as? [[String: Any]] else { return }
        for index in projectSequences.indices {
            let path = string(projectSequences[index]["sequencePath"])
            if let resolved = resolveRelinkedSequencePath(path, previousShowFolder: previousShowFolder, newShowFolder: newShowFolder) {
                projectSequences[index]["sequencePath"] = resolved
            }
        }
        project.snapshot["projectSequences"] = AnyCodable(projectSequences)
    }

    private func relinkMediaSnapshotPaths(in project: inout ActiveProjectModel, previousShowFolder: String, newShowFolder: String) {
        let audioPath = string(project.snapshot["audioPathInput"]?.value)
        if let resolved = resolveRelinkedMediaPath(audioPath, previousShowFolder: previousShowFolder, newShowFolder: newShowFolder, shouldExist: true) {
            project.snapshot["audioPathInput"] = AnyCodable(resolved)
        } else if pathIsWithin(audioPath, root: previousShowFolder) {
            project.snapshot["audioPathInput"] = AnyCodable("")
        }

        let sequenceMediaFile = string(project.snapshot["sequenceMediaFile"]?.value)
        if let resolved = resolveRelinkedMediaPath(sequenceMediaFile, previousShowFolder: previousShowFolder, newShowFolder: newShowFolder, shouldExist: true) {
            project.snapshot["sequenceMediaFile"] = AnyCodable(resolved)
        } else if pathIsWithin(sequenceMediaFile, root: previousShowFolder) {
            project.snapshot["sequenceMediaFile"] = AnyCodable("")
        }

        let mediaPath = project.mediaPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? string(project.snapshot["mediaPath"]?.value)
            : project.mediaPath
        if let resolved = resolveRelinkedMediaPath(mediaPath, previousShowFolder: previousShowFolder, newShowFolder: newShowFolder, shouldExist: false) {
            project.mediaPath = resolved
            project.snapshot["mediaPath"] = AnyCodable(resolved)
        } else if pathIsWithin(mediaPath, root: previousShowFolder) {
            project.mediaPath = ""
            project.snapshot["mediaPath"] = AnyCodable("")
        }
    }

    private func resolveRelinkedMediaPath(_ mediaPath: String, previousShowFolder: String, newShowFolder: String, shouldExist: Bool) -> String? {
        let previousPath = normalizedPath(mediaPath)
        guard !previousPath.isEmpty else { return nil }
        let previousRoot = normalizedPath(previousShowFolder)
        let newRoot = normalizedPath(newShowFolder)
        guard !previousRoot.isEmpty, !newRoot.isEmpty, previousPath.hasPrefix(previousRoot + "/") else {
            return nil
        }
        let relativePath = String(previousPath.dropFirst(previousRoot.count + 1))
        let candidate = URL(fileURLWithPath: newRoot).appendingPathComponent(relativePath).path
        if shouldExist {
            return FileManager.default.fileExists(atPath: candidate) ? candidate : nil
        }
        var isDirectory: ObjCBool = false
        if FileManager.default.fileExists(atPath: candidate, isDirectory: &isDirectory), isDirectory.boolValue {
            return candidate
        }
        return nil
    }

    private func resolveRelinkedSequencePath(_ sequencePath: String, previousShowFolder: String, newShowFolder: String) -> String? {
        let previousPath = normalizedPath(sequencePath)
        guard !previousPath.isEmpty else { return nil }

        let previousRoot = normalizedPath(previousShowFolder)
        let newRoot = normalizedPath(newShowFolder)
        if !previousRoot.isEmpty, !newRoot.isEmpty, previousPath.hasPrefix(previousRoot + "/") {
            let relativePath = String(previousPath.dropFirst(previousRoot.count + 1))
            let candidate = URL(fileURLWithPath: newRoot).appendingPathComponent(relativePath).path
            if FileManager.default.fileExists(atPath: candidate) {
                return candidate
            }
        }

        if previousPath.hasPrefix(newRoot + "/"), FileManager.default.fileExists(atPath: previousPath) {
            return previousPath
        }

        let fileName = URL(fileURLWithPath: previousPath).lastPathComponent
        guard !fileName.isEmpty else { return nil }
        let matches = sequenceFiles(in: newRoot).filter { URL(fileURLWithPath: $0).lastPathComponent == fileName }
        return matches.count == 1 ? matches[0] : nil
    }

    private func sequenceFiles(in showFolder: String) -> [String] {
        guard !showFolder.isEmpty,
              let enumerator = FileManager.default.enumerator(atPath: showFolder) else {
            return []
        }
        var matches: [String] = []
        for case let relativePath as String in enumerator where relativePath.hasSuffix(".xsq") {
            matches.append(URL(fileURLWithPath: showFolder).appendingPathComponent(relativePath).path)
        }
        return matches.sorted()
    }

    private func normalizedPath(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\", with: "/")
            .replacingOccurrences(of: #"/+$"#, with: "", options: .regularExpression)
    }

    private func pathIsWithin(_ path: String, root: String) -> Bool {
        let normalized = normalizedPath(path)
        let normalizedRoot = normalizedPath(root)
        guard !normalized.isEmpty, !normalizedRoot.isEmpty else { return false }
        return normalized == normalizedRoot || normalized.hasPrefix(normalizedRoot + "/")
    }

    private func projectBrief(for project: ActiveProjectModel) -> ProjectBriefModel {
        let snapshot = project.snapshot.mapValues(\.value)
        let brief = snapshot["projectBrief"] as? [String: Any] ?? [:]
        return ProjectBriefModel(
            document: string(brief["document"]),
            updatedAt: string(brief["updatedAt"])
        )
    }

    private func readinessLevel(for project: ActiveProjectModel) -> WorkflowReadinessLevel {
        let hasShowFolder = !project.showFolder.isEmpty && FileManager.default.fileExists(atPath: project.showFolder)
        if !hasShowFolder { return .blocked }
        return .ready
    }

    private func readinessExplanation(for project: ActiveProjectModel) -> String {
        if project.showFolder.isEmpty {
            return "Show folder is missing. Display depends on a valid show folder reference."
        }
        var isDir: ObjCBool = false
        if !FileManager.default.fileExists(atPath: project.showFolder, isDirectory: &isDir) || !isDir.boolValue {
            return "Show folder does not exist at the saved path. Correct it before using Display."
        }
        return "Project context is ready. Display and Audio can use this project now."
    }

    private func readinessItems(for project: ActiveProjectModel) -> [ProjectReadinessItem] {
        [
            ProjectReadinessItem(id: "file", label: "Project File", value: project.projectFilePath, status: .ready),
            ProjectReadinessItem(id: "show", label: "Project Show Folder", value: project.showFolderSummary, status: readinessLevel(for: project))
        ]
    }

    private func downstreamHints(for project: ActiveProjectModel) -> [ProjectDownstreamHint] {
        let displayHint = readinessLevel(for: project) == .ready ? "Display can be reviewed now." : "Display is blocked by project context."
        var hints = [
            ProjectDownstreamHint(id: "display", text: displayHint),
            ProjectDownstreamHint(id: "audio", text: "Audio remains available as a standalone workflow."),
            ProjectDownstreamHint(id: "sequence-media", text: "Sequence-specific media selection happens later when working on a specific sequence.")
        ]
        if let sequenceHint = activeSequenceAvailabilityHint(for: project) {
            hints.append(sequenceHint)
        }
        return hints
    }

    private func activeSequenceAvailabilityHint(for project: ActiveProjectModel) -> ProjectDownstreamHint? {
        let rows = (project.snapshot["projectSequences"]?.value as? [[String: Any]]) ?? []
        guard let active = rows.first(where: { bool($0["isActive"]) }) else { return nil }
        let name = string(active["displayName"])
        let displayName = name.isEmpty ? "Active project sequence" : name
        switch string(active["availabilityStatus"]) {
        case "available":
            return ProjectDownstreamHint(id: "sequence-available", text: "\(displayName) is available in the linked show folder.")
        case "unavailable":
            return ProjectDownstreamHint(id: "sequence-unavailable", text: "\(displayName) was not found in the linked show folder. Sequence will stay blocked until it is selected or created there.")
        case "referenced":
            return ProjectDownstreamHint(id: "sequence-referenced", text: "\(displayName) is referenced by this project but has not been verified in the linked show folder.")
        default:
            return nil
        }
    }

    private func isGeneratedTestProject(_ project: ActiveProjectModel) -> Bool {
        project.projectName.hasPrefix("App Test Project ") || project.projectName.hasPrefix("DisplayMetadataStore")
    }

    private func string(_ value: Any?) -> String {
        if let string = value as? String {
            return string.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return ""
    }

    private func bool(_ value: Any?) -> Bool {
        if let bool = value as? Bool { return bool }
        if let string = value as? String {
            return ["true", "yes", "1"].contains(string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
        }
        return false
    }

}
