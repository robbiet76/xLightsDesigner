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
        fileSelectionService: FileSelectionService = NativeFileSelectionService(),
        sessionStore: ProjectSessionStore = LocalProjectSessionStore()
    ) {
        self.workspace = workspace
        self.projectService = projectService
        self.fileSelectionService = fileSelectionService
        self.sessionStore = sessionStore
    }

    var screenModel: ProjectScreenModel {
        let active = workspace.activeProject
        let readiness = active.map(readinessLevel(for:)) ?? .blocked
        return ProjectScreenModel(
            header: ProjectHeaderModel(
                title: "Project",
                subtitle: "Establish the active project and confirm the referenced show paths.",
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
        if let path = fileSelectionService.chooseFolder(prompt: "Choose Show Folder") {
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
        guard let path = fileSelectionService.chooseFolder(prompt: "Choose Show Folder") else { return }
        let trimmedPath = path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPath.isEmpty else { return }
        active.showFolder = trimmedPath
        do {
            let saved = try projectService.saveProject(active)
            workspace.setProject(saved)
            workspace.projectBanner = ProjectBannerModel(id: "show-folder", level: .ready, text: "Updated show folder.")
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
            ProjectReadinessItem(id: "show", label: "xLights Show", value: project.showFolderSummary, status: readinessLevel(for: project))
        ]
    }

    private func downstreamHints(for project: ActiveProjectModel) -> [ProjectDownstreamHint] {
        let displayHint = readinessLevel(for: project) == .ready ? "Display can be reviewed now." : "Display is blocked by project context."
        return [
            ProjectDownstreamHint(id: "display", text: displayHint),
            ProjectDownstreamHint(id: "audio", text: "Audio remains available as a standalone workflow."),
            ProjectDownstreamHint(id: "sequence-media", text: "Sequence-specific media selection happens later when working on a specific sequence.")
        ]
    }

    private func isGeneratedTestProject(_ project: ActiveProjectModel) -> Bool {
        project.projectName.hasPrefix("Native Test Project ") || project.projectName.hasPrefix("DisplayMetadataStore")
    }

    private func string(_ value: Any?) -> String {
        if let string = value as? String {
            return string.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return ""
    }

}
