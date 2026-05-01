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
}
