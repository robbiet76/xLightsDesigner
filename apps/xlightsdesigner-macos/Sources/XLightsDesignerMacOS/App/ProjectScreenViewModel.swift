import Foundation
import Observation

@MainActor
@Observable
final class ProjectScreenViewModel {
    private let workspace: ProjectWorkspace
    private let projectService: ProjectService
    private let fileSelectionService: FileSelectionService
    private let sessionStore: ProjectSessionStore

    var projectDraft = ProjectDraftModel(projectName: "", showFolder: "", mediaPath: "", migrateMetadata: false, migrationSourceProjectPath: "")
    var availableProjects: [ProjectReferenceModel] = []
    var selectedOpenProjectPath = ""
    var isShowingProjectSheet = false
    var isShowingOpenProjectSheet = false
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
            actions: ProjectActionState(
                canCreate: true,
                canOpen: true
            ),
            readinessItems: active.map(readinessItems(for:)) ?? [],
            hints: active.map(downstreamHints(for:)) ?? [ProjectDownstreamHint(id: "start", text: "Create or open a project before moving to Layout or Audio.")],
            banners: [workspace.projectBanner, screenBanner].compactMap { $0 }
        )
    }

    func loadInitialProject() {
        loadAvailableProjects()
        guard workspace.activeProject == nil else { return }
        do {
            if let rememberedPath = sessionStore.loadLastProjectPath(),
               FileManager.default.fileExists(atPath: rememberedPath) {
                workspace.setProject(try projectService.openProject(filePath: rememberedPath))
            } else {
                workspace.setProject(try projectService.loadMostRecentProject())
            }
            workspace.projectBanner = nil
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "load-failed", level: .blocked, text: String(error.localizedDescription))
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
        active.showFolder = path
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

    private func readinessLevel(for project: ActiveProjectModel) -> WorkflowReadinessLevel {
        let hasShowFolder = !project.showFolder.isEmpty && FileManager.default.fileExists(atPath: project.showFolder)
        if !hasShowFolder { return .blocked }
        return .ready
    }

    private func readinessExplanation(for project: ActiveProjectModel) -> String {
        if project.showFolder.isEmpty {
            return "Show folder is missing. Layout depends on a valid show folder reference."
        }
        var isDir: ObjCBool = false
        if !FileManager.default.fileExists(atPath: project.showFolder, isDirectory: &isDir) || !isDir.boolValue {
            return "Show folder does not exist at the saved path. Correct it before using Layout."
        }
        return "Project context is ready. Layout and Audio can use this project now."
    }

    private func readinessItems(for project: ActiveProjectModel) -> [ProjectReadinessItem] {
        [
            ProjectReadinessItem(id: "file", label: "Project File", value: project.projectFilePath, status: .ready),
            ProjectReadinessItem(id: "show", label: "xLights Show", value: project.showFolderSummary, status: readinessLevel(for: project))
        ]
    }

    private func downstreamHints(for project: ActiveProjectModel) -> [ProjectDownstreamHint] {
        let layoutHint = readinessLevel(for: project) == .ready ? "Layout can be reviewed now." : "Layout is blocked by project context."
        return [
            ProjectDownstreamHint(id: "layout", text: layoutHint),
            ProjectDownstreamHint(id: "audio", text: "Audio remains available as a standalone workflow."),
            ProjectDownstreamHint(id: "sequence-media", text: "Sequence-specific media selection happens later when working on a specific sequence.")
        ]
    }
}
