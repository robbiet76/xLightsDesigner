import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct ProjectServiceTests {
    @Test func createProjectStoresExpectedFileName() throws {
        let service = try makeService()
        let name = "Native Test Project \(UUID().uuidString.prefix(6))"
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
        let name = "Native Test Project \(UUID().uuidString.prefix(6))"
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

    @Test func createProjectCanMigrateMetadataFromExistingProject() throws {
        let service = try makeService()
        let sourceName = "Native Test Project \(UUID().uuidString.prefix(6))"
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

        let migratedName = "Native Test Project \(UUID().uuidString.prefix(6)) Migrated"
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

        #expect(migrated.projectName == migratedName)
        #expect(migrated.showFolder == "/tmp/new-show")
        #expect(FileManager.default.fileExists(atPath: migrated.projectFilePath))
        #expect(FileManager.default.fileExists(atPath: migratedMarker.path))
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
                    projectName: "Native Test Project \(UUID().uuidString.prefix(6)) Invalid",
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
        let name = "Native Test Project \(UUID().uuidString.prefix(6))"
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
