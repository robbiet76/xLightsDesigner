import Foundation

protocol LayoutService: Sendable {
    func loadLayout(for project: ActiveProjectModel?) async throws -> LayoutServiceResult
    func addTag(for project: ActiveProjectModel?, targetIDs: [String], tagName: String, description: String) async throws
    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws
    func saveTagDefinition(for project: ActiveProjectModel?, tagID: String?, name: String, description: String) async throws
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
        let health = try await fetchHealth()
        let models = try await fetchModels()
        let validProject = project.flatMap(validateProjectContext)

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
                usageCount: usageByTagID[$0.id, default: 0]
            )
        }
        let tagDefinitionsByID = Dictionary(uniqueKeysWithValues: tagDefinitions.map { ($0.id, $0) })

        let rows = models
            .map { makeRow(from: $0, document: metadataDocument, tagDefinitionsByID: tagDefinitionsByID) }
            .sorted { $0.targetName.localizedCaseInsensitiveCompare($1.targetName) == .orderedAscending }

        let taggedCount = rows.filter { !$0.tagDefinitions.isEmpty }.count
        let unresolvedCount = rows.count - taggedCount
        let explanation: String
        let nextStep: String
        let state: LayoutReadinessState
        var banners: [LayoutBannerModel] = []

        if let validProject {
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
        } else {
            state = .blocked
            explanation = "Project context is incomplete or invalid."
            nextStep = "Correct the xLights show folder in Project, then return to Layout."
            banners.append(LayoutBannerModel(id: "project-context", state: .blocked, text: "xLights show folder must be corrected in Project."))
        }

        if !health.listenerReachable {
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
            sourceSummary: health.listenerReachable ? "xLights owned API" : "No live xLights source",
            banners: banners,
            tagDefinitions: tagDefinitions.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        )
    }

    func addTag(for project: ActiveProjectModel?, targetIDs: [String], tagName: String, description: String) async throws {
        guard let project else { throw LayoutServiceError.noActiveProject }
        try metadataStore.createOrAssignTag(project: project, targetIDs: targetIDs, tagName: tagName, description: description)
    }

    func removeTag(for project: ActiveProjectModel?, targetIDs: [String], tagID: String) async throws {
        guard let project else { throw LayoutServiceError.noActiveProject }
        try metadataStore.removeTag(project: project, targetIDs: targetIDs, tagID: tagID)
    }

    func saveTagDefinition(for project: ActiveProjectModel?, tagID: String?, name: String, description: String) async throws {
        guard let project else { throw LayoutServiceError.noActiveProject }
        try metadataStore.updateTagDefinition(project: project, tagID: tagID, name: name, description: description)
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

private struct XLightsLayoutData: Decodable {
    let models: [XLightsLayoutModel]
}

private struct XLightsLayoutModel: Decodable {
    let displayAs: String
    let layoutGroup: String
    let name: String
    let submodelCount: Int
}
