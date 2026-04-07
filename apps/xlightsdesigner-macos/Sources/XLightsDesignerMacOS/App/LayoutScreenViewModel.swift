import Foundation
import Observation

@MainActor
@Observable
final class LayoutScreenViewModel {
    private let workspace: ProjectWorkspace
    private let layoutService: LayoutService

    var searchQuery = ""
    var selectedRowID: LayoutRowModel.ID?
    var screenModel = LayoutScreenModel(
        header: LayoutHeaderModel(title: "Layout", subtitle: "Review target readiness and assignments for the active project.", activeProjectName: "No Project", sourceSummary: ""),
        readinessSummary: LayoutReadinessSummaryModel(state: .blocked, totalTargets: 0, readyCount: 0, unresolvedCount: 0, orphanCount: 0, explanationText: "No active project.", nextStepText: "Create or open a project first."),
        rows: [],
        selectedTarget: .none("Select a target to inspect readiness."),
        banners: []
    )

    init(workspace: ProjectWorkspace, layoutService: LayoutService = XLightsLayoutService()) {
        self.workspace = workspace
        self.layoutService = layoutService
    }

    var filteredRows: [LayoutRowModel] {
        guard !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return screenModel.rows }
        let q = searchQuery.lowercased()
        return screenModel.rows.filter {
            $0.targetName.lowercased().contains(q) ||
            $0.targetType.lowercased().contains(q) ||
            $0.tagSummary.lowercased().contains(q) ||
            $0.assignmentSummary.lowercased().contains(q) ||
            $0.supportStateSummary.lowercased().contains(q)
        }
    }

    func loadLayout() {
        let activeProject = workspace.activeProject
        Task {
            do {
                let result = try await layoutService.loadLayout(for: activeProject)
                let rows = result.rows
                let selected = selectedRowID.flatMap { id in rows.contains(where: { $0.id == id }) ? id : nil } ?? rows.first?.id
                screenModel = LayoutScreenModel(
                    header: LayoutHeaderModel(
                        title: "Layout",
                        subtitle: "Review target readiness and assignments for the active project.",
                        activeProjectName: workspace.activeProject?.projectName ?? "No Project",
                        sourceSummary: result.sourceSummary
                    ),
                    readinessSummary: result.readiness,
                    rows: rows,
                    selectedTarget: .none("Select a target to inspect readiness."),
                    banners: result.banners
                )
                selectRow(id: selected)
            } catch {
                screenModel = LayoutScreenModel(
                    header: LayoutHeaderModel(title: "Layout", subtitle: "Review target readiness and assignments for the active project.", activeProjectName: workspace.activeProject?.projectName ?? "No Project", sourceSummary: "xLights owned API"),
                    readinessSummary: LayoutReadinessSummaryModel(state: .blocked, totalTargets: 0, readyCount: 0, unresolvedCount: 0, orphanCount: 0, explanationText: "Layout could not be loaded.", nextStepText: "Check that xLights is running and reachable."),
                    rows: [],
                    selectedTarget: .error(String(error.localizedDescription)),
                    banners: [LayoutBannerModel(id: "load-failed", state: .blocked, text: String(error.localizedDescription))]
                )
            }
        }
    }

    func selectRow(id: LayoutRowModel.ID?) {
        selectedRowID = id
        guard let id, let row = screenModel.rows.first(where: { $0.id == id }) else {
            screenModel = LayoutScreenModel(
                header: screenModel.header,
                readinessSummary: screenModel.readinessSummary,
                rows: screenModel.rows,
                selectedTarget: .none("Select a target to inspect readiness."),
                banners: screenModel.banners
            )
            return
        }
        let state: LayoutReadinessState = row.supportStateSummary == "Assigned" ? .ready : .needsReview
        let selected = LayoutSelectedTargetModel(
            identity: row.targetName,
            type: row.targetType,
            sourcePathSummary: screenModel.header.sourceSummary,
            readinessState: state,
            reason: row.issuesSummary,
            recommendedAction: row.actionSummaryText,
            currentTags: row.tagSummary,
            assignmentSummary: row.assignmentSummary,
            downstreamEffectSummary: row.submodelCount > 0 ? "\(row.submodelCount) submodels available for downstream sequencing context." : "No submodels reported for this target."
        )
        screenModel = LayoutScreenModel(
            header: screenModel.header,
            readinessSummary: screenModel.readinessSummary,
            rows: screenModel.rows,
            selectedTarget: .selected(selected),
            banners: screenModel.banners
        )
    }
}
