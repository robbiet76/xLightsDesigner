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

    @Test func storePreservesTargetPreferencesAndVisualHintDefinitions() throws {
        let project = try makeProject(name: "DisplayMetadataStoreD")
        let metadataURL = URL(fileURLWithPath: project.projectFilePath)
            .deletingLastPathComponent()
            .appendingPathComponent("display/metadata.json")
        try FileManager.default.createDirectory(at: metadataURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try """
        {
          "version": 1,
          "tags": [
            {
              "id": "tag-focal",
              "name": "Focal",
              "description": "Primary visual anchor"
            }
          ],
          "targetTags": {
            "Tree": ["tag-focal"]
          },
          "preferencesByTargetId": {
            "Tree": {
              "rolePreference": "lead",
              "semanticHints": ["Sparkle"],
              "effectAvoidances": ["Bars"]
            }
          },
          "visualHintDefinitions": [
            {
              "name": "Sparkle",
              "status": "defined",
              "semanticClass": "texture",
              "behavioralIntent": "Use readable sparkle texture.",
              "behavioralTags": ["twinkle"]
            }
          ]
        }
        """.data(using: .utf8)!.write(to: metadataURL)
        let store = LocalDisplayMetadataStore()

        try store.createOrAssignTag(project: project, targetIDs: ["Star"], tagName: "Accent", description: "Secondary read")
        let updated = try store.load(for: project)

        #expect(updated.preferencesByTargetId["Tree"]?.rolePreference == "lead")
        #expect(updated.preferencesByTargetId["Tree"]?.semanticHints == ["Sparkle"])
        #expect(updated.preferencesByTargetId["Tree"]?.effectAvoidances == ["Bars"])
        #expect(updated.visualHintDefinitions.first?.name == "Sparkle")
        #expect(updated.visualHintDefinitions.first?.behavioralIntent == "Use readable sparkle texture.")
    }

    @Test func storeLoadsMetadataDocumentsMissingIntentExtensions() throws {
        let project = try makeProject(name: "DisplayMetadataStoreMigration")
        let metadataURL = URL(fileURLWithPath: project.projectFilePath)
            .deletingLastPathComponent()
            .appendingPathComponent("layout/layout-metadata.json")
        try FileManager.default.createDirectory(at: metadataURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try """
        {
          "version": 1,
          "tags": [
            {
              "id": "tag-focal",
              "name": "Focal",
              "description": "Primary visual anchor"
            }
          ],
          "targetTags": {
            "Tree": ["tag-focal"]
          }
        }
        """.data(using: .utf8)!.write(to: metadataURL)
        let store = LocalDisplayMetadataStore()

        try store.updateTargetPreference(
            project: project,
            targetIDs: ["Tree"],
            rolePreference: "lead",
            semanticHints: ["centerpiece"],
            effectAvoidances: ["Bars"]
        )
        let updated = try store.load(for: project)

        #expect(updated.tags.first?.name == "Focal")
        #expect(updated.targetTags["Tree"] == ["tag-focal"])
        #expect(updated.preferencesByTargetId["Tree"]?.rolePreference == "lead")
        #expect(updated.visualHintDefinitions.isEmpty)
    }

    @Test func storeWritesCanonicalDisplayMetadataPath() throws {
        let project = try makeProject(name: "DisplayMetadataStoreCanonical")
        let store = LocalDisplayMetadataStore()

        try store.createOrAssignTag(project: project, targetIDs: ["Tree"], tagName: "Focal", description: "")

        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        let canonicalURL = projectDir.appendingPathComponent("display/metadata.json")
        let legacyURL = projectDir.appendingPathComponent("layout/layout-metadata.json")
        #expect(FileManager.default.fileExists(atPath: canonicalURL.path))
        #expect(!FileManager.default.fileExists(atPath: legacyURL.path))
    }

    @Test func storeWritesRefreshArtifactsToCanonicalDisplayPaths() throws {
        let project = try makeProject(name: "DisplayMetadataStoreArtifacts")
        let store = LocalDisplayMetadataStore()

        try store.writeRefreshArtifacts(
            project: project,
            targetMetadata: #"{"artifactType":"target_metadata_index_v1"}"#.data(using: .utf8),
            customModelCatalog: #"{"artifactType":"custom_model_structure_catalog_v1"}"#.data(using: .utf8),
            reconciliation: #"{"status":"reconciled"}"#.data(using: .utf8)
        )

        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        let modelIndexURL = projectDir.appendingPathComponent("display/model-index.json")
        let customModelsURL = projectDir.appendingPathComponent("display/custom-models.json")
        let reconciliationURL = projectDir.appendingPathComponent("display/reconciliation.json")

        #expect(FileManager.default.fileExists(atPath: modelIndexURL.path))
        #expect(FileManager.default.fileExists(atPath: customModelsURL.path))
        #expect(FileManager.default.fileExists(atPath: reconciliationURL.path))
        #expect(try String(contentsOf: modelIndexURL).contains("target_metadata_index_v1"))
        #expect(try String(contentsOf: customModelsURL).contains("custom_model_structure_catalog_v1"))
        #expect(try String(contentsOf: reconciliationURL).contains("reconciled"))
    }

    @Test func storeUpdatesTargetPreferences() throws {
        let project = try makeProject(name: "DisplayMetadataStoreE")
        let store = LocalDisplayMetadataStore()

        try store.updateTargetPreference(
            project: project,
            targetIDs: ["Tree", "Tree", "Star"],
            rolePreference: " lead ",
            semanticHints: [" sparkle ", "Sparkle", "centerpiece"],
            effectAvoidances: [" Bars "]
        )
        let updated = try store.load(for: project)

        #expect(updated.preferencesByTargetId["Tree"]?.rolePreference == "lead")
        #expect(updated.preferencesByTargetId["Tree"]?.semanticHints == ["sparkle", "centerpiece"])
        #expect(updated.preferencesByTargetId["Tree"]?.effectAvoidances == ["Bars"])
        #expect(updated.preferencesByTargetId["Star"]?.rolePreference == "lead")

        try store.updateTargetPreference(project: project, targetIDs: ["Tree"], rolePreference: nil, semanticHints: [], effectAvoidances: [])
        let cleared = try store.load(for: project)

        #expect(cleared.preferencesByTargetId["Tree"] == nil)
        #expect(cleared.preferencesByTargetId["Star"]?.rolePreference == "lead")
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
