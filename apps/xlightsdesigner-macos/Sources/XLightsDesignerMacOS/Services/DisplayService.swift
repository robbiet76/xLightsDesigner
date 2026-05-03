import Foundation

protocol DisplayService: Sendable {
    func loadDisplay(for project: ActiveProjectModel?) async throws -> DisplayServiceResult
    func addTag(for project: ActiveProjectModel?, targetIDs: [String], tagName: String, description: String) async throws
    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws
    func saveTargetPreference(for project: ActiveProjectModel?, targetIDs: [String], rolePreference: String?, semanticHints: [String], effectAvoidances: [String]) async throws
    func saveTagDefinition(for project: ActiveProjectModel?, tagID: String?, name: String, description: String, color: DisplayLabelColor) async throws
    func deleteTagDefinition(for project: ActiveProjectModel?, tagID: String) async throws
}

struct DisplayServiceResult: Sendable {
    let readiness: DisplayReadinessSummaryModel
    let rows: [DisplayLayoutRowModel]
    let sourceSummary: String
    let banners: [DisplayBannerModel]
    let labelDefinitions: [DisplayLabelDefinitionModel]
    let targetPreferences: [String: PersistedDisplayTargetPreference]
    let visualHintDefinitions: [PersistedVisualHintDefinition]
}

enum DisplayServiceError: LocalizedError {
    case noActiveProject

    var errorDescription: String? {
        switch self {
        case .noActiveProject:
            return "Open a project before working with display metadata."
        }
    }
}

struct XLightsDisplayService: DisplayService {
    private let metadataStore: DisplayMetadataStore

    init(metadataStore: DisplayMetadataStore = LocalDisplayMetadataStore()) {
        self.metadataStore = metadataStore
    }

    func loadDisplay(for project: ActiveProjectModel?) async throws -> DisplayServiceResult {
        let health = try? await fetchHealth()
        let validProject = project.flatMap(validateProjectContext)
        let currentMedia = try? await fetchCurrentMedia()

        let metadataDocument: PersistedDisplayMetadataDocument
        if let project {
            metadataDocument = (try? metadataStore.load(for: project)) ?? PersistedDisplayMetadataDocument()
        } else {
            metadataDocument = PersistedDisplayMetadataDocument()
        }

        let usageByTagID = metadataDocument.targetTags.values.reduce(into: [String: Int]()) { result, ids in
            for id in ids {
                result[id, default: 0] += 1
            }
        }
        let labelDefinitions = metadataDocument.tags.map {
            DisplayLabelDefinitionModel(
                id: $0.id,
                name: $0.name,
                description: $0.description,
                usageCount: usageByTagID[$0.id, default: 0],
                color: DisplayLabelColor(rawValue: $0.colorName ?? "") ?? .none
            )
        }
        let labelDefinitionsByID = Dictionary(uniqueKeysWithValues: labelDefinitions.map { ($0.id, $0) })
        let explanation: String
        let nextStep: String
        let state: DisplayReadinessState
        var banners: [DisplayBannerModel] = []
        let rows: [DisplayLayoutRowModel]
        let taggedCount: Int
        let unresolvedCount: Int

        if health?.listenerReachable != true {
            rows = []
            taggedCount = 0
            unresolvedCount = 0
            state = .blocked
            explanation = "Display needs a live xLights session to load the current model list."
            nextStep = "Open xLights to this project's show folder, then return to Display."
            banners.append(DisplayBannerModel(
                id: "xlights-required",
                state: .blocked,
                text: "xLights is closed or its owned API is unavailable. Display reads the live model list from xLights."
            ))
        } else if let validProject {
            if let currentMedia, !showDirectoryMatchesProject(currentMedia.showDirectory, projectShowFolder: project?.showFolder ?? "") {
                rows = []
                taggedCount = 0
                unresolvedCount = 0
                state = .blocked
                explanation = "xLights is currently open to a different show folder than the active project."
                nextStep = "Open xLights to the project's show folder, or correct the project show folder in Project if the project points at the wrong folder."
                banners.append(DisplayBannerModel(
                    id: "show-mismatch",
                    state: .blocked,
                    text: "Current xLights folder: \(currentMedia.showDirectory.isEmpty ? "(not set)" : currentMedia.showDirectory)\nProject show folder: \(project?.showFolder.isEmpty == false ? project!.showFolder : "(not set)")"
                ))
            } else {
                async let modelsTask = fetchModels()
                async let groupMembershipsTask = fetchGroupMemberships()
                async let submodelsTask = fetchSubmodels()
                let models = try await modelsTask
                let groupMemberships = try await groupMembershipsTask
                let submodelsByParent = groupSubmodelsByParent(try? await submodelsTask)
                rows = models
                    .map {
                        makeRow(
                            from: $0,
                            groupMemberships: groupMemberships,
                            submodels: submodelsByParent[$0.name] ?? [],
                            document: metadataDocument,
                            labelDefinitionsByID: labelDefinitionsByID
                        )
                    }
                    .sorted { $0.targetName.localizedCaseInsensitiveCompare($1.targetName) == .orderedAscending }
                let nodeLayoutsByModel = await fetchNodeLayouts(for: rows)
                let modelIndexArtifact = try? encodeDisplayModelIndexArtifactInternal(
                    rows: rows,
                    nodeLayoutsByModel: nodeLayoutsByModel,
                    submodelsByParent: submodelsByParent,
                    sourceSummary: "xLights owned API"
                )
                if let project, modelIndexArtifact != nil {
                    try? metadataStore.writeRefreshArtifacts(
                        project: project,
                        targetMetadata: modelIndexArtifact,
                        reconciliation: nil
                    )
                }
                taggedCount = rows.filter { !$0.labelDefinitions.isEmpty }.count
                unresolvedCount = rows.count - taggedCount

                if unresolvedCount > 0 {
                    state = .needsReview
                    explanation = unresolvedCount == rows.count
                        ? "No current display metadata has been captured yet."
                        : "\(unresolvedCount) xLights models are still unmapped by the current display metadata."
                    nextStep = validProject
                } else {
                    state = .ready
                    explanation = "Display metadata is in place for the current xLights model set."
                    nextStep = "Refine the metadata where needed or continue into design and sequencing."
                }
            }
        } else {
            rows = []
            taggedCount = 0
            unresolvedCount = 0
            state = .blocked
            explanation = "Project context is incomplete or invalid."
            nextStep = "Correct the project show folder in Project, then return to Display."
            banners.append(DisplayBannerModel(id: "project-context", state: .blocked, text: "Project show folder must be corrected in Project."))
        }

        if health?.listenerReachable == false {
            banners.append(DisplayBannerModel(id: "xlights-unreachable", state: .blocked, text: "xLights owned API is not reachable."))
        }

        return DisplayServiceResult(
            readiness: DisplayReadinessSummaryModel(
                state: state,
                totalTargets: rows.count,
                readyCount: taggedCount,
                unresolvedCount: unresolvedCount,
                orphanCount: 0,
                explanationText: explanation,
                nextStepText: nextStep
            ),
            rows: rows,
            sourceSummary: health?.listenerReachable == true ? "xLights owned API" : "No live xLights source",
            banners: banners,
            labelDefinitions: labelDefinitions.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending },
            targetPreferences: metadataDocument.preferencesByTargetId,
            visualHintDefinitions: metadataDocument.visualHintDefinitions
        )
    }

    private func fetchCurrentMedia() async throws -> XLightsCurrentMedia {
        let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + "/media/current")!
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(XLightsCurrentMediaResponse.self, from: data).data
    }

    private func showDirectoryMatchesProject(_ showDirectory: String, projectShowFolder: String) -> Bool {
        let lhs = URL(fileURLWithPath: showDirectory).standardizedFileURL.path.trimmingCharacters(in: .whitespacesAndNewlines)
        let rhs = URL(fileURLWithPath: projectShowFolder).standardizedFileURL.path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !lhs.isEmpty, !rhs.isEmpty else { return false }
        return lhs == rhs
    }

    func addTag(for project: ActiveProjectModel?, targetIDs: [String], tagName: String, description: String) async throws {
        guard let project else { throw DisplayServiceError.noActiveProject }
        try metadataStore.createOrAssignTag(project: project, targetIDs: targetIDs, tagName: tagName, description: description)
    }

    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws {
        guard let project else { throw DisplayServiceError.noActiveProject }
        try metadataStore.removeTag(project: project, targetIDs: targetIDs, tagID: tagID)
    }

    func saveTargetPreference(for project: ActiveProjectModel?, targetIDs: [String], rolePreference: String?, semanticHints: [String], effectAvoidances: [String]) async throws {
        guard let project else { throw DisplayServiceError.noActiveProject }
        try metadataStore.updateTargetPreference(
            project: project,
            targetIDs: targetIDs,
            rolePreference: rolePreference,
            semanticHints: semanticHints,
            effectAvoidances: effectAvoidances
        )
    }

    func saveTagDefinition(for project: ActiveProjectModel?, tagID: String?, name: String, description: String, color: DisplayLabelColor) async throws {
        guard let project else { throw DisplayServiceError.noActiveProject }
        try metadataStore.updateTagDefinition(
            project: project,
            tagID: tagID,
            name: name,
            description: description,
            colorName: color == .none ? nil : color.rawValue
        )
    }

    func deleteTagDefinition(for project: ActiveProjectModel?, tagID: String) async throws {
        guard let project else { throw DisplayServiceError.noActiveProject }
        try metadataStore.deleteTagDefinition(project: project, tagID: tagID)
    }

    private func validateProjectContext(_ project: ActiveProjectModel) -> String? {
        let showFolder = project.showFolder.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !showFolder.isEmpty else { return nil }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: showFolder, isDirectory: &isDirectory), isDirectory.boolValue else { return nil }
        return "Use the display metadata workspace to confirm how the current xLights models should be understood downstream."
    }

    private func makeRow(
        from model: XLightsLayoutModel,
        groupMemberships: [String: XLightsGroupMembership],
        submodels: [XLightsSubmodel],
        document: PersistedDisplayMetadataDocument,
        labelDefinitionsByID: [String: DisplayLabelDefinitionModel]
    ) -> DisplayLayoutRowModel {
        let assignedTagIDs = document.targetTags[model.name] ?? []
        let assignedLabels = assignedTagIDs
            .compactMap { labelDefinitionsByID[$0] }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let membership = groupMemberships[model.name]

        return DisplayLayoutRowModel(
            id: model.name,
            targetName: model.name,
            targetType: model.displayAs,
            nodeCount: model.nodeCount ?? 0,
            positionX: model.positionX ?? 0,
            positionY: model.positionY ?? 0,
            positionZ: model.positionZ ?? 0,
            width: model.width ?? 0,
            height: model.height ?? 0,
            depth: model.depth ?? 0,
            labelDefinitions: assignedLabels,
            submodelCount: model.submodelCount,
            directGroupMembers: membership?.directMembers.map(\.name) ?? [],
            activeGroupMembers: membership?.activeMembers.map(\.name) ?? [],
            flattenedGroupMembers: membership?.flattenedMembers.map(\.name) ?? [],
            flattenedAllGroupMembers: membership?.flattenedAllMembers.map(\.name) ?? [],
            submodelFacts: submodels.map { submodel in
                DisplaySubmodelFactModel(submodel: submodel, allSubmodels: submodels, parentNodeCount: model.nodeCount ?? 0)
            }
        )
    }

}

func encodeDisplayModelIndexArtifact(
    rows: [DisplayLayoutRowModel],
    submodelsByParent: [String: [XLightsSubmodel]],
    sourceSummary: String,
    createdAt: String = ISO8601DateFormatter().string(from: Date())
) throws -> Data {
    try encodeDisplayModelIndexArtifactInternal(
        rows: rows,
        nodeLayoutsByModel: [:],
        submodelsByParent: submodelsByParent,
        sourceSummary: sourceSummary,
        createdAt: createdAt
    )
}

private func encodeDisplayModelIndexArtifactInternal(
    rows: [DisplayLayoutRowModel],
    nodeLayoutsByModel: [String: XLightsModelNodeLayout],
    submodelsByParent: [String: [XLightsSubmodel]],
    sourceSummary: String,
    createdAt: String = ISO8601DateFormatter().string(from: Date())
) throws -> Data {
    let records = rows.flatMap { row in
        let submodels = submodelsByParent[row.targetName] ?? []
        let parentRecord = DisplayModelIndexRecord(
            row: row,
            nodeLayout: nodeLayoutsByModel[row.targetName],
            submodels: submodels
        )
        let submodelRecords = submodels.map { submodel in
            DisplayModelIndexRecord(
                submodel: submodel,
                parent: row,
                allSubmodels: submodels
            )
        }
        return [parentRecord] + submodelRecords
    }
    let artifact = DisplayModelIndexArtifact(
        artifactType: "target_metadata_index_v1",
        artifactVersion: "1.0",
        createdAt: createdAt,
        source: DisplayModelIndexSource(source: sourceSummary),
        summary: DisplayModelIndexSummary(
            targetCount: records.count,
            modelCount: rows.filter { !$0.targetType.localizedCaseInsensitiveContains("modelgroup") }.count,
            groupCount: rows.filter { $0.targetType.localizedCaseInsensitiveContains("modelgroup") }.count,
            submodelCount: rows.reduce(0) { $0 + $1.submodelCount }
        ),
        records: records
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    return try encoder.encode(artifact)
}

extension XLightsDisplayService {
    private func encodeModelIndexArtifact(
        rows: [DisplayLayoutRowModel],
        nodeLayoutsByModel: [String: XLightsModelNodeLayout],
        submodelsByParent: [String: [XLightsSubmodel]],
        sourceSummary: String
    ) throws -> Data {
        try encodeDisplayModelIndexArtifactInternal(
            rows: rows,
            nodeLayoutsByModel: nodeLayoutsByModel,
            submodelsByParent: submodelsByParent,
            sourceSummary: sourceSummary
        )
    }

    private func fetchHealth() async throws -> XLightsHealth {
        let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + "/health")!
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(XLightsHealthResponse.self, from: data).data
    }

    private func fetchModels() async throws -> [XLightsLayoutModel] {
        let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + "/layout/models")!
        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(XLightsLayoutResponse.self, from: data).data.models
    }

    private func fetchGroupMemberships() async throws -> [String: XLightsGroupMembership] {
        let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + "/layout/group-members")!
        let (data, urlResponse) = try await URLSession.shared.data(from: url)
        if let http = urlResponse as? HTTPURLResponse, http.statusCode == 404 {
            return [:]
        }
        let decoded = try JSONDecoder().decode(XLightsGroupMembershipResponse.self, from: data)
        return Dictionary(uniqueKeysWithValues: decoded.data.groups.map { ($0.groupName, $0) })
    }

    private func fetchSubmodels() async throws -> [XLightsSubmodel] {
        let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + "/layout/submodels")!
        let (data, urlResponse) = try await URLSession.shared.data(from: url)
        if let http = urlResponse as? HTTPURLResponse, http.statusCode == 404 {
            return []
        }
        return try JSONDecoder().decode(XLightsSubmodelsResponse.self, from: data).data.submodels
    }

    private func fetchNodeLayouts(for rows: [DisplayLayoutRowModel]) async -> [String: XLightsModelNodeLayout] {
        let modelRows = rows.filter { !isModelGroupType($0.targetType) && $0.nodeCount > 0 }
        return await withTaskGroup(of: (String, XLightsModelNodeLayout?).self) { group in
            let maximumConcurrentRequests = 8
            var nextIndex = 0

            func enqueue(_ row: DisplayLayoutRowModel) {
                group.addTask {
                    let layout = try? await fetchModelNodeLayout(modelName: row.targetName)
                    return (row.targetName, layout)
                }
            }

            while nextIndex < min(maximumConcurrentRequests, modelRows.count) {
                enqueue(modelRows[nextIndex])
                nextIndex += 1
            }

            var layouts: [String: XLightsModelNodeLayout] = [:]
            for await (modelName, layout) in group {
                if let layout {
                    layouts[modelName] = layout
                }
                if nextIndex < modelRows.count {
                    enqueue(modelRows[nextIndex])
                    nextIndex += 1
                }
            }
            return layouts
        }
    }

    private func fetchModelNodeLayout(modelName: String) async throws -> XLightsModelNodeLayout {
        var components = URLComponents(string: AppEnvironment.xlightsOwnedAPIBaseURL + "/layout/model-nodes")!
        components.queryItems = [
            URLQueryItem(name: "name", value: modelName),
            URLQueryItem(name: "includeBufferCoords", value: "true"),
            URLQueryItem(name: "includeWorldCoords", value: "true"),
            URLQueryItem(name: "includeScreenCoords", value: "false")
        ]
        let (data, urlResponse) = try await URLSession.shared.data(from: components.url!)
        if let http = urlResponse as? HTTPURLResponse, http.statusCode == 404 {
            throw URLError(.fileDoesNotExist)
        }
        return try JSONDecoder().decode(XLightsModelNodeLayoutResponse.self, from: data).data
    }
}

private func isModelGroupType(_ type: String) -> Bool {
    type.localizedCaseInsensitiveContains("modelgroup")
}

private func isCustomModelType(_ type: String) -> Bool {
    let normalized = type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return normalized == "custom" || normalized.contains("custom")
}

private func canonicalDisplayModelType(_ type: String) -> String {
    let normalized = type.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if normalized.contains("modelgroup") { return "model_group" }
    if normalized == "single line" { return "single_line" }
    return normalized.replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
        .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
}

func groupSubmodelsByParent(_ submodels: [XLightsSubmodel]?) -> [String: [XLightsSubmodel]] {
    Dictionary(grouping: submodels ?? []) { submodel in
        submodel.parentId ?? parentIdFromSubmodelId(submodel.id)
    }.mapValues { rows in
        rows.sorted { lhs, rhs in
            submodelSortName(lhs).localizedCaseInsensitiveCompare(submodelSortName(rhs)) == .orderedAscending
        }
    }
}

private func parentIdFromSubmodelId(_ id: String?) -> String {
    guard let id else { return "" }
    return String(id.split(separator: "/", maxSplits: 1).first ?? "")
}

private func submodelSortName(_ submodel: XLightsSubmodel) -> String {
    submodel.name ?? submodel.id ?? ""
}

private func normalizeSubmodelNodeMembership(_ submodel: XLightsSubmodel) -> [Int] {
    let values = submodel.membership?.nodeChannels
        ?? submodel.membership?.nodes
        ?? submodel.nodeChannels
        ?? submodel.nodes
        ?? parseSubmodelLineMembership(submodel.lines)
    return values.sorted()
}

private func parseSubmodelLineMembership(_ lines: String?) -> [Int] {
    guard let lines else { return [] }
    var values: [Int] = []
    for token in lines.components(separatedBy: CharacterSet(charactersIn: ",; ")) {
        let trimmed = token.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { continue }
        let bounds = trimmed.split(separator: "-", maxSplits: 1).compactMap { Int($0.trimmingCharacters(in: .whitespacesAndNewlines)) }
        if bounds.count == 2 {
            let lower = min(bounds[0], bounds[1])
            let upper = max(bounds[0], bounds[1])
            values.append(contentsOf: lower...upper)
        } else if bounds.count == 1 {
            values.append(bounds[0])
        }
    }
    return values
}

private func intersectionCount(_ lhs: [Int], _ rhs: [Int]) -> Int {
    guard !lhs.isEmpty, !rhs.isEmpty else { return 0 }
    let rhsSet = Set(rhs)
    return lhs.filter { rhsSet.contains($0) }.count
}

private func coverageRatio(nodeCount: Int?, parentNodeCount: Int?) -> Double? {
    guard
        let nodeCount,
        let parentNodeCount,
        nodeCount > 0,
        parentNodeCount > 0
    else { return nil }
    return (Double(nodeCount) / Double(parentNodeCount) * 10_000).rounded() / 10_000
}

private func classifySubmodelStructureHints(
    submodel: XLightsSubmodel,
    siblingCount: Int,
    overlapsSibling: Bool,
    nodeCoverage: DisplaySubmodelNodeCoverage
) -> [String] {
    var hints: [String] = []
    if submodel.lines?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false {
        hints.append("range_defined_region")
    }
    if nodeCoverage.nodeCount > 0 {
        hints.append("node_scoped_region")
    }
    if let ratio = nodeCoverage.ratio, ratio > 0, ratio < 0.95 {
        hints.append("partial_region")
    }
    if siblingCount > 0 {
        hints.append("sibling_region")
    }
    if overlapsSibling {
        hints.append("overlapping_region")
    }
    return uniqueStrings(hints)
}

struct DisplayCustomModelInference: Equatable {
    let profile: String
    let traits: [String]
    let confidence: Double
}

func inferCustomModelStructure(row: DisplayLayoutRowModel, submodels: [XLightsSubmodel]) -> DisplayCustomModelInference {
    var traits = ["custom_model"]
    var profile = "custom_model"
    var confidence = 0.35

    if row.nodeCount > 0 {
        traits.append("custom_grid")
    }

    let width = max(0, row.width)
    let height = max(0, row.height)
    let minDimension = min(width, height)
    let maxDimension = max(width, height)
    let aspectRatio = minDimension > 0 ? maxDimension / minDimension : 0

    if aspectRatio >= 2 {
        profile = "custom_linear_like"
        traits.append(contentsOf: ["custom_linear_like", "linear_like"])
        confidence = max(confidence, 0.6)
    }

    return DisplayCustomModelInference(
        profile: profile,
        traits: uniqueStrings(traits),
        confidence: confidence
    )
}

private func uniqueStrings(_ values: [String]) -> [String] {
    var seen = Set<String>()
    var result: [String] = []
    for value in values {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { continue }
        let key = trimmed.lowercased()
        guard seen.insert(key).inserted else { continue }
        result.append(trimmed)
    }
    return result
}

private func displayModelFingerprint(row: DisplayLayoutRowModel, nodeLayout: XLightsModelNodeLayout?, submodels: [XLightsSubmodel]) -> String {
    let targetKind = isModelGroupType(row.targetType) ? "group" : "model"
    let customPayload = isCustomModelType(row.targetType)
        ? """
        {"construction":\(displayNodeLayoutFingerprintPayload(nodeLayout)),"nodeCount":\(row.nodeCount),"profile":\(jsonString(inferCustomModelStructure(row: row, submodels: submodels).profile)),"submodels":[\(submodels.map(displaySubmodelSummaryFingerprintPayload).joined(separator: ","))]}
        """
        : "null"
    let nodeLayoutPayload = nodeLayout.map {
        """
        {"dimensions":null,"nodeCount":\($0.nodes.count),"nodeOrderContinuity":null,"occupancy":null,"source":"layout.getModelNodes"}
        """
    } ?? "null"
    let groupMembers = row.flattenedGroupMembers.sorted().map(jsonString).joined(separator: ",")
    let payload = """
    {"canonicalType":\(jsonString(row.targetType)),"custom":\(customPayload),"dimensions":null,"groupMembers":[\(groupMembers)],"nodeCount":\(row.nodeCount),"nodeLayout":\(nodeLayoutPayload),"structuralAttrs":{"DisplayAs":\(jsonString(row.targetType)),"ModelChain":"","PixelCount":"","StringType":"","parm1":"","parm2":"","parm3":""},"submodel":null,"targetKind":\(jsonString(targetKind))}
    """
    return "tmf1:\(stableFNV1aHash(payload))"
}

private func displaySubmodelFingerprint(submodel: XLightsSubmodel) -> String {
    let nodeCount = submodel.membership?.nodeCount
        ?? submodel.nodeCount
        ?? normalizeSubmodelNodeMembership(submodel).count
    let payload = """
    {"canonicalType":"submodel","custom":null,"dimensions":null,"groupMembers":[],"nodeCount":\(nodeCount),"nodeLayout":null,"structuralAttrs":{"DisplayAs":"","ModelChain":"","PixelCount":"","StringType":"","parm1":"","parm2":"","parm3":""},"submodel":{"lines":\(jsonString(submodel.lines ?? "")),"nodeCount":\(nodeCount),"type":\(jsonString(submodel.type ?? ""))},"targetKind":"submodel"}
    """
    return "tmf1:\(stableFNV1aHash(payload))"
}

private func displayNodeLayoutFingerprintPayload(_ nodeLayout: XLightsModelNodeLayout?) -> String {
    guard let nodeLayout else { return "null" }
    return """
    {"nodeMap":{"nodeCount":\(nodeLayout.nodes.count)}}
    """
}

private func displaySubmodelSummaryFingerprintPayload(_ submodel: XLightsSubmodel) -> String {
    let nodeCount = submodel.membership?.nodeCount
        ?? submodel.nodeCount
        ?? normalizeSubmodelNodeMembership(submodel).count
    return """
    {"name":\(jsonString(submodel.name ?? "")),"nodeCount":\(nodeCount),"range":\(jsonString(submodel.lines ?? "")),"type":\(jsonString(submodel.type ?? ""))}
    """
}

private func jsonString(_ value: String) -> String {
    let data = try? JSONEncoder().encode(value.trimmingCharacters(in: .whitespacesAndNewlines))
    return data.flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
}

private func stableFNV1aHash(_ value: String) -> String {
    var hash: UInt32 = 2_166_136_261
    for scalar in value.unicodeScalars {
        hash ^= UInt32(scalar.value)
        hash = hash &* 16_777_619
    }
    return String(format: "%08x", hash)
}

private struct XLightsHealthResponse: Decodable {
    let data: XLightsHealth
}

private struct XLightsHealth: Decodable, Sendable {
    let listenerReachable: Bool
}

private struct XLightsLayoutResponse: Decodable {
    let data: XLightsLayoutData
}

private struct XLightsCurrentMediaResponse: Decodable {
    let data: XLightsCurrentMedia
}

private struct XLightsCurrentMedia: Decodable, Sendable {
    let showDirectory: String
}

private struct XLightsLayoutData: Decodable {
    let models: [XLightsLayoutModel]
}

private struct XLightsGroupMembershipResponse: Decodable {
    let data: XLightsGroupMembershipData
}

private struct XLightsGroupMembershipData: Decodable {
    let groups: [XLightsGroupMembership]
}

private struct XLightsGroupMembership: Decodable, Sendable {
    let groupName: String
    let directMembers: [XLightsGroupMember]
    let activeMembers: [XLightsGroupMember]
    let flattenedMembers: [XLightsGroupMember]
    let flattenedAllMembers: [XLightsGroupMember]
}

private struct XLightsGroupMember: Decodable, Sendable {
    let name: String
}

private struct XLightsSubmodelsResponse: Decodable {
    let data: XLightsSubmodelsData
}

private struct XLightsSubmodelsData: Decodable {
    let submodels: [XLightsSubmodel]
}

struct XLightsSubmodel: Decodable, Sendable {
    let id: String?
    let name: String?
    let type: String?
    let parentId: String?
    let layoutGroup: String?
    let groupNames: [String]?
    let startChannel: Int?
    let endChannel: Int?
    let nodeCount: Int?
    let lines: String?
    let membership: XLightsSubmodelMembership?
    let nodeChannels: [Int]?
    let nodes: [Int]?

    enum CodingKeys: String, CodingKey {
        case id
        case fullName
        case name
        case type
        case parentId
        case parentName
        case layoutGroup
        case groupNames
        case startChannel
        case endChannel
        case nodeCount
        case lines
        case membership
        case nodeChannels
        case nodes
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
            ?? container.decodeIfPresent(String.self, forKey: .fullName)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        type = try container.decodeIfPresent(String.self, forKey: .type)
        parentId = try container.decodeIfPresent(String.self, forKey: .parentId)
            ?? container.decodeIfPresent(String.self, forKey: .parentName)
        layoutGroup = try container.decodeIfPresent(String.self, forKey: .layoutGroup)
        groupNames = try container.decodeIfPresent([String].self, forKey: .groupNames)
        startChannel = try container.decodeIfPresent(Int.self, forKey: .startChannel)
        endChannel = try container.decodeIfPresent(Int.self, forKey: .endChannel)
        nodeCount = try container.decodeIfPresent(Int.self, forKey: .nodeCount)
        lines = try container.decodeIfPresent(String.self, forKey: .lines)
        membership = try container.decodeIfPresent(XLightsSubmodelMembership.self, forKey: .membership)
        nodeChannels = try container.decodeIfPresent([Int].self, forKey: .nodeChannels)
        nodes = try container.decodeIfPresent([Int].self, forKey: .nodes)
    }
}

struct XLightsSubmodelMembership: Decodable, Sendable {
    let nodeCount: Int?
    let nodeChannels: [Int]?
    let nodes: [Int]?

    enum CodingKeys: String, CodingKey {
        case nodeCount
        case nodeChannels
        case nodes
    }
}

private struct XLightsLayoutModel: Decodable, Sendable {
    let displayAs: String
    let layoutGroup: String
    let name: String
    let submodelCount: Int
    let nodeCount: Int?
    let positionX: Double?
    let positionY: Double?
    let positionZ: Double?
    let width: Double?
    let height: Double?
    let depth: Double?
}

private struct XLightsModelNodeLayoutResponse: Decodable {
    let data: XLightsModelNodeLayout
}

private struct XLightsModelNodeLayout: Decodable, Sendable {
    let modelName: String?
    let nodes: [XLightsModelNode]
    let source: XLightsModelNodeLayoutSource?
}

private struct XLightsModelNodeLayoutSource: Decodable, Sendable {
    let isCustomModel: Bool?
    let customModelParsed: Bool?
}

private struct XLightsModelNode: Decodable, Sendable {
    let nodeId: Int?
    let stringIndex: Int?
    let channelStart: Int?
    let channelCount: Int?
    let coords: [XLightsModelNodeCoordinate]?
}

private struct XLightsModelNodeCoordinate: Decodable, Sendable {
    let buffer: XLightsModelNodePoint2D?
    let world: XLightsModelNodePoint3D?
    let screen: XLightsModelNodePoint3D?
}

private struct XLightsModelNodePoint2D: Codable, Sendable {
    let x: Double?
    let y: Double?
}

private struct XLightsModelNodePoint3D: Codable, Sendable {
    let x: Double?
    let y: Double?
    let z: Double?
}

private struct DisplayModelIndexArtifact: Encodable {
    let artifactType: String
    let artifactVersion: String
    let createdAt: String
    let source: DisplayModelIndexSource
    let summary: DisplayModelIndexSummary
    let records: [DisplayModelIndexRecord]
}

private struct DisplayModelIndexSource: Encodable {
    let source: String
}

private struct DisplayModelIndexSummary: Encodable {
    let targetCount: Int
    let modelCount: Int
    let groupCount: Int
    let submodelCount: Int
}

private struct DisplayModelIndexRecord: Encodable {
    let targetId: String
    let targetKind: String
    let identity: DisplayModelIndexIdentity
    let structure: DisplayModelIndexStructure

    init(row: DisplayLayoutRowModel, nodeLayout: XLightsModelNodeLayout?, submodels: [XLightsSubmodel]) {
        let lowerType = row.targetType.lowercased()
        targetId = row.targetName
        targetKind = lowerType.contains("modelgroup") ? "group" : "model"
        identity = DisplayModelIndexIdentity(
            displayName: row.targetName,
            rawType: row.targetType,
            canonicalType: canonicalDisplayModelType(row.targetType),
            fingerprint: displayModelFingerprint(row: row, nodeLayout: nodeLayout, submodels: submodels),
            fingerprintVersion: "target-metadata-fingerprint-v1"
        )
        structure = DisplayModelIndexStructure(
            nodeCount: row.nodeCount,
            positionX: row.positionX,
            positionY: row.positionY,
            positionZ: row.positionZ,
            width: row.width,
            height: row.height,
            depth: row.depth,
            submodelCount: row.submodelCount,
            directGroupMembers: row.directGroupMembers,
            activeGroupMembers: row.activeGroupMembers,
            flattenedGroupMembers: row.flattenedGroupMembers,
            flattenedAllGroupMembers: row.flattenedAllGroupMembers,
            submodels: submodels.map { submodel in
                DisplaySubmodelSummary(submodel: submodel, allSubmodels: submodels, parentNodeCount: row.nodeCount)
            },
            nodeLayout: nodeLayout.map(DisplayNodeLayoutMetadata.init(layout:)),
            customStructure: isCustomModelType(row.targetType)
                ? DisplayCustomModelStructure(row: row, nodeLayout: nodeLayout, submodels: submodels)
                : nil
        )
    }

    init(submodel: XLightsSubmodel, parent: DisplayLayoutRowModel, allSubmodels: [XLightsSubmodel]) {
        let summary = DisplaySubmodelSummary(submodel: submodel, allSubmodels: allSubmodels, parentNodeCount: parent.nodeCount)
        let resolvedId = summary.id ?? summary.name ?? ""
        let resolvedName = summary.name ?? resolvedId
        let displayName = parent.targetName.isEmpty ? resolvedName : "\(parent.targetName) / \(resolvedName)"
        let parentId = summary.parentId ?? parent.targetName
        targetId = resolvedId
        targetKind = "submodel"
        identity = DisplayModelIndexIdentity(
            displayName: displayName,
            rawType: "SubModel",
            canonicalType: "submodel",
            fingerprint: displaySubmodelFingerprint(submodel: submodel),
            fingerprintVersion: "target-metadata-fingerprint-v1",
            parentId: parentId,
            parentName: parent.targetName
        )
        structure = DisplayModelIndexStructure(
            nodeCount: summary.nodeCoverage.nodeCount,
            positionX: parent.positionX,
            positionY: parent.positionY,
            positionZ: parent.positionZ,
            width: parent.width,
            height: parent.height,
            depth: parent.depth,
            submodelCount: 0,
            directGroupMembers: [],
            activeGroupMembers: [],
            flattenedGroupMembers: [],
            flattenedAllGroupMembers: [],
            submodelMetadata: summary,
            submodels: [],
            nodeLayout: nil,
            customStructure: nil
        )
    }
}

private struct DisplayModelIndexIdentity: Encodable {
    let displayName: String
    let rawType: String
    let canonicalType: String
    let fingerprint: String
    let fingerprintVersion: String
    let parentId: String?
    let parentName: String?

    init(
        displayName: String,
        rawType: String,
        canonicalType: String,
        fingerprint: String,
        fingerprintVersion: String,
        parentId: String? = nil,
        parentName: String? = nil
    ) {
        self.displayName = displayName
        self.rawType = rawType
        self.canonicalType = canonicalType
        self.fingerprint = fingerprint
        self.fingerprintVersion = fingerprintVersion
        self.parentId = parentId?.isEmpty == false ? parentId : nil
        self.parentName = parentName?.isEmpty == false ? parentName : nil
    }
}

private struct DisplayModelIndexStructure: Encodable {
    let nodeCount: Int
    let positionX: Double
    let positionY: Double
    let positionZ: Double
    let width: Double
    let height: Double
    let depth: Double
    let submodelCount: Int
    let directGroupMembers: [String]
    let activeGroupMembers: [String]
    let flattenedGroupMembers: [String]
    let flattenedAllGroupMembers: [String]
    let submodelMetadata: DisplaySubmodelSummary?
    let submodels: [DisplaySubmodelSummary]
    let nodeLayout: DisplayNodeLayoutMetadata?
    let customStructure: DisplayCustomModelStructure?

    init(
        nodeCount: Int,
        positionX: Double,
        positionY: Double,
        positionZ: Double,
        width: Double,
        height: Double,
        depth: Double,
        submodelCount: Int,
        directGroupMembers: [String],
        activeGroupMembers: [String],
        flattenedGroupMembers: [String],
        flattenedAllGroupMembers: [String],
        submodelMetadata: DisplaySubmodelSummary? = nil,
        submodels: [DisplaySubmodelSummary],
        nodeLayout: DisplayNodeLayoutMetadata?,
        customStructure: DisplayCustomModelStructure?
    ) {
        self.nodeCount = nodeCount
        self.positionX = positionX
        self.positionY = positionY
        self.positionZ = positionZ
        self.width = width
        self.height = height
        self.depth = depth
        self.submodelCount = submodelCount
        self.directGroupMembers = directGroupMembers
        self.activeGroupMembers = activeGroupMembers
        self.flattenedGroupMembers = flattenedGroupMembers
        self.flattenedAllGroupMembers = flattenedAllGroupMembers
        self.submodelMetadata = submodelMetadata
        self.submodels = submodels
        self.nodeLayout = nodeLayout
        self.customStructure = customStructure
    }
}

private struct DisplaySubmodelSummary: Encodable {
    let id: String?
    let name: String?
    let parentId: String?
    let type: String?
    let layoutGroup: String?
    let groupNames: [String]
    let startChannel: Int?
    let endChannel: Int?
    let lines: String?
    let siblingCount: Int
    let siblingIds: [String]
    let overlappingSiblingIds: [String]
    let overlapsSibling: Bool
    let nodeCoverage: DisplaySubmodelNodeCoverage
    let structureHints: [String]

    init(submodel: XLightsSubmodel, allSubmodels: [XLightsSubmodel] = [], parentNodeCount: Int? = nil) {
        let resolvedParentId = submodel.parentId ?? parentIdFromSubmodelId(submodel.id)
        let targetId = submodel.id ?? submodel.name ?? ""
        let siblings = allSubmodels
            .filter { ($0.parentId ?? parentIdFromSubmodelId($0.id)) == resolvedParentId }
            .filter { ($0.id ?? $0.name ?? "") != targetId }
            .sorted { lhs, rhs in
                (lhs.id ?? lhs.name ?? "").localizedCaseInsensitiveCompare(rhs.id ?? rhs.name ?? "") == .orderedAscending
            }
        let nodeMembership = normalizeSubmodelNodeMembership(submodel)
        let overlappingSiblings = siblings.filter { sibling in
            intersectionCount(nodeMembership, normalizeSubmodelNodeMembership(sibling)) > 0
        }
        let nodeCount = submodel.membership?.nodeCount ?? submodel.nodeCount ?? (nodeMembership.isEmpty ? nil : nodeMembership.count)

        id = submodel.id
        name = submodel.name
        parentId = resolvedParentId.isEmpty ? nil : resolvedParentId
        type = submodel.type
        layoutGroup = submodel.layoutGroup
        groupNames = submodel.groupNames ?? []
        startChannel = submodel.startChannel
        endChannel = submodel.endChannel
        lines = submodel.lines
        siblingCount = siblings.count
        siblingIds = siblings.compactMap { $0.id ?? $0.name }
        overlappingSiblingIds = overlappingSiblings.compactMap { $0.id ?? $0.name }
        overlapsSibling = !overlappingSiblingIds.isEmpty
        let coverage = DisplaySubmodelNodeCoverage(
            nodeCount: nodeCount ?? 0,
            parentNodeCount: parentNodeCount.flatMap { $0 > 0 ? $0 : nil },
            ratio: coverageRatio(nodeCount: nodeCount, parentNodeCount: parentNodeCount)
        )
        nodeCoverage = coverage
        structureHints = classifySubmodelStructureHints(
            submodel: submodel,
            siblingCount: siblings.count,
            overlapsSibling: !overlappingSiblings.isEmpty,
            nodeCoverage: coverage
        )
    }
}

private struct DisplaySubmodelNodeCoverage: Encodable {
    let nodeCount: Int
    let parentNodeCount: Int?
    let ratio: Double?
}

private extension DisplaySubmodelFactModel {
    init(submodel: XLightsSubmodel, allSubmodels: [XLightsSubmodel], parentNodeCount: Int?) {
        let summary = DisplaySubmodelSummary(submodel: submodel, allSubmodels: allSubmodels, parentNodeCount: parentNodeCount)
        self.init(
            id: summary.id ?? summary.name ?? "",
            name: summary.name ?? summary.id ?? "",
            parentId: summary.parentId ?? "",
            nodeCount: summary.nodeCoverage.nodeCount,
            parentNodeCount: summary.nodeCoverage.parentNodeCount,
            nodeCoverageRatio: summary.nodeCoverage.ratio,
            siblingCount: summary.siblingCount,
            siblingIds: summary.siblingIds,
            overlappingSiblingIds: summary.overlappingSiblingIds,
            structureHints: summary.structureHints
        )
    }
}

private struct DisplayNodeLayoutMetadata: Encodable {
    let source: String
    let nodeCount: Int
    let coordinateCoverage: DisplayNodeLayoutCoordinateCoverage
    let bufferExtents: DisplayNodeLayoutExtents2D?
    let worldExtents: DisplayNodeLayoutExtents3D?
    let samples: [DisplayNodeLayoutSample]

    init(layout: XLightsModelNodeLayout) {
        source = "layout.getModelNodes"
        nodeCount = layout.nodes.count
        coordinateCoverage = DisplayNodeLayoutCoordinateCoverage(nodes: layout.nodes)
        bufferExtents = DisplayNodeLayoutExtents2D.bufferExtents(from: layout.nodes)
        worldExtents = DisplayNodeLayoutExtents3D.worldExtents(from: layout.nodes)
        samples = layout.nodes.prefix(24).map(DisplayNodeLayoutSample.init(node:))
    }
}

private struct DisplayNodeLayoutCoordinateCoverage: Encodable {
    let bufferNodeCount: Int
    let worldNodeCount: Int
    let screenNodeCount: Int

    init(nodes: [XLightsModelNode]) {
        bufferNodeCount = nodes.filter { ($0.coords ?? []).contains { $0.buffer != nil } }.count
        worldNodeCount = nodes.filter { ($0.coords ?? []).contains { $0.world != nil } }.count
        screenNodeCount = nodes.filter { ($0.coords ?? []).contains { $0.screen != nil } }.count
    }
}

private struct DisplayNodeLayoutExtents2D: Encodable {
    let minX: Double
    let maxX: Double
    let minY: Double
    let maxY: Double

    static func bufferExtents(from nodes: [XLightsModelNode]) -> DisplayNodeLayoutExtents2D? {
        let points = nodes.flatMap { $0.coords ?? [] }.compactMap(\.buffer)
        let xs = points.compactMap(\.x)
        let ys = points.compactMap(\.y)
        guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() else { return nil }
        return DisplayNodeLayoutExtents2D(minX: minX, maxX: maxX, minY: minY, maxY: maxY)
    }
}

private struct DisplayNodeLayoutExtents3D: Encodable {
    let minX: Double
    let maxX: Double
    let minY: Double
    let maxY: Double
    let minZ: Double
    let maxZ: Double

    static func worldExtents(from nodes: [XLightsModelNode]) -> DisplayNodeLayoutExtents3D? {
        let points = nodes.flatMap { $0.coords ?? [] }.compactMap(\.world)
        let xs = points.compactMap(\.x)
        let ys = points.compactMap(\.y)
        let zs = points.compactMap(\.z)
        guard
            let minX = xs.min(), let maxX = xs.max(),
            let minY = ys.min(), let maxY = ys.max(),
            let minZ = zs.min(), let maxZ = zs.max()
        else { return nil }
        return DisplayNodeLayoutExtents3D(minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ)
    }
}

private struct DisplayNodeLayoutSample: Encodable {
    let nodeId: Int?
    let stringIndex: Int?
    let channelStart: Int?
    let channelCount: Int?
    let coordinateCount: Int
    let buffer: XLightsModelNodePoint2D?
    let world: XLightsModelNodePoint3D?

    init(node: XLightsModelNode) {
        nodeId = node.nodeId
        stringIndex = node.stringIndex
        channelStart = node.channelStart
        channelCount = node.channelCount
        coordinateCount = node.coords?.count ?? 0
        buffer = node.coords?.compactMap(\.buffer).first
        world = node.coords?.compactMap(\.world).first
    }
}

private struct DisplayCustomModelStructure: Encodable {
    let profile: String
    let nodeCount: Int
    let traits: [String]
    let construction: DisplayCustomModelConstruction
    let source: String
    let submodels: DisplayCustomModelSubmodels
    let customModelParsed: Bool?
    let confidence: Double

    init(row: DisplayLayoutRowModel, nodeLayout: XLightsModelNodeLayout?, submodels: [XLightsSubmodel]) {
        let inference = inferCustomModelStructure(row: row, submodels: submodels)
        profile = inference.profile
        nodeCount = row.nodeCount
        traits = inference.traits
        source = nodeLayout == nil ? "layout.getModels" : "layout.getModelNodes"
        construction = DisplayCustomModelConstruction(row: row, nodeLayout: nodeLayout)
        self.submodels = DisplayCustomModelSubmodels(row: row, submodels: submodels)
        customModelParsed = nodeLayout?.source?.customModelParsed
        confidence = inference.confidence
    }
}

private struct DisplayCustomModelConstruction: Encodable {
    let source: String
    let nodeMap: DisplayNodeLayoutMetadata?
    let submodelsCaptured: Int

    init(row: DisplayLayoutRowModel, nodeLayout: XLightsModelNodeLayout?) {
        source = nodeLayout == nil ? "layout.getModels" : "layout.getModelNodes"
        nodeMap = nodeLayout.map(DisplayNodeLayoutMetadata.init(layout:))
        submodelsCaptured = row.submodelCount
    }
}

private struct DisplayCustomModelSubmodels: Encodable {
    let count: Int
    let capturedCount: Int
    let names: [String]
    let details: [DisplaySubmodelSummary]

    init(row: DisplayLayoutRowModel, submodels: [XLightsSubmodel]) {
        count = row.submodelCount
        capturedCount = submodels.count
        names = submodels.compactMap { $0.name ?? $0.id }
        details = submodels.map { submodel in
            DisplaySubmodelSummary(submodel: submodel, allSubmodels: submodels, parentNodeCount: row.nodeCount)
        }
    }
}
