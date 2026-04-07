import Foundation

enum WorkflowReadinessLevel: String, Codable, Sendable {
    case ready = "Ready"
    case partial = "Partial"
    case blocked = "Blocked"
}

struct ActiveProjectModel: Identifiable, Equatable {
    let id: String
    var projectName: String
    var projectFilePath: String
    var showFolder: String
    var mediaPath: String
    var appRootPath: String
    var createdAt: String
    var updatedAt: String
    var snapshot: [String: AnyCodable]

    var showFolderSummary: String {
        showFolder.isEmpty ? "(not set)" : showFolder
    }

    var mediaPathSummary: String {
        mediaPath.isEmpty ? "(not set)" : mediaPath
    }

    var fileName: String {
        URL(fileURLWithPath: projectFilePath).lastPathComponent
    }
}

struct ProjectHeaderModel {
    let title: String
    let subtitle: String
    let statusBadge: String
}

struct ProjectSummaryModel {
    let projectName: String
    let projectFilePath: String
    let showFolderSummary: String
    let mediaPathSummary: String
    let readiness: WorkflowReadinessLevel
    let readinessExplanation: String
}

struct ProjectActionState {
    let canCreate: Bool
    let canOpen: Bool
    let canSave: Bool
    let canSaveAs: Bool
}

struct ProjectReadinessItem: Identifiable {
    let id: String
    let label: String
    let value: String
    let status: WorkflowReadinessLevel
}

struct ProjectDownstreamHint: Identifiable {
    let id: String
    let text: String
}

struct ProjectBannerModel: Identifiable {
    let id: String
    let level: WorkflowReadinessLevel
    let text: String
}

struct ProjectScreenModel {
    let header: ProjectHeaderModel
    let summary: ProjectSummaryModel?
    let actions: ProjectActionState
    let readinessItems: [ProjectReadinessItem]
    let hints: [ProjectDownstreamHint]
    let banners: [ProjectBannerModel]
}

struct ProjectDraftModel {
    var projectName: String
    var showFolder: String
    var mediaPath: String
}

enum ProjectSheetMode: String {
    case create = "Create Project"
    case saveAs = "Save Project As"
}
