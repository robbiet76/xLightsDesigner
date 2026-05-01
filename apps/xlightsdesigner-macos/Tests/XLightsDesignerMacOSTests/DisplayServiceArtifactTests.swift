import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct DisplayServiceArtifactTests {
    @Test func submodelDecoderAcceptsOwnedApiParentNamePayload() throws {
        let data = """
        [
          {
            "fullName": "Custom Target A/@Mouth1",
            "name": "@Mouth1",
            "parentName": "Custom Target A",
            "type": "ranges",
            "layoutGroup": "Default",
            "startChannel": 89893,
            "endChannel": 89916
          },
          {
            "fullName": "Custom Target A/@Eye-Left",
            "name": "@Eye-Left",
            "parentName": "Custom Target A",
            "type": "ranges",
            "layoutGroup": "Default",
            "startChannel": 89815,
            "endChannel": 89844
          }
        ]
        """.data(using: .utf8)!

        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: data)
        let grouped = groupSubmodelsByParent(submodels)
        let targetSubmodels = grouped["Custom Target A"] ?? []

        #expect(targetSubmodels.count == 2)
        #expect(targetSubmodels.map(\.id).contains("Custom Target A/@Mouth1"))
        #expect(targetSubmodels.map(\.parentId).allSatisfy { $0 == "Custom Target A" })
        #expect(targetSubmodels.map(\.name) == ["@Eye-Left", "@Mouth1"])
    }

    @Test func customModelInferenceUsesFaceSubmodels() throws {
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          { "fullName": "Custom Target A/@Eye-Left", "name": "@Eye-Left", "parentName": "Custom Target A" },
          { "fullName": "Custom Target A/@Mouth1", "name": "@Mouth1", "parentName": "Custom Target A" }
        ]
        """.data(using: .utf8)!)

        let inference = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target A", width: 56, height: 123), submodels: submodels)

        #expect(inference.profile == "custom_face_like")
        #expect(inference.traits.contains("face_submodels"))
        #expect(inference.traits.contains("custom_face_like"))
        #expect(inference.trainingBuckets.isEmpty)
    }

    @Test func customModelInferenceUsesGeometryWithoutNameHints() {
        let linear = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target Linear", width: 42, height: 90), submodels: [])
        let nameOnlyA = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target Round A", width: 85, height: 85), submodels: [])
        let nameOnlyB = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target Round B", width: 85, height: 85), submodels: [])

        #expect(linear.profile == "custom_linear_like")
        #expect(linear.trainingBuckets == ["single_line"])
        #expect(!linear.traits.contains { $0.hasPrefix("name_hint_") })
        #expect(nameOnlyA.profile == "custom_model")
        #expect(nameOnlyA.trainingBuckets.isEmpty)
        #expect(nameOnlyB.profile == "custom_model")
        #expect(nameOnlyB.trainingBuckets.isEmpty)
    }

    @Test func customModelInferenceUsesRadialSubmodelsWithoutStarBucket() throws {
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          { "fullName": "Custom Target B/Spoke 1", "name": "Spoke 1", "parentName": "Custom Target B" },
          { "fullName": "Custom Target B/Spoke 2", "name": "Spoke 2", "parentName": "Custom Target B" },
          { "fullName": "Custom Target B/Spoke 3", "name": "Spoke 3", "parentName": "Custom Target B" },
          { "fullName": "Custom Target B/Spoke 4", "name": "Spoke 4", "parentName": "Custom Target B" }
        ]
        """.data(using: .utf8)!)
        let inference = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target B", width: 85, height: 85), submodels: submodels)

        #expect(inference.profile == "custom_radial_like")
        #expect(inference.trainingBuckets == ["spinner"])
    }

    @Test func modelIndexArtifactEmbedsCustomStructureAndSubmodels() throws {
        let row = displayArtifactRow(name: "Custom Target A", width: 56, height: 123, submodelCount: 2)
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          { "fullName": "Custom Target A/@Eye-Left", "name": "@Eye-Left", "parentName": "Custom Target A" },
          { "fullName": "Custom Target A/@Mouth1", "name": "@Mouth1", "parentName": "Custom Target A" }
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
        #expect(records?.first?["targetId"] as? String == "Custom Target A")
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
