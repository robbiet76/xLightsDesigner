import Foundation
import Testing
@testable import XLightsDesignerMacOS

@Test func projectTargetContextPrefersCanonicalActiveSequenceRecord() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-target-context-\(UUID().uuidString)", isDirectory: true)
    let projectDir = root.appendingPathComponent("Project", isDirectory: true)
    let showFolder = root.appendingPathComponent("show", isDirectory: true)
    let sequencePath = showFolder.appendingPathComponent("Canonical/Canonical.xsq")
    let audioPath = showFolder.appendingPathComponent("Audio/Canonical.mp3")
    try FileManager.default.createDirectory(at: sequencePath.deletingLastPathComponent(), withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: audioPath.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Data("<sequence/>".utf8).write(to: sequencePath)
    try Data("audio".utf8).write(to: audioPath)
    var project = ActiveProjectModel(
        id: "project-1",
        projectName: "Christmas 2026",
        projectFilePath: projectDir.appendingPathComponent("Christmas 2026.xdproj").path,
        showFolder: showFolder.path,
        mediaPath: "",
        appRootPath: AppEnvironment.canonicalAppRoot,
        createdAt: "2026-05-03T00:00:00Z",
        updatedAt: "2026-05-03T00:00:00Z",
        snapshot: [
            "activeSequence": AnyCodable("StaleSnapshot"),
            "sequencePathInput": AnyCodable("/tmp/stale/StaleSnapshot.xsq"),
            "audioPathInput": AnyCodable("/tmp/stale/Stale.mp3")
        ]
    )
    try LocalProjectSequenceStore().upsertActiveSequence(project: &project, sequencePath: sequencePath.path, audioPath: audioPath.path)
    project.snapshot["activeSequence"] = AnyCodable("StaleSnapshot")
    project.snapshot["sequencePathInput"] = AnyCodable("/tmp/stale/StaleSnapshot.xsq")
    project.snapshot["audioPathInput"] = AnyCodable("/tmp/stale/Stale.mp3")

    let context = ProjectTargetContext.resolve(project: project)

    #expect(context.sequenceName == "Canonical")
    #expect(context.sequencePath == sequencePath.path)
    #expect(context.audioName == "Canonical")
    #expect(context.audioPath == audioPath.path)
}
