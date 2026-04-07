import Foundation

protocol LayoutService: Sendable {
    func loadLayout(for project: ActiveProjectModel?) async throws -> LayoutServiceResult
}

struct LayoutServiceResult: Sendable {
    let readiness: LayoutReadinessSummaryModel
    let rows: [LayoutRowModel]
    let sourceSummary: String
    let banners: [LayoutBannerModel]
}

struct XLightsLayoutService: LayoutService {
    func loadLayout(for project: ActiveProjectModel?) async throws -> LayoutServiceResult {
        let health = try await fetchHealth()
        let models = try await fetchModels()
        let rows = models.map(makeRow).sorted { $0.targetName.localizedCaseInsensitiveCompare($1.targetName) == .orderedAscending }

        let validProject = project.flatMap { validateProjectContext($0) }
        let readyCount = rows.filter { $0.supportStateSummary == "Assigned" }.count
        let unresolvedCount = rows.filter { $0.supportStateSummary != "Assigned" }.count
        let explanation: String
        let nextStep: String
        let state: LayoutReadinessState
        var banners: [LayoutBannerModel] = []

        if let validProject {
            if unresolvedCount > 0 {
                state = .needsReview
                explanation = "\(unresolvedCount) targets still need layout review."
                nextStep = validProject
            } else {
                state = .ready
                explanation = "Layout is available and current targets are assigned."
                nextStep = "Review targets that matter most for sequencing."
            }
        } else {
            state = .blocked
            explanation = "Project context is incomplete or invalid."
            nextStep = "Correct the show folder in Project, then return to Layout."
            banners.append(LayoutBannerModel(id: "project-context", state: .blocked, text: "Show folder reference must be corrected in Project."))
        }

        if !health.listenerReachable {
            banners.append(LayoutBannerModel(id: "xlights-unreachable", state: .blocked, text: "xLights owned API is not reachable."))
        }

        return LayoutServiceResult(
            readiness: LayoutReadinessSummaryModel(
                state: state,
                totalTargets: rows.count,
                readyCount: readyCount,
                unresolvedCount: unresolvedCount,
                orphanCount: 0,
                explanationText: explanation,
                nextStepText: nextStep
            ),
            rows: rows,
            sourceSummary: health.listenerReachable ? "xLights owned API" : "No live xLights source",
            banners: banners
        )
    }

    private func validateProjectContext(_ project: ActiveProjectModel) -> String? {
        let showFolder = project.showFolder.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !showFolder.isEmpty else { return nil }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: showFolder, isDirectory: &isDirectory), isDirectory.boolValue else { return nil }
        return "Layout review can proceed inside the active project context."
    }

    private func makeRow(from model: XLightsLayoutModel) -> LayoutRowModel {
        let isUnassigned = model.layoutGroup.caseInsensitiveCompare("Unassigned") == .orderedSame
        return LayoutRowModel(
            id: model.name,
            targetName: model.name,
            targetType: model.displayAs,
            tagSummary: model.layoutGroup,
            assignmentSummary: isUnassigned ? "Unassigned group" : "\(model.layoutGroup) group",
            supportStateSummary: isUnassigned ? "Unassigned" : "Assigned",
            issuesSummary: isUnassigned ? "Unassigned layout group" : "No issues detected",
            actionSummaryText: isUnassigned ? "Review assignment" : "No action needed",
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
