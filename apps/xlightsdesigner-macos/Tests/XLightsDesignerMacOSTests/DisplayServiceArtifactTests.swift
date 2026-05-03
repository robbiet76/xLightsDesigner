import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct DisplayServiceArtifactTests {
    @Test func displayModelIndexStoreDecodesSubmodelIdentityAndStructure() throws {
        let data = """
        {
          "artifactType": "display_model_index_v1",
          "records": [
            {
              "targetId": "Custom Target A/@Mouth1",
              "targetKind": "submodel",
              "identity": {
                "displayName": "Custom Target A / @Mouth1",
                "fingerprint": "tmf1:abcd1234",
                "fingerprintVersion": "target-metadata-fingerprint-v1",
                "parentId": "Custom Target A",
                "parentName": "Custom Target A"
              },
              "structure": {
                "submodelMetadata": {
                  "parentId": "Custom Target A",
                  "parentName": "Custom Target A",
                  "nodeCoverage": { "nodeCount": 8, "parentNodeCount": 143, "ratio": 0.0559 },
                  "siblingIds": ["Custom Target A/@Eye"],
                  "overlappingSiblingIds": [],
                  "structureHints": ["feature_mouth"]
                }
              }
            }
          ]
        }
        """.data(using: .utf8)!

        let document = try JSONDecoder().decode(DisplayModelIndexDocument.self, from: data)
        let record = try #require(document.records.first)

        #expect(record.identity?.parentId == "Custom Target A")
        #expect(record.identity?.parentName == "Custom Target A")
        #expect(record.structure?.submodelMetadata?.nodeCoverage?.nodeCount == 8)
        #expect(record.structure?.submodelMetadata?.structureHints == ["feature_mouth"])
    }

    @Test func submodelDecoderAcceptsOwnedApiParentNamePayload() throws {
        let data = """
        [
          {
            "fullName": "Custom Target A/@Mouth1",
            "name": "@Mouth1",
            "parentName": "Custom Target A",
            "type": "ranges",
            "lines": "1-8",
            "nodeCount": 8,
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
        #expect(targetSubmodels.first { $0.name == "@Mouth1" }?.nodeCount == 8)
        #expect(targetSubmodels.first { $0.name == "@Mouth1" }?.lines == "1-8")
    }

    @Test func customModelInferenceCapturesSubmodelsWithoutSemanticNameHints() throws {
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          { "fullName": "Custom Target A/@Eye-Left", "name": "@Eye-Left", "parentName": "Custom Target A" },
          { "fullName": "Custom Target A/@Mouth1", "name": "@Mouth1", "parentName": "Custom Target A" }
        ]
        """.data(using: .utf8)!)

        let inference = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target A", width: 56, height: 123), submodels: submodels)

        #expect(inference.profile == "custom_linear_like")
        #expect(!inference.traits.contains("face_submodels"))
        #expect(!inference.traits.contains("custom_face_like"))
    }

    @Test func customModelInferenceUsesGeometryWithoutNameHints() {
        let linear = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target Linear", width: 42, height: 90), submodels: [])
        let nameOnlyA = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target Round A", width: 85, height: 85), submodels: [])
        let nameOnlyB = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target Round B", width: 85, height: 85), submodels: [])

        #expect(linear.profile == "custom_linear_like")
        #expect(!linear.traits.contains { $0.hasPrefix("name_hint_") })
        #expect(nameOnlyA.profile == "custom_model")
        #expect(nameOnlyB.profile == "custom_model")
    }

    @Test func customModelInferenceDoesNotUseRadialNameBuckets() throws {
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          { "fullName": "Custom Target B/Spoke 1", "name": "Spoke 1", "parentName": "Custom Target B" },
          { "fullName": "Custom Target B/Spoke 2", "name": "Spoke 2", "parentName": "Custom Target B" },
          { "fullName": "Custom Target B/Spoke 3", "name": "Spoke 3", "parentName": "Custom Target B" },
          { "fullName": "Custom Target B/Spoke 4", "name": "Spoke 4", "parentName": "Custom Target B" }
        ]
        """.data(using: .utf8)!)
        let inference = inferCustomModelStructure(row: displayArtifactRow(name: "Custom Target B", width: 85, height: 85), submodels: submodels)

        #expect(inference.profile == "custom_model")
        #expect(!inference.traits.contains("custom_radial_like"))
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
        let modelRecord = records?.first { $0["targetId"] as? String == "Custom Target A" }
        let submodelRecord = records?.first { $0["targetId"] as? String == "Custom Target A/@Mouth1" }
        let structure = modelRecord?["structure"] as? [String: Any]
        let customStructure = structure?["customStructure"] as? [String: Any]
        let customSubmodels = customStructure?["submodels"] as? [String: Any]
        let submodelIdentity = submodelRecord?["identity"] as? [String: Any]
        let submodelStructure = submodelRecord?["structure"] as? [String: Any]
        let submodelMetadata = submodelStructure?["submodelMetadata"] as? [String: Any]
        let modelIdentity = modelRecord?["identity"] as? [String: Any]

        #expect(artifact?["artifactType"] as? String == "target_metadata_index_v1")
        #expect((artifact?["summary"] as? [String: Any])?["targetCount"] as? Int == 3)
        #expect((artifact?["summary"] as? [String: Any])?["submodelCount"] as? Int == 2)
        #expect(modelRecord?["targetKind"] as? String == "model")
        #expect(modelIdentity?["rawType"] as? String == "Custom")
        #expect(modelIdentity?["canonicalType"] as? String == "custom")
        #expect(submodelRecord?["targetKind"] as? String == "submodel")
        #expect(customStructure?["profile"] as? String == "custom_linear_like")
        #expect((customSubmodels?["capturedCount"] as? Int) == 2)
        #expect(structure?["customModel"] == nil)
        #expect(submodelIdentity?["canonicalType"] as? String == "submodel")
        #expect((submodelIdentity?["fingerprint"] as? String)?.hasPrefix("tmf1:") == true)
        #expect(submodelIdentity?["parentId"] as? String == "Custom Target A")
        #expect(submodelIdentity?["parentName"] as? String == "Custom Target A")
        #expect(submodelMetadata?["parentId"] as? String == "Custom Target A")
        #expect((submodelMetadata?["nodeCoverage"] as? [String: Any])?["nodeCount"] as? Int == 0)
    }

    @Test func modelIndexArtifactIncludesSourceShowFolder() throws {
        let artifactData = try encodeDisplayModelIndexArtifact(
            rows: [displayArtifactRow(name: "Tree", targetType: "Tree", width: 50, height: 100)],
            submodelsByParent: [:],
            sourceSummary: "test",
            sourceShowFolder: "/tmp/show",
            createdAt: "2026-05-01T00:00:00Z"
        )
        let artifact = try JSONSerialization.jsonObject(with: artifactData) as? [String: Any]
        let source = artifact?["source"] as? [String: Any]

        #expect(source?["source"] as? String == "test")
        #expect(source?["showFolder"] as? String == "/tmp/show")
    }

    @Test func reconciliationArtifactRetainsOrphanedDisplayMetadata() throws {
        let row = displayArtifactRow(name: "Tree", targetType: "Tree", width: 50, height: 100)
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          { "fullName": "Tree/Top", "name": "Top", "parentName": "Tree" }
        ]
        """.data(using: .utf8)!)
        var metadata = PersistedDisplayMetadataDocument()
        metadata.targetTags = [
            "Tree": ["tag-current"],
            "Missing Arch": ["tag-old"]
        ]
        metadata.preferencesByTargetId = [
            "Tree/Top": PersistedDisplayTargetPreference(rolePreference: "accent", semanticHints: nil, submodelHints: nil, effectAvoidances: nil),
            "Missing Arch": PersistedDisplayTargetPreference(rolePreference: "background", semanticHints: nil, submodelHints: nil, effectAvoidances: nil)
        ]

        let artifactData = try encodeDisplayReconciliationArtifact(
            rows: [row],
            submodelsByParent: groupSubmodelsByParent(submodels),
            metadataDocument: metadata,
            sourceSummary: "test",
            sourceShowFolder: "/tmp/show",
            createdAt: "2026-05-01T00:00:00Z"
        )
        let artifact = try JSONSerialization.jsonObject(with: artifactData) as? [String: Any]
        let summary = artifact?["summary"] as? [String: Any]
        let records = artifact?["records"] as? [[String: Any]]
        let tree = records?.first { $0["targetId"] as? String == "Tree" }
        let top = records?.first { $0["targetId"] as? String == "Tree/Top" }
        let missing = records?.first { $0["targetId"] as? String == "Missing Arch" }

        #expect(artifact?["artifactType"] as? String == "display_reconciliation_v1")
        #expect(summary?["currentTargetCount"] as? Int == 2)
        #expect(summary?["metadataTargetCount"] as? Int == 3)
        #expect(summary?["activeMetadataCount"] as? Int == 2)
        #expect(summary?["retainedOrphanedMetadataCount"] as? Int == 1)
        #expect(tree?["status"] as? String == "active")
        #expect(top?["status"] as? String == "active")
        #expect(missing?["status"] as? String == "retained-orphaned")
        #expect(missing?["matchedBy"] as? String == "retained-project-metadata")
        #expect(missing?["confidence"] as? String == "none")
        #expect(missing?["needsReview"] as? Bool == false)
    }

    @Test func reconciliationArtifactMatchesRenamedMetadataByFingerprint() throws {
        let renamedRow = displayArtifactRow(name: "RenamedFace", targetType: "Custom", width: 50, height: 100)
        let currentFingerprint = try #require(currentTargetFingerprints(rows: [renamedRow], submodelsByParent: [:])["RenamedFace"])
        let previousIndex = DisplayModelIndexDocument(
            artifactType: "target_metadata_index_v1",
            records: [
                PersistedDisplayModelIndexRecord(
                    targetId: "OldFace",
                    targetKind: "model",
                    identity: PersistedDisplayModelIndexIdentity(
                        fingerprint: currentFingerprint,
                        fingerprintVersion: "target-metadata-fingerprint-v1",
                        displayName: "Old Face",
                        parentId: nil,
                        parentName: nil
                    ),
                    structure: nil
                )
            ]
        )
        var metadata = PersistedDisplayMetadataDocument()
        metadata.targetTags = ["OldFace": ["tag-face"]]

        let artifactData = try encodeDisplayReconciliationArtifact(
            rows: [renamedRow],
            submodelsByParent: [:],
            metadataDocument: metadata,
            previousModelIndex: previousIndex,
            sourceSummary: "test",
            createdAt: "2026-05-01T00:00:00Z"
        )
        let artifact = try JSONSerialization.jsonObject(with: artifactData) as? [String: Any]
        let summary = artifact?["summary"] as? [String: Any]
        let records = artifact?["records"] as? [[String: Any]]
        let oldFace = records?.first { $0["targetId"] as? String == "OldFace" }

        #expect(summary?["activeMetadataCount"] as? Int == 1)
        #expect(summary?["retainedOrphanedMetadataCount"] as? Int == 0)
        #expect(summary?["fingerprintMatchCount"] as? Int == 1)
        #expect(summary?["needsReviewCount"] as? Int == 0)
        #expect(oldFace?["status"] as? String == "active")
        #expect(oldFace?["matchedBy"] as? String == "fingerprint")
        #expect(oldFace?["confidence"] as? String == "high")
        #expect(oldFace?["needsReview"] as? Bool == false)
        #expect(oldFace?["currentTargetId"] as? String == "RenamedFace")
        #expect(oldFace?["previousFingerprint"] as? String == currentFingerprint)
    }

    @Test func reconciliationArtifactMarksDuplicateFingerprintMatchesForReview() throws {
        let rowA = displayArtifactRow(name: "Duplicate Target A", targetType: "Single Line", width: 50, height: 10)
        let rowB = displayArtifactRow(name: "Duplicate Target B", targetType: "Single Line", width: 50, height: 10)
        let duplicateFingerprint = try #require(currentTargetFingerprints(rows: [rowA], submodelsByParent: [:])["Duplicate Target A"])
        let previousIndex = DisplayModelIndexDocument(
            artifactType: "target_metadata_index_v1",
            records: [
                PersistedDisplayModelIndexRecord(
                    targetId: "Old Duplicate Target",
                    targetKind: "model",
                    identity: PersistedDisplayModelIndexIdentity(
                        fingerprint: duplicateFingerprint,
                        fingerprintVersion: "target-metadata-fingerprint-v1",
                        displayName: "Old Duplicate Target",
                        parentId: nil,
                        parentName: nil
                    ),
                    structure: nil
                )
            ]
        )
        var metadata = PersistedDisplayMetadataDocument()
        metadata.targetTags = ["Old Duplicate Target": ["tag-duplicate"]]

        let artifactData = try encodeDisplayReconciliationArtifact(
            rows: [rowA, rowB],
            submodelsByParent: [:],
            metadataDocument: metadata,
            previousModelIndex: previousIndex,
            sourceSummary: "test",
            createdAt: "2026-05-01T00:00:00Z"
        )
        let artifact = try JSONSerialization.jsonObject(with: artifactData) as? [String: Any]
        let summary = artifact?["summary"] as? [String: Any]
        let records = artifact?["records"] as? [[String: Any]]
        let old = records?.first { $0["targetId"] as? String == "Old Duplicate Target" }

        #expect(summary?["activeMetadataCount"] as? Int == 0)
        #expect(summary?["retainedOrphanedMetadataCount"] as? Int == 0)
        #expect(summary?["needsReviewCount"] as? Int == 1)
        #expect(summary?["ambiguousFingerprintCount"] as? Int == 1)
        #expect(old?["status"] as? String == "needs-review")
        #expect(old?["matchedBy"] as? String == "ambiguous-fingerprint")
        #expect(old?["confidence"] as? String == "ambiguous")
        #expect(old?["needsReview"] as? Bool == true)
        #expect(old?["candidateTargetIds"] as? [String] == ["Duplicate Target A", "Duplicate Target B"])
    }

    @Test func modelIndexArtifactEmbedsSharedSubmodelRelationshipsForBuiltInModels() throws {
        let row = displayArtifactRow(name: "Built In Target", targetType: "Tree", width: 80, height: 160, submodelCount: 3)
        let submodels = try JSONDecoder().decode([XLightsSubmodel].self, from: """
        [
          {
            "fullName": "Built In Target/Left Segment",
            "name": "Left Segment",
            "parentName": "Built In Target",
            "lines": "1-4",
            "nodeCount": 4
          },
          {
            "fullName": "Built In Target/Right Segment",
            "name": "Right Segment",
            "parentName": "Built In Target",
            "lines": "3-6",
            "nodeCount": 4
          },
          {
            "fullName": "Built In Target/Outer Ring",
            "name": "Outer Ring",
            "parentName": "Built In Target",
            "lines": "9-10",
            "nodeCount": 2
          }
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
        let modelRecord = records?.first { $0["targetId"] as? String == "Built In Target" }
        let submodelRecord = records?.first { $0["targetId"] as? String == "Built In Target/Left Segment" }
        let structure = modelRecord?["structure"] as? [String: Any]
        let submodelSummaries = structure?["submodels"] as? [[String: Any]]
        let left = submodelSummaries?.first { $0["name"] as? String == "Left Segment" }
        let coverage = left?["nodeCoverage"] as? [String: Any]
        let hints = left?["structureHints"] as? [String]
        let submodelIdentity = submodelRecord?["identity"] as? [String: Any]
        let submodelStructure = submodelRecord?["structure"] as? [String: Any]
        let submodelMetadata = submodelStructure?["submodelMetadata"] as? [String: Any]
        let modelIdentity = modelRecord?["identity"] as? [String: Any]

        #expect((artifact?["summary"] as? [String: Any])?["targetCount"] as? Int == 4)
        #expect(modelRecord?["targetKind"] as? String == "model")
        #expect(modelIdentity?["rawType"] as? String == "Tree")
        #expect(modelIdentity?["canonicalType"] as? String == "tree")
        #expect(submodelRecord?["targetKind"] as? String == "submodel")
        #expect(structure?["customStructure"] == nil)
        #expect(submodelIdentity?["parentId"] as? String == "Built In Target")
        #expect(submodelMetadata?["parentId"] as? String == "Built In Target")
        #expect((submodelMetadata?["nodeCoverage"] as? [String: Any])?["nodeCount"] as? Int == 4)
        #expect(left?["siblingCount"] as? Int == 2)
        #expect(left?["overlapsSibling"] as? Bool == true)
        #expect(left?["overlappingSiblingIds"] as? [String] == ["Built In Target/Right Segment"])
        #expect(coverage?["nodeCount"] as? Int == 4)
        #expect(coverage?["parentNodeCount"] as? Int == 100)
        #expect(coverage?["ratio"] as? Double == 0.04)
        #expect(hints == ["range_defined_region", "node_scoped_region", "partial_region", "sibling_region", "overlapping_region"])
    }
}

private func displayArtifactRow(
    name: String,
    targetType: String = "Custom",
    width: Double,
    height: Double,
    submodelCount: Int = 0
) -> DisplayLayoutRowModel {
    DisplayLayoutRowModel(
        id: name,
        targetName: name,
        targetType: targetType,
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
