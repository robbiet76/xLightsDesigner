import Foundation

protocol TargetBehaviorLearningStore: Sendable {
    func load(for project: ActiveProjectModel?) throws -> TargetBehaviorLearningDocument
}

struct TargetBehaviorLearningDocument: Codable, Sendable {
    var artifactType: String = "project_target_behavior_learning_v1"
    var artifactVersion: String = "1.0"
    var records: [TargetBehaviorLearningRecord] = []
}

struct TargetBehaviorLearningRecord: Codable, Sendable {
    var recordId: String
    var targetId: String?
    var targetKind: String?
    var targetFingerprint: String?
    var displayName: String?
    var effectName: String?
    var effectFamily: String?
    var probeScope: String?
    var stats: TargetBehaviorLearningStats?
}

struct TargetBehaviorLearningStats: Codable, Sendable {
    var sampleCount: Int?
    var positiveCount: Int?
    var negativeCount: Int?
    var lastObservedAt: String?
}

struct LocalTargetBehaviorLearningStore: TargetBehaviorLearningStore {
    func load(for project: ActiveProjectModel?) throws -> TargetBehaviorLearningDocument {
        guard let project else { return TargetBehaviorLearningDocument() }
        let fileURL = targetBehaviorFileURL(for: project)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return TargetBehaviorLearningDocument()
        }
        return try JSONDecoder().decode(TargetBehaviorLearningDocument.self, from: Data(contentsOf: fileURL))
    }

    private func targetBehaviorFileURL(for project: ActiveProjectModel) -> URL {
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        return projectDir.appendingPathComponent("display/target-behavior.json", isDirectory: false)
    }
}
