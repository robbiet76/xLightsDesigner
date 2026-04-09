import Foundation

struct XLightsDerivedFamilyModel: Hashable, Sendable {
    let name: String
    let type: String
    let count: Int
    let examples: [String]
    let reason: String
    let confidence: String
    let totalNodeCount: Int

    var payload: [String: String] {
        [
            "name": name,
            "type": type,
            "count": String(count),
            "examples": examples.joined(separator: ", "),
            "reason": reason,
            "confidence": confidence,
            "totalNodeCount": String(totalNodeCount)
        ]
    }
}

struct XLightsDerivedTypeBreakdownModel: Hashable, Sendable {
    let type: String
    let count: Int

    var payload: [String: String] {
        ["type": type, "count": String(count)]
    }
}

struct XLightsDerivedModelSample: Hashable, Sendable {
    let name: String
    let type: String
    let nodeCount: Int
    let positionX: Double
    let positionY: Double
    let positionZ: Double
    let width: Double
    let height: Double
    let depth: Double
    let submodelCount: Int
    let horizontalZone: String
    let depthZone: String
    let visualWeight: String
    let uniqueness: String
    let symmetryPeers: [String]

    var payload: [String: String] {
        [
            "name": name,
            "type": type,
            "nodeCount": String(nodeCount),
            "positionX": String(format: "%.2f", positionX),
            "positionY": String(format: "%.2f", positionY),
            "positionZ": String(format: "%.2f", positionZ),
            "width": String(format: "%.2f", width),
            "height": String(format: "%.2f", height),
            "depth": String(format: "%.2f", depth),
            "submodelCount": String(submodelCount),
            "horizontalZone": horizontalZone,
            "depthZone": depthZone,
            "visualWeight": visualWeight,
            "uniqueness": uniqueness,
            "symmetryPeers": symmetryPeers.joined(separator: ", ")
        ]
    }
}

struct XLightsDerivedGroupMembershipModel: Hashable, Sendable {
    let groupName: String
    let directMembers: [String]
    let activeMembers: [String]
    let flattenedMembers: [String]
    let flattenedAllMembers: [String]
    let structureKind: String
    let relatedFamilies: [String]
    let supersetOfGroups: [String]
    let overlapsWithGroups: [String]

    var payload: [String: String] {
        [
            "groupName": groupName,
            "directMembers": directMembers.joined(separator: ", "),
            "activeMembers": activeMembers.joined(separator: ", "),
            "flattenedMembers": flattenedMembers.joined(separator: ", "),
            "flattenedAllMembers": flattenedAllMembers.joined(separator: ", "),
            "structureKind": structureKind,
            "relatedFamilies": relatedFamilies.joined(separator: ", "),
            "supersetOfGroups": supersetOfGroups.joined(separator: ", "),
            "overlapsWithGroups": overlapsWithGroups.joined(separator: ", ")
        ]
    }
}

struct XLightsDerivedMetadataModel: Sendable {
    let families: [XLightsDerivedFamilyModel]
    let typeBreakdown: [XLightsDerivedTypeBreakdownModel]
    let modelSamples: [XLightsDerivedModelSample]
    let allTargetNames: [String]
    let groupMemberships: [XLightsDerivedGroupMembershipModel]

    static let empty = XLightsDerivedMetadataModel(
        families: [],
        typeBreakdown: [],
        modelSamples: [],
        allTargetNames: [],
        groupMemberships: []
    )
}
