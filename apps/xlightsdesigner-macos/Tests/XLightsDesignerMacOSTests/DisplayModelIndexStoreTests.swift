import Foundation
import Testing
@testable import XLightsDesignerMacOS

@Test func displayModelIndexStoreLoadsTargetFingerprints() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-model-index-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    let projectDir = root.appendingPathComponent("Project", isDirectory: true)
    let projectFile = projectDir.appendingPathComponent("Project.xdproj")
    let modelIndexFile = projectDir.appendingPathComponent("display/model-index.json")
    try FileManager.default.createDirectory(at: modelIndexFile.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data("""
    {
      "artifactType": "target_metadata_index_v1",
      "records": [
        {
          "targetId": "RenamedFace",
          "targetKind": "model",
          "identity": {
            "fingerprint": "tmf1:face",
            "fingerprintVersion": "target-metadata-fingerprint-v1",
            "displayName": "Renamed Face"
          }
        }
      ]
    }
    """.utf8).write(to: modelIndexFile)

    let project = ActiveProjectModel(
        id: "project",
        projectName: "Project",
        projectFilePath: projectFile.path,
        showFolder: "/tmp/show",
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-05-02T00:00:00Z",
        updatedAt: "2026-05-02T00:00:00Z",
        snapshot: [:]
    )

    let document = try LocalDisplayModelIndexStore().load(for: project)

    #expect(document.records.count == 1)
    #expect(document.records.first?.targetId == "RenamedFace")
    #expect(document.records.first?.identity?.fingerprint == "tmf1:face")
}
