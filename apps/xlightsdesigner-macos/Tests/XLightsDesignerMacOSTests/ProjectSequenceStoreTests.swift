import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct ProjectSequenceStoreTests {
    @Test func storeWritesCanonicalSequenceRecordAndSnapshotIndex() throws {
        let project = try makeProject()
        var mutableProject = project
        let showFolder = URL(fileURLWithPath: project.showFolder, isDirectory: true)
        let sequencePath = showFolder.appendingPathComponent("HolidayRoad/HolidayRoad.xsq")
        let audioPath = showFolder.appendingPathComponent("Audio/HolidayRoad.mp3")
        try FileManager.default.createDirectory(at: sequencePath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: audioPath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("<sequence/>".utf8).write(to: sequencePath)
        try Data("audio".utf8).write(to: audioPath)

        let changed = try LocalProjectSequenceStore().upsertActiveSequence(
            project: &mutableProject,
            sequencePath: sequencePath.path,
            audioPath: audioPath.path
        )
        let rows = try #require(mutableProject.snapshot["projectSequences"]?.value as? [[String: Any]])
        let row = try #require(rows.first)
        let sequenceID = try #require(row["sequenceId"] as? String)
        let recordURL = URL(fileURLWithPath: mutableProject.projectFilePath)
            .deletingLastPathComponent()
            .appendingPathComponent("sequences/\(sequenceID)/sequence.json")
        let document = try JSONDecoder().decode(ProjectSequenceDocument.self, from: Data(contentsOf: recordURL))

        #expect(changed)
        #expect(rows.count == 1)
        #expect(row["sequencePath"] as? String == sequencePath.path)
        #expect(row["displayName"] as? String == "HolidayRoad")
        #expect(row["showFolderAtLastUse"] as? String == showFolder.path)
        #expect(row["availabilityStatus"] as? String == "available")
        #expect(row["isActive"] as? Bool == true)
        #expect(document.sequenceId == sequenceID)
        #expect(document.displayName == "HolidayRoad")
        #expect(document.sequencePath == sequencePath.path)
        #expect(document.mediaPath == audioPath.path)
        #expect(document.showFolderAtLastUse == showFolder.path)
        #expect(document.availabilityStatus == "available")
    }

    @Test func storeMarksOnlyLatestSequenceActive() throws {
        var project = try makeProject()
        let showFolder = URL(fileURLWithPath: project.showFolder, isDirectory: true)
        let firstPath = showFolder.appendingPathComponent("First/First.xsq")
        let secondPath = showFolder.appendingPathComponent("Second/Second.xsq")
        try FileManager.default.createDirectory(at: firstPath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: secondPath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("<sequence/>".utf8).write(to: firstPath)
        try Data("<sequence/>".utf8).write(to: secondPath)
        let store = LocalProjectSequenceStore()

        try store.upsertActiveSequence(project: &project, sequencePath: firstPath.path, audioPath: nil)
        try store.upsertActiveSequence(project: &project, sequencePath: secondPath.path, audioPath: nil)

        let rows = try #require(project.snapshot["projectSequences"]?.value as? [[String: Any]])
        #expect(rows.count == 2)
        #expect(rows.first(where: { $0["displayName"] as? String == "First" })?["isActive"] as? Bool == false)
        #expect(rows.first(where: { $0["displayName"] as? String == "Second" })?["isActive"] as? Bool == true)
    }

    private func makeProject() throws -> ActiveProjectModel {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-project-sequence-store-\(UUID().uuidString)", isDirectory: true)
        let showFolder = root.appendingPathComponent("show", isDirectory: true)
        try FileManager.default.createDirectory(at: showFolder, withIntermediateDirectories: true)
        let service = LocalProjectService(projectsRootPath: root.appendingPathComponent("projects", isDirectory: true).path)
        return try service.createProject(
            draft: ProjectDraftModel(
                projectName: "Sequence Store \(UUID().uuidString.prefix(6))",
                showFolder: showFolder.path,
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
    }
}
