import AppKit
import Foundation
import Observation

@MainActor
@Observable
final class HistoryScreenViewModel {
    private let workspace: ProjectWorkspace
    private let historyService: HistoryService

    var searchQuery = ""
    var selectedRowID: HistoryRowModel.ID?
    var screenModel = HistoryScreenModel(
        header: HistoryHeaderModel(title: "History", subtitle: "Browse retrospective revisions and previously applied changes.", activeProjectName: "No Project"),
        summary: HistorySummaryModel(totalEventCount: 0, latestEventSummary: "No history available.", latestEventTimestamp: "", groupedTypeSummaries: []),
        rows: [],
        selectedEvent: .none("Select a historical event to inspect details."),
        banners: []
    )
    private var detailsByID: [String: HistorySelectedEventModel] = [:]

    init(workspace: ProjectWorkspace, historyService: HistoryService = LocalHistoryService()) {
        self.workspace = workspace
        self.historyService = historyService
    }

    var filteredRows: [HistoryRowModel] {
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !query.isEmpty else { return screenModel.rows }
        return screenModel.rows.filter {
            $0.eventType.lowercased().contains(query) ||
            $0.summary.lowercased().contains(query) ||
            $0.sequenceSummary.lowercased().contains(query) ||
            $0.resultSummary.lowercased().contains(query)
        }
    }

    func loadHistory() {
        do {
            let result = try historyService.loadHistory(for: workspace.activeProject)
            let selected = selectedRowID.flatMap { id in result.rows.contains(where: { $0.id == id }) ? id : nil } ?? result.rows.first?.id
            detailsByID = result.detailsByID
            screenModel = HistoryScreenModel(
                header: HistoryHeaderModel(
                    title: "History",
                    subtitle: "Browse retrospective revisions and previously applied changes.",
                    activeProjectName: workspace.activeProject?.projectName ?? "No Project"
                ),
                summary: result.summary,
                rows: result.rows,
                selectedEvent: result.rows.isEmpty ? .none("No retrospective history exists for the current project yet.") : .none("Select a historical event to inspect details."),
                banners: result.banners
            )
            selectRow(id: selected)
        } catch {
            screenModel = HistoryScreenModel(
                header: HistoryHeaderModel(title: "History", subtitle: "Browse retrospective revisions and previously applied changes.", activeProjectName: workspace.activeProject?.projectName ?? "No Project"),
                summary: HistorySummaryModel(totalEventCount: 0, latestEventSummary: "History could not be loaded.", latestEventTimestamp: "", groupedTypeSummaries: []),
                rows: [],
                selectedEvent: .error(String(error.localizedDescription)),
                banners: [WorkflowBannerModel(id: "history-load-failed", text: String(error.localizedDescription), state: .blocked)]
            )
            detailsByID = [:]
        }
    }

    func selectRow(id: HistoryRowModel.ID?) {
        selectedRowID = id
        guard let id, let detail = detailsByID[id] else {
            screenModel = HistoryScreenModel(
                header: screenModel.header,
                summary: screenModel.summary,
                rows: screenModel.rows,
                selectedEvent: screenModel.rows.isEmpty ? .none("No retrospective history exists for the current project yet.") : .none("Select a historical event to inspect details."),
                banners: screenModel.banners
            )
            return
        }
        screenModel = HistoryScreenModel(
            header: screenModel.header,
            summary: screenModel.summary,
            rows: screenModel.rows,
            selectedEvent: .selected(detail),
            banners: screenModel.banners
        )
    }

    func revealSelectedArtifact() {
        guard case let .selected(detail) = screenModel.selectedEvent,
              let artifactPath = detail.artifactPath,
              !artifactPath.isEmpty else { return }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: artifactPath)])
    }
}
