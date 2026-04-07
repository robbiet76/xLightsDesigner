import Foundation

protocol LayoutService: Sendable {
    func loadLayout(for project: ActiveProjectModel?) async throws -> LayoutServiceResult
    func addTag(for project: ActiveProjectModel?, targetIDs: [String], tagName: String, description: String) async throws
    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws
    func saveTagDefinition(for project: ActiveProjectModel?, tagID: String?, name: String, description: String, color: LayoutTagColor) async throws
    func deleteTagDefinition(for project: ActiveProjectModel?, tagID: String) async throws
}

struct LayoutServiceResult: Sendable {
    let readiness: LayoutReadinessSummaryModel
    let rows: [LayoutRowModel]
    let sourceSummary: String
    let banners: [LayoutBannerModel]
    let tagDefinitions: [LayoutTagDefinitionModel]
}

enum LayoutServiceError: LocalizedError {
    case noActiveProject

    var errorDescription: String? {
        switch self {
        case .noActiveProject:
            return "Open a project before editing layout tags."
        }
    }
}

struct XLightsLayoutService: LayoutService {
    private let metadataStore: LayoutMetadataStore

    init(metadataStore: LayoutMetadataStore = LocalLayoutMetadataStore()) {
        self.metadataStore = metadataStore
    }

    func loadLayout(for project: ActiveProjectModel?) async throws -> LayoutServiceResult {
        let health = try? await fetchHealth()
        let validProject = project.flatMap(validateProjectContext)
        let currentMedia = try? await fetchCurrentMedia()

        let metadataDocument: PersistedLayoutMetadataDocument
        if let project {
            metadataDocument = (try? metadataStore.load(for: project)) ?? PersistedLayoutMetadataDocument()
        } else {
            metadataDocument = PersistedLayoutMetadataDocument()
        }

        let usageByTagID = metadataDocument.targetTags.values.reduce(into: [String: Int]()) { result, ids in
            for id in ids {
                result[id, default: 0] += 1
            }
        }
        let tagDefinitions = metadataDocument.tags.map {
            LayoutTagDefinitionModel(
                id: $0.id,
                name: $0.name,
                description: $0.description,
                usageCount: usageByTagID[$0.id, default: 0],
                color: LayoutTagColor(rawValue: $0.colorName ?? "") ?? .none
            )
        }
        let tagDefinitionsByID = Dictionary(uniqueKeysWithValues: tagDefinitions.map { ($0.id, $0) })
        let explanation: String
        let nextStep: String
        let state: LayoutReadinessState
        var banners: [LayoutBannerModel] = []
        let rows: [LayoutRowModel]
        let taggedCount: Int
        let unresolvedCount: Int

        if health?.listenerReachable != true {
            rows = []
            taggedCount = 0
            unresolvedCount = 0
            state = .blocked
            explanation = "Layout needs a live xLights session to load the current models."
            nextStep = "Open xLights to this project's show folder, then return to Layout."
            banners.append(LayoutBannerModel(
                id: "xlights-required",
                state: .blocked,
                text: "xLights is closed or its owned API is unavailable. Layout reads the live model list from xLights."
            ))
        } else if let validProject {
            if let currentMedia, !showDirectoryMatchesProject(currentMedia.showDirectory, projectShowFolder: project?.showFolder ?? "") {
                rows = []
                taggedCount = 0
                unresolvedCount = 0
                state = .blocked
                explanation = "xLights is currently open to a different show folder than the active project."
                nextStep = "Switch xLights to the project's show folder or change the project show folder."
                banners.append(LayoutBannerModel(
                    id: "show-mismatch",
                    state: .blocked,
                    text: "xLights show folder: \(currentMedia.showDirectory.isEmpty ? "(not set)" : currentMedia.showDirectory)\nProject show folder: \(project?.showFolder.isEmpty == false ? project!.showFolder : "(not set)")"
                ))
            } else {
                let models = try await fetchModels()
                rows = models
                    .map { makeRow(from: $0, document: metadataDocument, tagDefinitionsByID: tagDefinitionsByID) }
                    .sorted { $0.targetName.localizedCaseInsensitiveCompare($1.targetName) == .orderedAscending }
                taggedCount = rows.filter { !$0.tagDefinitions.isEmpty }.count
                unresolvedCount = rows.count - taggedCount

                if unresolvedCount > 0 {
                    state = .needsReview
                    explanation = unresolvedCount == rows.count
                        ? "No project tags have been applied yet."
                        : "\(unresolvedCount) targets still need semantic tags."
                    nextStep = validProject
                } else {
                    state = .ready
                    explanation = "Project layout tags are in place for the current target set."
                    nextStep = "Refine tags where needed or continue into design and sequencing."
                }
            }
        } else {
            rows = []
            taggedCount = 0
            unresolvedCount = 0
            state = .blocked
            explanation = "Project context is incomplete or invalid."
            nextStep = "Correct the xLights show folder in Project, then return to Layout."
            banners.append(LayoutBannerModel(id: "project-context", state: .blocked, text: "xLights show folder must be corrected in Project."))
        }

        if health?.listenerReachable == false {
            banners.append(LayoutBannerModel(id: "xlights-unreachable", state: .blocked, text: "xLights owned API is not reachable."))
        }

        return LayoutServiceResult(
            readiness: LayoutReadinessSummaryModel(
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
            tagDefinitions: tagDefinitions.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
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
        guard let project else { throw LayoutServiceError.noActiveProject }
        try metadataStore.createOrAssignTag(project: project, targetIDs: targetIDs, tagName: tagName, description: description)
    }

    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws {
        guard let project else { throw LayoutServiceError.noActiveProject }
        try metadataStore.removeTag(project: project, targetIDs: targetIDs, tagID: tagID)
    }

    func saveTagDefinition(for project: ActiveProjectModel?, tagID: String?, name: String, description: String, color: LayoutTagColor) async throws {
        guard let project else { throw LayoutServiceError.noActiveProject }
        try metadataStore.updateTagDefinition(
            project: project,
            tagID: tagID,
            name: name,
            description: description,
            colorName: color == .none ? nil : color.rawValue
        )
    }

    func deleteTagDefinition(for project: ActiveProjectModel?, tagID: String) async throws {
        guard let project else { throw LayoutServiceError.noActiveProject }
        try metadataStore.deleteTagDefinition(project: project, tagID: tagID)
    }

    private func validateProjectContext(_ project: ActiveProjectModel) -> String? {
        let showFolder = project.showFolder.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !showFolder.isEmpty else { return nil }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: showFolder, isDirectory: &isDirectory), isDirectory.boolValue else { return nil }
        return "Use tags to describe how the current xLights targets should be used downstream."
    }

    private func makeRow(
        from model: XLightsLayoutModel,
        document: PersistedLayoutMetadataDocument,
        tagDefinitionsByID: [String: LayoutTagDefinitionModel]
    ) -> LayoutRowModel {
        let assignedTagIDs = document.targetTags[model.name] ?? []
        let assignedTags = assignedTagIDs
            .compactMap { tagDefinitionsByID[$0] }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }

        return LayoutRowModel(
            id: model.name,
            targetName: model.name,
            targetType: model.displayAs,
            layoutGroup: model.layoutGroup,
            tagDefinitions: assignedTags,
            supportStateSummary: assignedTags.isEmpty ? "Needs Tags" : "Tagged",
            issuesSummary: assignedTags.isEmpty ? "No project tags assigned" : "No issues detected",
            submodelCount: model.submodelCount
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

private struct XLightsLayoutModel: Decodable {
    let displayAs: String
    let layoutGroup: String
    let name: String
    let submodelCount: Int
}
