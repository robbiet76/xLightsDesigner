import Foundation

protocol DisplayService: Sendable {
    func loadDisplay(for project: ActiveProjectModel?) async throws -> DisplayServiceResult
    func addTag(for project: ActiveProjectModel?, targetIDs: [String], tagName: String, description: String) async throws
    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws
    func saveTagDefinition(for project: ActiveProjectModel?, tagID: String?, name: String, description: String, color: DisplayLabelColor) async throws
    func deleteTagDefinition(for project: ActiveProjectModel?, tagID: String) async throws
}

struct DisplayServiceResult: Sendable {
    let readiness: DisplayReadinessSummaryModel
    let rows: [DisplayLayoutRowModel]
    let sourceSummary: String
    let banners: [DisplayBannerModel]
    let labelDefinitions: [DisplayLabelDefinitionModel]
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
                nextStep = "Switch xLights to the project's show folder or change the project show folder."
                banners.append(DisplayBannerModel(
                    id: "show-mismatch",
                    state: .blocked,
                    text: "xLights show folder: \(currentMedia.showDirectory.isEmpty ? "(not set)" : currentMedia.showDirectory)\nProject show folder: \(project?.showFolder.isEmpty == false ? project!.showFolder : "(not set)")"
                ))
            } else {
                async let modelsTask = fetchModels()
                async let groupMembershipsTask = fetchGroupMemberships()
                let models = try await modelsTask
                let groupMemberships = try await groupMembershipsTask
                rows = models
                    .map { makeRow(from: $0, groupMemberships: groupMemberships, document: metadataDocument, labelDefinitionsByID: labelDefinitionsByID) }
                    .sorted { $0.targetName.localizedCaseInsensitiveCompare($1.targetName) == .orderedAscending }
                taggedCount = rows.filter { !$0.labelDefinitions.isEmpty }.count
                unresolvedCount = rows.count - taggedCount

                if unresolvedCount > 0 {
                    state = .needsReview
                    explanation = unresolvedCount == rows.count
                        ? "No display metadata has been confirmed yet."
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
            nextStep = "Correct the xLights show folder in Project, then return to Display."
            banners.append(DisplayBannerModel(id: "project-context", state: .blocked, text: "xLights show folder must be corrected in Project."))
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
            labelDefinitions: labelDefinitions.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
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
}

private struct XLightsHealthResponse: Decodable {
    let data: XLightsHealth
}

private struct XLightsHealth: Decodable {
    let listenerReachable: Bool
}

private struct XLightsLayoutResponse: Decodable {
    let data: XLightsLayoutData
}

private struct XLightsCurrentMediaResponse: Decodable {
    let data: XLightsCurrentMedia
}

private struct XLightsCurrentMedia: Decodable {
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

private struct XLightsGroupMembership: Decodable {
    let groupName: String
    let directMembers: [XLightsGroupMember]
    let activeMembers: [XLightsGroupMember]
    let flattenedMembers: [XLightsGroupMember]
    let flattenedAllMembers: [XLightsGroupMember]
}

private struct XLightsGroupMember: Decodable {
    let name: String
}

private struct XLightsLayoutModel: Decodable {
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
