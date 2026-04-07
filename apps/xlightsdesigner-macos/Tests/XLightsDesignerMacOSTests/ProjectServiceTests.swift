import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct ProjectServiceTests {
    @Test func createProjectStoresExpectedFileName() throws {
        let service = LocalProjectService()
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
        let service = LocalProjectService()
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
        let service = LocalProjectService()
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
        let service = LocalProjectService()
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
}
