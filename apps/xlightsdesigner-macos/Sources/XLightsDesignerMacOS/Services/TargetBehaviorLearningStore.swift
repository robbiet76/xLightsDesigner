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
    var targetId: String? = nil
    var targetKind: String? = nil
    var targetFingerprint: String? = nil
    var fingerprintVersion: String? = nil
    var displayName: String? = nil
    var parentId: String? = nil
    var parentName: String? = nil
    var effectName: String? = nil
    var effectFamily: String? = nil
    var probeScope: String? = nil
    var structureHints: [String]? = nil
    var submodelContext: TargetBehaviorLearningSubmodelContext? = nil
    var stats: TargetBehaviorLearningStats? = nil
}

struct TargetBehaviorLearningSubmodelContext: Codable, Sendable {
    var siblingCount: Int? = nil
    var overlappingSiblingIds: [String]? = nil
    var nodeCoverage: TargetBehaviorLearningNodeCoverage? = nil
}

struct TargetBehaviorLearningNodeCoverage: Codable, Sendable {
    var nodeCount: Int? = nil
    var parentNodeCount: Int? = nil
    var ratio: Double? = nil
}

struct TargetBehaviorLearningStats: Codable, Sendable {
    var sampleCount: Int? = nil
    var positiveCount: Int? = nil
    var negativeCount: Int? = nil
    var lastObservedAt: String? = nil
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
