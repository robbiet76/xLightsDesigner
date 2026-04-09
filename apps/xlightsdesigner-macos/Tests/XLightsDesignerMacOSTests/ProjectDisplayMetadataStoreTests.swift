import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct ProjectDisplayMetadataStoreTests {
    @Test func storeCreatesAndAssignsTagsToProjectTargets() throws {
        let project = try makeProject(name: "DisplayMetadataStoreA")
        let store = LocalDisplayMetadataStore()

        try store.createOrAssignTag(project: project, targetIDs: ["Tree", "Star"], tagName: "Focal", description: "Primary visual anchor")
        let document = try store.load(for: project)

        #expect(document.tags.count == 1)
        #expect(document.tags.first?.name == "Focal")
        #expect(Set(document.targetTags["Tree"] ?? []) == Set([document.tags[0].id]))
        #expect(Set(document.targetTags["Star"] ?? []) == Set([document.tags[0].id]))
    }

    @Test func storeRenamesTagWithoutBreakingAssignments() throws {
        let project = try makeProject(name: "DisplayMetadataStoreB")
        let store = LocalDisplayMetadataStore()

        try store.createOrAssignTag(project: project, targetIDs: ["Tree"], tagName: "Focal", description: "")
        let original = try store.load(for: project)
        let tagID = try #require(original.tags.first?.id)

        try store.updateTagDefinition(project: project, tagID: tagID, name: "Primary Focus", description: "Updated", colorName: "blue")
        let updated = try store.load(for: project)

        #expect(updated.tags.first?.name == "Primary Focus")
        #expect(updated.tags.first?.colorName == "blue")
        #expect(updated.targetTags["Tree"] == [tagID])
    }

    @Test func storeDeletesTagAndRemovesAssignments() throws {
        let project = try makeProject(name: "DisplayMetadataStoreC")
        let store = LocalDisplayMetadataStore()

        try store.createOrAssignTag(project: project, targetIDs: ["Tree"], tagName: "Focal", description: "")
        let original = try store.load(for: project)
        let tagID = try #require(original.tags.first?.id)

        try store.deleteTagDefinition(project: project, tagID: tagID)
        let updated = try store.load(for: project)

        #expect(updated.tags.isEmpty)
        #expect(updated.targetTags["Tree"] == nil)
    }

    private func makeProject(name: String) throws -> ActiveProjectModel {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-layout-tag-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let service = LocalProjectService(projectsRootPath: root.path)
        return try service.createProject(
            draft: ProjectDraftModel(
                projectName: "\(name)-\(UUID().uuidString.prefix(6))",
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
    }
}
