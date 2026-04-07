import Foundation
import Observation

@MainActor
@Observable
final class ProjectScreenViewModel {
    private let workspace: ProjectWorkspace
    private let projectService: ProjectService
    private let fileSelectionService: FileSelectionService

    var projectSheetMode: ProjectSheetMode = .create
    var projectDraft = ProjectDraftModel(projectName: "", showFolder: "", mediaPath: "")
    var isShowingProjectSheet = false
    var screenBanner: ProjectBannerModel?

    init(
        workspace: ProjectWorkspace,
        projectService: ProjectService = LocalProjectService(),
        fileSelectionService: FileSelectionService = NativeFileSelectionService()
    ) {
        self.workspace = workspace
        self.projectService = projectService
        self.fileSelectionService = fileSelectionService
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
                    mediaPathSummary: project.mediaPathSummary,
                    readiness: readinessLevel(for: project),
                    readinessExplanation: readinessExplanation(for: project)
                )
            },
            actions: ProjectActionState(
                canCreate: true,
                canOpen: true,
                canSave: active != nil,
                canSaveAs: active != nil
            ),
            readinessItems: active.map(readinessItems(for:)) ?? [],
            hints: active.map(downstreamHints(for:)) ?? [ProjectDownstreamHint(id: "start", text: "Create or open a project before moving to Layout or Audio.")],
            banners: [workspace.projectBanner, screenBanner].compactMap { $0 }
        )
    }

    func loadInitialProject() {
        guard workspace.activeProject == nil else { return }
        do {
            workspace.setProject(try projectService.loadMostRecentProject())
            workspace.projectBanner = nil
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "load-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func openProject() {
        guard let filePath = fileSelectionService.chooseProjectFile() else { return }
        do {
            let project = try projectService.openProject(filePath: filePath)
            workspace.setProject(project)
            workspace.projectBanner = ProjectBannerModel(id: "opened", level: .ready, text: "Opened \(project.projectName).")
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "open-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func startCreateProject() {
        projectSheetMode = .create
        projectDraft = ProjectDraftModel(projectName: "", showFolder: workspace.activeProject?.showFolder ?? "", mediaPath: workspace.activeProject?.mediaPath ?? "")
        isShowingProjectSheet = true
    }

    func startSaveAsProject() {
        guard let active = workspace.activeProject else { return }
        projectSheetMode = .saveAs
        projectDraft = ProjectDraftModel(projectName: active.projectName, showFolder: active.showFolder, mediaPath: active.mediaPath)
        isShowingProjectSheet = true
    }

    func chooseDraftShowFolder() {
        if let path = fileSelectionService.chooseFolder(prompt: "Choose Show Folder") {
            projectDraft.showFolder = path
        }
    }

    func chooseDraftMediaFolder() {
        if let path = fileSelectionService.chooseFolder(prompt: "Choose Media Folder") {
            projectDraft.mediaPath = path
        }
    }

    func confirmProjectSheet() {
        do {
            let project: ActiveProjectModel
            switch projectSheetMode {
            case .create:
                project = try projectService.createProject(draft: projectDraft)
            case .saveAs:
                guard let active = workspace.activeProject else { return }
                var draftProject = active
                draftProject.showFolder = projectDraft.showFolder
                draftProject.mediaPath = projectDraft.mediaPath
                project = try projectService.saveProjectAs(draftProject, projectName: projectDraft.projectName)
            }
            workspace.setProject(project)
            workspace.projectBanner = ProjectBannerModel(id: "saved", level: .ready, text: "Saved \(project.projectName).")
            isShowingProjectSheet = false
        } catch {
            screenBanner = ProjectBannerModel(id: "sheet-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func saveProject() {
        guard let active = workspace.activeProject else { return }
        do {
            let saved = try projectService.saveProject(active)
            workspace.setProject(saved)
            workspace.projectBanner = ProjectBannerModel(id: "save", level: .ready, text: "Saved \(saved.projectName).")
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "save-failed", level: .blocked, text: String(error.localizedDescription))
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
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "show-folder-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func chooseMediaFolderForActiveProject() {
        guard var active = workspace.activeProject else { return }
        guard let path = fileSelectionService.chooseFolder(prompt: "Choose Media Folder") else { return }
        active.mediaPath = path
        do {
            let saved = try projectService.saveProject(active)
            workspace.setProject(saved)
            workspace.projectBanner = ProjectBannerModel(id: "media-folder", level: .ready, text: "Updated media folder.")
        } catch {
            workspace.projectBanner = ProjectBannerModel(id: "media-folder-failed", level: .blocked, text: String(error.localizedDescription))
        }
    }

    func dismissProjectSheet() {
        isShowingProjectSheet = false
        screenBanner = nil
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
            ProjectReadinessItem(id: "show", label: "Show Folder", value: project.showFolderSummary, status: readinessLevel(for: project)),
            ProjectReadinessItem(id: "media", label: "Media Path", value: project.mediaPathSummary, status: project.mediaPath.isEmpty ? .partial : .ready)
        ]
    }

    private func downstreamHints(for project: ActiveProjectModel) -> [ProjectDownstreamHint] {
        let layoutHint = readinessLevel(for: project) == .ready ? "Layout can be reviewed now." : "Layout is blocked by project context."
        return [
            ProjectDownstreamHint(id: "layout", text: layoutHint),
            ProjectDownstreamHint(id: "audio", text: "Audio remains available as a standalone workflow.")
        ]
    }
}
