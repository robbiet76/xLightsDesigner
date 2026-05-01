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
}

private func displayArtifactRow(name: String, width: Double, height: Double) -> DisplayLayoutRowModel {
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
        submodelCount: 0,
        directGroupMembers: [],
        activeGroupMembers: [],
        flattenedGroupMembers: [],
        flattenedAllGroupMembers: []
    )
}
