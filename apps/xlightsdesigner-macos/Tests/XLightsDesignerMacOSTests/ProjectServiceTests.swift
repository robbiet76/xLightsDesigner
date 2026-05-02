import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct ProjectServiceTests {
    @Test func createProjectStoresExpectedFileName() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        let project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        #expect(project.projectName == name)
        #expect(project.projectFilePath.hasSuffix("/\(name)/\(name).xdproj"))
    }

    @Test func openProjectAcceptsProjectFolder() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        let project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        let folder = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent().path
        let reopened = try service.openProject(filePath: folder)
        #expect(reopened.projectFilePath == project.projectFilePath)
        #expect(reopened.projectName == project.projectName)
    }

    @Test func createProjectMigratesOnlyDisplayProjectKnowledgeFromExistingProject() throws {
        let service = try makeService()
        let sourceName = "App Test Project \(UUID().uuidString.prefix(6))"
        let source = try service.createProject(
            draft: ProjectDraftModel(
                projectName: sourceName,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        let sourceDir = URL(fileURLWithPath: source.projectFilePath).deletingLastPathComponent()
        let markerFile = sourceDir.appendingPathComponent("diagnostics/marker.txt")
        try FileManager.default.createDirectory(at: markerFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("marker".utf8).write(to: markerFile)
        let metadataFile = sourceDir.appendingPathComponent("layout/layout-metadata.json")
        try FileManager.default.createDirectory(at: metadataFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        let metadataJSON = """
        {
          "version": 1,
          "tags": [
            { "id": "tag-1", "name": "Focal", "description": "Primary display target" }
          ],
          "targetTags": {
            "Tree": ["tag-1"]
          },
          "preferencesByTargetId": {
            "Tree": { "rolePreference": "focal" }
          },
          "visualHintDefinitions": []
        }
        """
        try Data(metadataJSON.utf8).write(to: metadataFile)
        let targetBehaviorFile = sourceDir.appendingPathComponent("display/target-behavior.json")
        try FileManager.default.createDirectory(at: targetBehaviorFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        let targetBehaviorJSON = """
        {
          "artifactType": "project_target_behavior_learning_v1",
          "artifactVersion": "1.0",
          "records": [
            { "recordId": "tbl1:test", "targetId": "Tree", "effectName": "On", "stats": { "sampleCount": 2 } }
          ]
        }
        """
        try Data(targetBehaviorJSON.utf8).write(to: targetBehaviorFile)

        let migratedName = "App Test Project \(UUID().uuidString.prefix(6)) Migrated"
        let migrated = try service.createProject(
            draft: ProjectDraftModel(
                projectName: migratedName,
                showFolder: "/tmp/new-show",
                mediaPath: "",
                migrateMetadata: true,
                migrationSourceProjectPath: sourceDir.path
            )
        )
        let migratedDir = URL(fileURLWithPath: migrated.projectFilePath).deletingLastPathComponent()
        let migratedMarker = migratedDir.appendingPathComponent("diagnostics/marker.txt")
        let migratedMetadata = migratedDir.appendingPathComponent("display/metadata.json")
        let migratedTargetBehavior = migratedDir.appendingPathComponent("display/target-behavior.json")

        #expect(migrated.projectName == migratedName)
        #expect(migrated.showFolder == "/tmp/new-show")
        #expect(FileManager.default.fileExists(atPath: migrated.projectFilePath))
        #expect(FileManager.default.fileExists(atPath: migratedMetadata.path))
        #expect(FileManager.default.fileExists(atPath: migratedTargetBehavior.path))
        #expect(!FileManager.default.fileExists(atPath: migratedMarker.path))
        #expect(try String(contentsOf: migratedMetadata).contains("\"Tree\""))
        #expect(try String(contentsOf: migratedTargetBehavior).contains("\"tbl1:test\""))
        #expect(URL(fileURLWithPath: migrated.projectFilePath).lastPathComponent == "\(migratedName).xdproj")
    }

    @Test func migrationSourceMustLiveUnderProjectsRoot() throws {
        let service = try makeService()
        let tempRoot = FileManager.default.temporaryDirectory.appendingPathComponent("xld-invalid-migration-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tempRoot, withIntermediateDirectories: true)
        let invalidSource = tempRoot.appendingPathComponent("Outside Project", isDirectory: true)
        try FileManager.default.createDirectory(at: invalidSource, withIntermediateDirectories: true)
        let invalidProjectFile = invalidSource.appendingPathComponent("Outside Project.xdproj")
        try Data("{}".utf8).write(to: invalidProjectFile)

        #expect(throws: ProjectServiceError.self) {
            try service.createProject(
                draft: ProjectDraftModel(
                    projectName: "App Test Project \(UUID().uuidString.prefix(6)) Invalid",
                    showFolder: "/tmp/new-show",
                    mediaPath: "",
                    migrateMetadata: true,
                    migrationSourceProjectPath: invalidSource.path
                )
            )
        }
    }

    @Test func saveProjectPersistsProjectBriefInSnapshot() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        var project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )

        project.snapshot["projectBrief"] = AnyCodable([
            "document": "Warm neighborhood show with a strong central focal area that feels welcoming and cohesive across songs, with the tree and character zone staying visually connected.",
            "updatedAt": "2026-04-09T00:00:00Z"
        ])

        let saved = try service.saveProject(project)
        let reopened = try service.openProject(filePath: saved.projectFilePath)
        let brief = reopened.snapshot["projectBrief"]?.value as? [String: Any]

        #expect(brief?["document"] as? String == "Warm neighborhood show with a strong central focal area that feels welcoming and cohesive across songs, with the tree and character zone staying visually connected.")
    }

    private func makeService() throws -> LocalProjectService {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-project-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return LocalProjectService(projectsRootPath: root.path)
    }
}
