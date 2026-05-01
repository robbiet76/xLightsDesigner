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
                    .map { makeRow(from: $0, groupMemberships: groupMemberships, document: metadataDocument, labelDefinitionsByID: labelDefinitionsByID) }
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
            flattenedAllGroupMembers: membership?.flattenedAllMembers.map(\.name) ?? []
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
    let artifact = DisplayModelIndexArtifact(
        artifactType: "target_metadata_index_v1",
        artifactVersion: "1.0",
        createdAt: createdAt,
        source: DisplayModelIndexSource(source: sourceSummary),
        summary: DisplayModelIndexSummary(
            targetCount: rows.count,
            modelCount: rows.filter { !$0.targetType.localizedCaseInsensitiveContains("modelgroup") }.count,
            groupCount: rows.filter { $0.targetType.localizedCaseInsensitiveContains("modelgroup") }.count,
            submodelCount: rows.reduce(0) { $0 + $1.submodelCount }
        ),
        records: rows.map {
            DisplayModelIndexRecord(
                row: $0,
                nodeLayout: nodeLayoutsByModel[$0.targetName],
                submodels: submodelsByParent[$0.targetName] ?? []
            )
        }
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

struct DisplayCustomModelInference: Equatable {
    let profile: String
    let traits: [String]
    let trainingBuckets: [String]
    let confidence: Double
}

func inferCustomModelStructure(row: DisplayLayoutRowModel, submodels: [XLightsSubmodel]) -> DisplayCustomModelInference {
    let modelName = row.targetName.lowercased()
    let semanticCounts = customSubmodelSemanticCounts(submodels)
    var traits = ["custom_model"]
    var buckets: [String] = []
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
        buckets.append(contentsOf: ["single_line", "cane"])
        confidence = max(confidence, 0.6)
    }
    if modelName.contains("cane") {
        profile = "custom_linear_like"
        traits.append(contentsOf: ["custom_linear_like", "linear_like", "name_hint_cane"])
        buckets.append(contentsOf: ["single_line", "cane"])
        confidence = max(confidence, 0.68)
    }
    if modelName.contains("spinner") {
        profile = "custom_radial_like"
        traits.append(contentsOf: ["custom_radial_like", "radial_like", "name_hint_spinner"])
        buckets.append("spinner")
        confidence = max(confidence, 0.62)
    }
    if modelName.contains("star") || modelName.contains("flake") {
        profile = "custom_radial_like"
        traits.append(contentsOf: ["custom_radial_like", "radial_like", "name_hint_star"])
        buckets.append("star")
        confidence = max(confidence, 0.62)
    }
    if semanticCounts.spoke >= 4 || semanticCounts.ring >= 2 {
        profile = "custom_radial_like"
        traits.append(contentsOf: ["spoke_submodels", "ring_submodels", "custom_radial_submodels", "custom_radial_like", "radial_like"])
        buckets.append("spinner")
        confidence = max(confidence, 0.65)
    }
    if semanticCounts.layer >= 2 {
        traits.append("layered_submodels")
    }
    if semanticCounts.eye > 0 && semanticCounts.mouth > 0 {
        profile = "custom_face_like"
        traits.append(contentsOf: ["face_submodels", "custom_face_like"])
        buckets.removeAll()
        confidence = max(confidence, 0.7)
    }

    return DisplayCustomModelInference(
        profile: profile,
        traits: uniqueStrings(traits),
        trainingBuckets: uniqueStrings(buckets),
        confidence: confidence
    )
}

private func customSubmodelSemanticCounts(_ submodels: [XLightsSubmodel]) -> (eye: Int, mouth: Int, spoke: Int, ring: Int, layer: Int) {
    var counts = (eye: 0, mouth: 0, spoke: 0, ring: 0, layer: 0)
    for submodel in submodels {
        let name = (submodel.name ?? submodel.id ?? "").lowercased()
        if name.contains("eye") || name.contains("blink") {
            counts.eye += 1
        }
        if name.contains("mouth") || name.contains("phoneme") || name.contains("viseme") {
            counts.mouth += 1
        }
        if name.contains("spoke") || name.contains("arm") {
            counts.spoke += 1
        }
        if name.contains("circle") || name.contains("ring") {
            counts.ring += 1
        }
        if name.contains("outer") || name.contains("middle") || name.contains("inner") || name.contains("layer") {
            counts.layer += 1
        }
    }
    return counts
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
            canonicalType: row.targetType
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
            submodels: submodels.map(DisplaySubmodelSummary.init(submodel:)),
            nodeLayout: nodeLayout.map(DisplayNodeLayoutMetadata.init(layout:)),
            customStructure: isCustomModelType(row.targetType)
                ? DisplayCustomModelStructure(row: row, nodeLayout: nodeLayout, submodels: submodels)
                : nil
        )
    }
}

private struct DisplayModelIndexIdentity: Encodable {
    let displayName: String
    let rawType: String
    let canonicalType: String
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
    let submodels: [DisplaySubmodelSummary]
    let nodeLayout: DisplayNodeLayoutMetadata?
    let customStructure: DisplayCustomModelStructure?
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

    init(submodel: XLightsSubmodel) {
        id = submodel.id
        name = submodel.name
        parentId = submodel.parentId
        type = submodel.type
        layoutGroup = submodel.layoutGroup
        groupNames = submodel.groupNames ?? []
        startChannel = submodel.startChannel
        endChannel = submodel.endChannel
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
    let trainingBuckets: [String]
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
        trainingBuckets = inference.trainingBuckets
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
        details = submodels.map(DisplaySubmodelSummary.init(submodel:))
    }
}
