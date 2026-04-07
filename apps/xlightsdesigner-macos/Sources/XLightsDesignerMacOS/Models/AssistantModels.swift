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
}

struct AssistantContextModel {
    let activeProjectName: String
    let workflowName: String
    let focusedSummary: String
}
