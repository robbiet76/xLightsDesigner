import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct DisplayServiceArtifactTests {
    @Test func submodelDecoderAcceptsOwnedApiParentNamePayload() throws {
        let data = """
        [
          {
            "fullName": "Singing Bulb 1/@Mouth1",
            "name": "@Mouth1",
            "parentName": "Singing Bulb 1",
            "type": "ranges",
            "layoutGroup": "Default",
            "startChannel": 89893,
            "endChannel": 89916
          },
          {
            "fullName": "Singing Bulb 1/@Eye-Left",
            "name": "@Eye-Left",
            "parentName": "Singing Bulb 1",
            "type": "ranges",
            "layoutGroup": "Default",
            "startChannel": 89815,
            "endChannel": 89844
          }
        ]
        """.data(using: .utf8)!

        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: data)
        let grouped = groupSubmodelsByParent(submodels)
        let singingBulbSubmodels = grouped["Singing Bulb 1"] ?? []

        #expect(singingBulbSubmodels.count == 2)
        #expect(singingBulbSubmodels.map(\.id).contains("Singing Bulb 1/@Mouth1"))
        #expect(singingBulbSubmodels.map(\.parentId).allSatisfy { $0 == "Singing Bulb 1" })
        #expect(singingBulbSubmodels.map(\.name) == ["@Eye-Left", "@Mouth1"])
    }

    @Test func customModelInferenceUsesFaceSubmodels() throws {
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          { "fullName": "Singing Bulb 1/@Eye-Left", "name": "@Eye-Left", "parentName": "Singing Bulb 1" },
          { "fullName": "Singing Bulb 1/@Mouth1", "name": "@Mouth1", "parentName": "Singing Bulb 1" }
        ]
        """.data(using: .utf8)!)

        let inference = inferCustomModelStructure(row: displayArtifactRow(name: "Singing Bulb 1", width: 56, height: 123), submodels: submodels)

        #expect(inference.profile == "custom_face_like")
        #expect(inference.traits.contains("face_submodels"))
        #expect(inference.traits.contains("custom_face_like"))
        #expect(inference.trainingBuckets.isEmpty)
    }

    @Test func customModelInferenceUsesVendorNameHints() {
        let cane = inferCustomModelStructure(row: displayArtifactRow(name: "Boscoyo ChromaCane 1", width: 42, height: 90), submodels: [])
        let spinner = inferCustomModelStructure(row: displayArtifactRow(name: "Spinner", width: 85, height: 85), submodels: [])

        #expect(cane.profile == "custom_linear_like")
        #expect(cane.trainingBuckets.contains("cane"))
        #expect(spinner.profile == "custom_radial_like")
        #expect(spinner.trainingBuckets.contains("spinner"))
    }

    @Test func modelIndexArtifactEmbedsCustomStructureAndSubmodels() throws {
        let row = displayArtifactRow(name: "Singing Bulb 1", width: 56, height: 123, submodelCount: 2)
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          { "fullName": "Singing Bulb 1/@Eye-Left", "name": "@Eye-Left", "parentName": "Singing Bulb 1" },
          { "fullName": "Singing Bulb 1/@Mouth1", "name": "@Mouth1", "parentName": "Singing Bulb 1" }
        ]
        """.data(using: .utf8)!)
        let artifactData = try encodeDisplayModelIndexArtifact(
            rows: [row],
            submodelsByParent: groupSubmodelsByParent(submodels),
            sourceSummary: "test",
            createdAt: "2026-05-01T00:00:00Z"
        )
        let artifact = try JSONSerialization.jsonObject(with: artifactData) as? [String: Any]
        let records = artifact?["records"] as? [[String: Any]]
        let structure = records?.first?["structure"] as? [String: Any]
        let customStructure = structure?["customStructure"] as? [String: Any]
        let customSubmodels = customStructure?["submodels"] as? [String: Any]

        #expect(artifact?["artifactType"] as? String == "target_metadata_index_v1")
        #expect(records?.first?["targetId"] as? String == "Singing Bulb 1")
        #expect(customStructure?["profile"] as? String == "custom_face_like")
        #expect((customSubmodels?["capturedCount"] as? Int) == 2)
        #expect(structure?["customModel"] == nil)
    }
}

private func displayArtifactRow(name: String, width: Double, height: Double, submodelCount: Int = 0) -> DisplayLayoutRowModel {
    DisplayLayoutRowModel(
        id: name,
        targetName: name,
        targetType: "Custom",
        nodeCount: 100,
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        width: width,
        height: height,
        depth: 0,
        labelDefinitions: [],
        submodelCount: submodelCount,
        directGroupMembers: [],
        activeGroupMembers: [],
        flattenedGroupMembers: [],
        flattenedAllGroupMembers: []
    )
}
