import Foundation

protocol XLightsDerivedMetadataService: Sendable {
    func derive(from rows: [DisplayLayoutRowModel]) -> XLightsDerivedMetadataModel
}

struct DefaultXLightsDerivedMetadataService: XLightsDerivedMetadataService {
    func derive(from rows: [DisplayLayoutRowModel]) -> XLightsDerivedMetadataModel {
        let modelRows = rows.filter { row in
            let type = row.targetType.lowercased()
            return !type.contains("modelgroup") && !type.contains("submodel")
        }
        let familyMap = buildFamilyMap(from: modelRows)
        let samples = buildModelSamples(from: modelRows, familyMap: familyMap)
        let groupMemberships = buildGroupMemberships(from: rows, familyMap: familyMap)
        return XLightsDerivedMetadataModel(
            families: buildFamilies(from: modelRows, familyMap: familyMap),
            typeBreakdown: buildTypeBreakdown(from: rows),
            modelSamples: samples,
            allTargetNames: rows.map(\.targetName).sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending },
            groupMemberships: groupMemberships
        )
    }

    private func buildFamilies(from rows: [DisplayLayoutRowModel], familyMap: [String: [DisplayLayoutRowModel]]) -> [XLightsDerivedFamilyModel] {
        struct FamilyBucket {
            let baseName: String
            let type: String
            var rows: [DisplayLayoutRowModel]
        }

        var buckets: [String: FamilyBucket] = [:]
        for row in rows {
            let baseName = normalizedFamilyBaseName(for: row.targetName)
            let key = "\(row.targetType.lowercased())|\(baseName.lowercased())"
            if var existing = buckets[key] {
                existing.rows.append(row)
                buckets[key] = existing
            } else {
                buckets[key] = FamilyBucket(baseName: baseName, type: row.targetType, rows: [row])
            }
        }

        return buckets.values
            .filter { bucket in
                guard bucket.rows.count >= 2 else { return false }
                let nodeCounts = bucket.rows.map(\.nodeCount)
                let minNodes = nodeCounts.min() ?? 0
                let maxNodes = nodeCounts.max() ?? 0
                return maxNodes - minNodes <= max(10, Int(Double(maxNodes) * 0.12))
            }
            .sorted { lhs, rhs in
                if lhs.rows.count != rhs.rows.count { return lhs.rows.count > rhs.rows.count }
                return lhs.baseName.localizedCaseInsensitiveCompare(rhs.baseName) == .orderedAscending
            }
            .prefix(6)
            .map { bucket in
                let examples = bucket.rows
                    .map(\.targetName)
                    .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
                let nodeCount = bucket.rows.first?.nodeCount ?? 0
                let maxNodes = bucket.rows.map(\.nodeCount).max() ?? 0
                let minNodes = bucket.rows.map(\.nodeCount).min() ?? 0
                let count = bucket.rows.count
                let confidence: String
                if count >= 4, maxNodes - minNodes <= max(10, Int(Double(maxNodes) * 0.08)) {
                    confidence = "high"
                } else if count >= 3, maxNodes - minNodes <= max(15, Int(Double(maxNodes) * 0.15)) {
                    confidence = "medium"
                } else {
                    confidence = "low"
                }
                return XLightsDerivedFamilyModel(
                    name: bucket.baseName,
                    type: bucket.type,
                    count: bucket.rows.count,
                    examples: Array(examples.prefix(4)),
                    reason: nodeCount > 0
                        ? "\(bucket.rows.count) similarly named \(bucket.type) models with comparable node counts"
                        : "\(bucket.rows.count) similarly named \(bucket.type) models",
                    confidence: confidence,
                    totalNodeCount: bucket.rows.reduce(0) { $0 + $1.nodeCount }
                )
            }
    }

    private func buildTypeBreakdown(from rows: [DisplayLayoutRowModel]) -> [XLightsDerivedTypeBreakdownModel] {
        Dictionary(grouping: rows) { $0.targetType }
            .map { type, typeRows in
                XLightsDerivedTypeBreakdownModel(type: type, count: typeRows.count)
            }
            .sorted { lhs, rhs in
                if lhs.count != rhs.count { return lhs.count > rhs.count }
                return lhs.type.localizedCaseInsensitiveCompare(rhs.type) == .orderedAscending
            }
            .prefix(10)
            .map { $0 }
    }

    private func buildModelSamples(
        from rows: [DisplayLayoutRowModel],
        familyMap: [String: [DisplayLayoutRowModel]]
    ) -> [XLightsDerivedModelSample] {
        let bounds = spatialBounds(for: rows)
        let symmetryMap = buildSymmetryPeerMap(from: rows)
        let typeCounts = Dictionary(grouping: rows, by: \.targetType).mapValues(\.count)
        let maxNodeCount = rows.map(\.nodeCount).max() ?? 0
        return rows
            .sorted { lhs, rhs in
                let leftScore = samplePriority(for: lhs)
                let rightScore = samplePriority(for: rhs)
                if leftScore != rightScore { return leftScore > rightScore }
                return lhs.targetName.localizedCaseInsensitiveCompare(rhs.targetName) == .orderedAscending
            }
            .prefix(24)
            .map { row in
                XLightsDerivedModelSample(
                    name: row.targetName,
                    type: row.targetType,
                    nodeCount: row.nodeCount,
                    positionX: row.positionX,
                    positionY: row.positionY,
                    positionZ: row.positionZ,
                    width: row.width,
                    height: row.height,
                    depth: row.depth,
                    submodelCount: row.submodelCount,
                    horizontalZone: horizontalZone(for: row.positionX, bounds: bounds),
                    depthZone: depthZone(for: row.positionZ, bounds: bounds),
                    visualWeight: visualWeight(for: row, maxNodeCount: maxNodeCount),
                    uniqueness: uniqueness(for: row, typeCounts: typeCounts, familyMap: familyMap),
                    symmetryPeers: symmetryMap[row.targetName] ?? []
                )
            }
    }

    private func buildGroupMemberships(
        from rows: [DisplayLayoutRowModel],
        familyMap: [String: [DisplayLayoutRowModel]]
    ) -> [XLightsDerivedGroupMembershipModel] {
        let groupRows = rows
            .filter { $0.targetType.lowercased().contains("modelgroup") }
            .filter {
                !$0.directGroupMembers.isEmpty ||
                !$0.activeGroupMembers.isEmpty ||
                !$0.flattenedGroupMembers.isEmpty ||
                !$0.flattenedAllGroupMembers.isEmpty
            }
            .sorted { $0.targetName.localizedCaseInsensitiveCompare($1.targetName) == .orderedAscending }
        let flattenedByGroup = Dictionary(uniqueKeysWithValues: groupRows.map { ($0.targetName, Set($0.flattenedAllGroupMembers)) })
        let familyNames = Set(familyMap.keys)
        return groupRows.map { row in
                let directSet = Set(row.directGroupMembers)
                let flattenedSet = Set(row.flattenedAllGroupMembers)
                let directGroupNames = row.directGroupMembers.filter { flattenedByGroup[$0] != nil }
                let structureKind: String
                if directGroupNames.count > 0 {
                    structureKind = "nested_group"
                } else if flattenedSet.count > directSet.count {
                    structureKind = "aggregate_group"
                } else {
                    structureKind = "direct_group"
                }
                let relatedFamilies = familyNames
                    .filter { familyName in
                        flattenedSet.contains(where: { normalizedFamilyBaseName(for: $0).localizedCaseInsensitiveCompare(familyName) == .orderedSame })
                    }
                    .sorted()
                let supersetOfGroups = flattenedByGroup.compactMap { entry -> String? in
                    let (groupName, members) = entry
                    guard groupName != row.targetName else { return nil }
                    guard !members.isEmpty, members.isSubset(of: flattenedSet), members != flattenedSet else { return nil }
                    return groupName
                }.sorted()
                let overlapsWithGroups = flattenedByGroup.compactMap { entry -> String? in
                    let (groupName, members) = entry
                    guard groupName != row.targetName else { return nil }
                    let intersection = members.intersection(flattenedSet)
                    guard !intersection.isEmpty else { return nil }
                    if members.isSubset(of: flattenedSet) || flattenedSet.isSubset(of: members) {
                        return nil
                    }
                    return groupName
                }.sorted()
                return XLightsDerivedGroupMembershipModel(
                    groupName: row.targetName,
                    directMembers: row.directGroupMembers,
                    activeMembers: row.activeGroupMembers,
                    flattenedMembers: row.flattenedGroupMembers,
                    flattenedAllMembers: row.flattenedAllGroupMembers,
                    structureKind: structureKind,
                    relatedFamilies: relatedFamilies,
                    supersetOfGroups: supersetOfGroups,
                    overlapsWithGroups: overlapsWithGroups
                )
            }
    }

    private func buildFamilyMap(from rows: [DisplayLayoutRowModel]) -> [String: [DisplayLayoutRowModel]] {
        Dictionary(grouping: rows, by: { normalizedFamilyBaseName(for: $0.targetName) })
    }

    private func samplePriority(for row: DisplayLayoutRowModel) -> Int {
        var score = discoveryScore(for: row)
        if row.nodeCount >= 300 { score += 3 }
        else if row.nodeCount >= 100 { score += 2 }
        if abs(row.positionX) < 2.5 { score += 1 }
        return score
    }

    private func discoveryScore(for row: DisplayLayoutRowModel) -> Int {
        let name = row.targetName.lowercased()
        let type = row.targetType.lowercased()
        if type.contains("submodel") { return 0 }
        var score = 0
        let keywords = [
            "snowman", "santa", "tree", "mega", "star", "matrix",
            "arch", "window", "roof", "house", "flake", "snow",
            "cane", "candy", "gift", "present", "spinner", "wreath"
        ]
        for keyword in keywords where name.contains(keyword) { score += 4 }
        if type.contains("modelgroup") { score -= 2 } else { score += 2 }
        if row.nodeCount >= 500 { score += 3 }
        else if row.nodeCount >= 150 { score += 2 }
        else if row.nodeCount >= 50 { score += 1 }
        if row.positionX != 0, abs(row.positionX) < 2.0 { score += 1 }
        if row.width >= 4.0 || row.height >= 4.0 { score += 1 }
        if row.submodelCount > 0 { score += 1 }
        if row.targetName.count > 2 { score += 1 }
        return score
    }

    private func normalizedFamilyBaseName(for name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let pattern = #"([_\-\s]?\d+)$"#
        let stripped = trimmed.replacingOccurrences(of: pattern, with: "", options: .regularExpression)
        return stripped.isEmpty ? trimmed : stripped
    }

    private func visualWeight(for row: DisplayLayoutRowModel, maxNodeCount: Int) -> String {
        let footprint = max(row.width * row.height, max(row.width, row.height))
        let nodeRatio = maxNodeCount > 0 ? Double(row.nodeCount) / Double(maxNodeCount) : 0
        let score = nodeRatio * 0.7 + min(footprint / 10.0, 1.0) * 0.3
        switch score {
        case 0.75...: return "dominant"
        case 0.45...: return "high"
        case 0.2...: return "medium"
        default: return "low"
        }
    }

    private func uniqueness(
        for row: DisplayLayoutRowModel,
        typeCounts: [String: Int],
        familyMap: [String: [DisplayLayoutRowModel]]
    ) -> String {
        let typeCount = typeCounts[row.targetType, default: 0]
        let familyCount = familyMap[normalizedFamilyBaseName(for: row.targetName)]?.count ?? 1
        if familyCount == 1, typeCount <= 2 { return "high" }
        if familyCount <= 2 { return "medium" }
        return "repeated"
    }

    private func spatialBounds(for rows: [DisplayLayoutRowModel]) -> (minX: Double, maxX: Double, minZ: Double, maxZ: Double) {
        let xs = rows.map(\.positionX)
        let zs = rows.map(\.positionZ)
        return (
            minX: xs.min() ?? 0,
            maxX: xs.max() ?? 0,
            minZ: zs.min() ?? 0,
            maxZ: zs.max() ?? 0
        )
    }

    private func horizontalZone(for positionX: Double, bounds: (minX: Double, maxX: Double, minZ: Double, maxZ: Double)) -> String {
        let span = bounds.maxX - bounds.minX
        guard span > 0.5 else { return "center" }
        let normalized = (positionX - bounds.minX) / span
        switch normalized {
        case ..<0.33: return "left"
        case 0.67...: return "right"
        default: return "center"
        }
    }

    private func depthZone(for positionZ: Double, bounds: (minX: Double, maxX: Double, minZ: Double, maxZ: Double)) -> String {
        let span = bounds.maxZ - bounds.minZ
        guard span > 0.5 else { return "midground" }
        let normalized = (positionZ - bounds.minZ) / span
        switch normalized {
        case ..<0.33: return "foreground"
        case 0.67...: return "background"
        default: return "midground"
        }
    }

    private func buildSymmetryPeerMap(from rows: [DisplayLayoutRowModel]) -> [String: [String]] {
        var map: [String: [String]] = [:]
        for row in rows {
            let peers = rows.filter { candidate in
                guard candidate.targetName != row.targetName else { return false }
                guard candidate.targetType == row.targetType else { return false }
                guard abs(candidate.positionX + row.positionX) <= 1.5 else { return false }
                guard abs(candidate.positionY - row.positionY) <= 1.5 else { return false }
                guard abs(candidate.positionZ - row.positionZ) <= 1.5 else { return false }
                guard abs(candidate.width - row.width) <= 1.0 else { return false }
                guard abs(candidate.height - row.height) <= 1.0 else { return false }
                return true
            }
            .map(\.targetName)
            .sorted()
            if !peers.isEmpty {
                map[row.targetName] = Array(peers.prefix(3))
            }
        }
        return map
    }
}
