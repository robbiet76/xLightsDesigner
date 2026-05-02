import Foundation
import Testing
@testable import XLightsDesignerMacOS

@Test func targetBehaviorLearningStoreLoadsProjectLocalRecords() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-target-behavior-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectDir = root.appendingPathComponent("Project", isDirectory: true)
    let projectFile = projectDir.appendingPathComponent("Project.xdproj")
    let behaviorFile = projectDir.appendingPathComponent("display/target-behavior.json")
    try FileManager.default.createDirectory(at: behaviorFile.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data("""
    {
      "artifactType": "project_target_behavior_learning_v1",
      "artifactVersion": "1.0",
      "records": [
        {
          "recordId": "tbl1:test",
          "targetId": "CustomFace/@Mouth",
          "targetKind": "submodel",
          "effectName": "On",
          "probeScope": "submodel",
          "stats": {
            "sampleCount": 2,
            "positiveCount": 2,
            "negativeCount": 0,
            "lastObservedAt": "2026-05-01T12:00:00Z"
          }
        }
      ]
    }
    """.utf8).write(to: behaviorFile)

    let project = ActiveProjectModel(
        id: "project",
        projectName: "Project",
        projectFilePath: projectFile.path,
        showFolder: "/tmp/show",
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-01T00:00:00Z",
        snapshot: [:]
    )

    let document = try LocalTargetBehaviorLearningStore().load(for: project)

    #expect(document.records.count == 1)
    #expect(document.records.first?.recordId == "tbl1:test")
    #expect(document.records.first?.stats?.positiveCount == 2)
}
