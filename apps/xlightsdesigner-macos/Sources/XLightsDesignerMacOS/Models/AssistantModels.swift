import Foundation

enum AssistantMessageRole: String, Codable {
    case user
    case assistant
}

struct AssistantMessageModel: Identifiable, Codable, Equatable {
    let id: String
    let role: AssistantMessageRole
    let text: String
    let timestamp: String
    let handledBy: String?
    let routeDecision: String?
    let displayName: String?
}

struct AssistantContextModel {
    let activeProjectName: String
    let workflowName: String
    let route: String
    let focusedSummary: String
    let activeSequenceLoaded: Bool
    let planOnlyMode: Bool

    func asPayload() -> [String: Any] {
        [
            "activeProjectName": activeProjectName,
            "workflowName": workflowName,
            "route": route,
            "focusedSummary": focusedSummary,
            "activeSequenceLoaded": activeSequenceLoaded,
            "planOnlyMode": planOnlyMode
        ]
    }
}
