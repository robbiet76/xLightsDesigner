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
        case .project:
            return "specs/app-ui/macos-native-project-screen-layout-2026-04-06.md"
        case .display:
            return "specs/app-ui/macos-native-display-page-2026-04-08.md"
        case .audio:
            return "specs/app-ui/macos-native-audio-screen-layout-2026-04-06.md"
        case .design:
            return "specs/app-ui/macos-native-design-screen-layout-2026-04-06.md"
        case .sequence:
            return "specs/app-ui/macos-native-sequence-screen-layout-2026-04-06.md"
        case .review:
            return "specs/app-ui/macos-native-review-screen-layout-2026-04-06.md"
        case .history:
            return "specs/app-ui/macos-native-history-screen-layout-2026-04-06.md"
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

    static func preferredWorkflow(for phaseID: WorkflowPhaseID) -> WorkflowID {
        switch phaseID {
        case .setup:
            return .project
        case .projectMission:
            return .project
        case .audioAnalysis:
            return .audio
        case .displayDiscovery:
            return .display
        case .design:
            return .design
        case .sequencing:
            return .sequence
        case .review:
            return .review
        }
    }
}
