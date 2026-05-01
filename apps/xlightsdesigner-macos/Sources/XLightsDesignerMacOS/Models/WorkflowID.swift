import Foundation

enum WorkflowID: String, CaseIterable, Identifiable {
    case project = "Project"
    case display = "Display"
    case audio = "Audio"
    case design = "Design"
    case sequence = "Sequence"
    case review = "Review"
    case history = "History"

    var id: String { rawValue }

    var specPath: String {
        switch self {
        case .project, .display, .audio, .design, .sequence, .review, .history:
            return "specs/app-ui/app-workspace.md"
        }
    }

    var summary: String {
        switch self {
        case .project:
            return "Establish active project context and confirm referenced paths."
        case .display:
            return "Manage learned display metadata grounded in the xLights layout."
        case .audio:
            return "Run standalone audio analysis and browse the shared track library."
        case .design:
            return "Review creative intent, proposals, and rationale."
        case .sequence:
            return "Translate approved design intent into technical sequencing context."
        case .review:
            return "Gate pending implementation and apply approved work."
        case .history:
            return "Browse retrospective revisions and previously applied changes."
        }
    }
}
