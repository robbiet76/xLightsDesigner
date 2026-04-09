import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
final class DisplayScreenViewModel {
    private let workspace: ProjectWorkspace
    private let displayService: DisplayService
    private let displayDiscoveryStore: DisplayDiscoveryStateStore

    var targetFilter = ""
    var typeFilter = ""
    var categoryFilter = ""
    var valueFilter = ""
    var statusFilter = ""
    var sortOrder = [KeyPathComparator(\DisplayMetadataRowModel.subject, order: .forward)]
    var selectedRowIDs = Set<DisplayMetadataRowModel.ID>()
    var screenModel = DisplayScreenModel(
        header: DisplayHeaderModel(
            title: "Display",
            subtitle: "Create and maintain project display metadata grounded in the active xLights layout.",
            activeProjectName: "No Project",
            sourceSummary: ""
        ),
        readinessSummary: DisplayReadinessSummaryModel(
            state: .blocked,
            totalTargets: 0,
            readyCount: 0,
            unresolvedCount: 0,
            orphanCount: 0,
            explanationText: "No active project.",
            nextStepText: "Create or open a project first."
        ),
        rows: [],
        metadataRows: [],
        selectedMetadata: .none("Select one metadata entry to inspect."),
        banners: [],
        labelDefinitions: [],
        discoveryProposals: [],
        openQuestions: []
    )

    var errorMessage: String?
    var showDiscoveryProposalSheet = false

    init(
        workspace: ProjectWorkspace,
        displayService: DisplayService = XLightsDisplayService(),
        displayDiscoveryStore: DisplayDiscoveryStateStore = LocalDisplayDiscoveryStateStore()
    ) {
        self.workspace = workspace
        self.displayService = displayService
        self.displayDiscoveryStore = displayDiscoveryStore
    }

    var discoveryProposals: [DisplayDiscoveryTagProposalModel] {
        screenModel.discoveryProposals
    }

    var filteredRows: [DisplayMetadataRowModel] {
        let target = targetFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let type = typeFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let category = categoryFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let value = valueFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let status = statusFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        var rows = screenModel.metadataRows.filter {
            (target.isEmpty || $0.subject.lowercased().contains(target)) &&
            (type.isEmpty || $0.subjectType.lowercased().contains(type)) &&
            (category.isEmpty || $0.category.lowercased().contains(category)) &&
            (value.isEmpty || $0.value.lowercased().contains(value) || $0.rationale.lowercased().contains(value)) &&
            (status.isEmpty || $0.status.rawValue.lowercased().contains(status) || $0.source.rawValue.lowercased().contains(status))
        }
        rows.sort(using: sortOrder)
        return rows
    }

    var hasActiveFilters: Bool {
        !targetFilter.isEmpty || !typeFilter.isEmpty || !categoryFilter.isEmpty || !valueFilter.isEmpty || !statusFilter.isEmpty
    }

    func clearFilters() {
        targetFilter = ""
        typeFilter = ""
        categoryFilter = ""
        valueFilter = ""
        statusFilter = ""
    }

    func updateSortOrder(_ order: [KeyPathComparator<DisplayMetadataRowModel>]) {
        sortOrder = order
    }

    func syncSelectionToVisibleRows() {
        let visibleIDs = Set(filteredRows.map(\.id))
        selectedRowIDs = selectedRowIDs.intersection(visibleIDs)
        if selectedRowIDs.isEmpty, let first = filteredRows.first {
            selectedRowIDs = [first.id]
        }
        syncSelectedMetadata()
    }

    var selectedMetadataRows: [DisplayMetadataRowModel] {
        screenModel.metadataRows.filter { selectedRowIDs.contains($0.id) }
    }

    var confirmedMetadataCount: Int {
        screenModel.metadataRows.filter { $0.status == .confirmed }.count
    }

    var proposedMetadataCount: Int {
        screenModel.metadataRows.filter { $0.status == .proposed }.count
    }

    var linkedTargetCoverageCount: Int {
        let names = Set(screenModel.metadataRows.flatMap(\.linkedTargets))
        return screenModel.rows.filter { names.contains($0.targetName) }.count
    }

    var selectedLinkedTargets: [DisplayLayoutRowModel] {
        let names = Set(selectedLinkedTargetNames)
        return screenModel.rows.filter { names.contains($0.targetName) }
    }

    private var selectedLinkedTargetNames: [String] {
        selectedMetadataRows.flatMap(\.linkedTargets)
    }

    func loadDisplay() {
        let activeProject = workspace.activeProject
        Task {
            do {
                let result = try await displayService.loadDisplay(for: activeProject)
                let discoverySummary = displayDiscoveryStore.summary(for: activeProject)
                let metadataRows = buildMetadataRows(displayRows: result.rows, discoverySummary: discoverySummary)
                let validSelection = selectedRowIDs.intersection(Set(metadataRows.map(\.id)))
                if validSelection.isEmpty, let first = metadataRows.first {
                    selectedRowIDs = [first.id]
                } else {
                    selectedRowIDs = validSelection
                }

                screenModel = DisplayScreenModel(
                    header: DisplayHeaderModel(
                        title: "Display",
                        subtitle: "Review and manage the display metadata the agents are learning from your layout.",
                        activeProjectName: workspace.activeProject?.projectName ?? "No Project",
                        sourceSummary: result.sourceSummary
                    ),
                    readinessSummary: result.readiness,
                    rows: result.rows,
                    metadataRows: metadataRows,
                    selectedMetadata: .none("Select one metadata entry to inspect."),
                    banners: result.banners,
                    labelDefinitions: result.labelDefinitions,
                    discoveryProposals: discoverySummary.proposedTags,
                    openQuestions: discoverySummary.openQuestions
                )
                syncSelectedMetadata()
            } catch {
                screenModel = DisplayScreenModel(
                    header: DisplayHeaderModel(
                        title: "Display",
                        subtitle: "Review and manage the display metadata the agents are learning from your layout.",
                        activeProjectName: workspace.activeProject?.projectName ?? "No Project",
                        sourceSummary: "xLights owned API"
                    ),
                    readinessSummary: DisplayReadinessSummaryModel(
                        state: .blocked,
                        totalTargets: 0,
                        readyCount: 0,
                        unresolvedCount: 0,
                        orphanCount: 0,
                        explanationText: "Display could not be loaded.",
                        nextStepText: "Check that xLights is running and reachable."
                    ),
                    rows: [],
                    metadataRows: [],
                    selectedMetadata: .none(error.localizedDescription),
                    banners: [DisplayBannerModel(id: "load-failed", state: .blocked, text: error.localizedDescription)],
                    labelDefinitions: [],
                    discoveryProposals: [],
                    openQuestions: []
                )
            }
        }
    }

    func syncSelectedMetadata() {
        let selected = selectedMetadataRows
        if selected.isEmpty {
            screenModel = DisplayScreenModel(
                header: screenModel.header,
                readinessSummary: screenModel.readinessSummary,
                rows: screenModel.rows,
                metadataRows: screenModel.metadataRows,
                selectedMetadata: .none("Select one metadata entry to inspect."),
                banners: screenModel.banners,
                labelDefinitions: screenModel.labelDefinitions,
                discoveryProposals: screenModel.discoveryProposals,
                openQuestions: screenModel.openQuestions
            )
            return
        }
        let row = selected[0]
        let relatedLabels = relatedLabels(for: row)
        screenModel = DisplayScreenModel(
            header: screenModel.header,
            readinessSummary: screenModel.readinessSummary,
            rows: screenModel.rows,
            metadataRows: screenModel.metadataRows,
            selectedMetadata: .selected(DisplayMetadataSelectionModel(
                subject: row.subject,
                subjectType: row.subjectType,
                category: row.category,
                value: row.value,
                status: row.status,
                source: row.source,
                rationale: row.rationale,
                linkedTargets: row.linkedTargets,
                relatedLabels: relatedLabels
            )),
            banners: screenModel.banners,
            labelDefinitions: screenModel.labelDefinitions,
            discoveryProposals: screenModel.discoveryProposals,
            openQuestions: screenModel.openQuestions
        )
    }

    func reviewDiscoveryProposals() {
        showDiscoveryProposalSheet = true
    }

    func applyDiscoveryProposals() {
        let proposals = screenModel.discoveryProposals
        guard !proposals.isEmpty else { return }

        Task {
            do {
                for proposal in proposals {
                    try await displayService.saveTagDefinition(
                        for: workspace.activeProject,
                        tagID: nil,
                        name: proposal.tagName,
                        description: proposal.tagDescription,
                        color: .none
                    )
                    try await displayService.addTag(
                        for: workspace.activeProject,
                        targetIDs: proposal.targetNames,
                        tagName: proposal.tagName,
                        description: proposal.tagDescription
                    )
                }
                try displayDiscoveryStore.clearTagProposals(for: workspace.activeProject)
                showDiscoveryProposalSheet = false
                loadDisplay()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func buildMetadataRows(
        displayRows: [DisplayLayoutRowModel],
        discoverySummary: DisplayDiscoverySummaryModel
    ) -> [DisplayMetadataRowModel] {
        let insightRows = discoverySummary.insights.map { insight in
            DisplayMetadataRowModel(
                id: "insight::\(insight.subject.lowercased())::\(insight.category.lowercased())",
                subject: insight.subject,
                subjectType: insight.subjectType.capitalized,
                category: insight.category.replacingOccurrences(of: "_", with: " ").capitalized,
                value: insight.value,
                status: .confirmed,
                source: .userAndAgent,
                rationale: insight.rationale,
                linkedTargets: inferLinkedTargets(for: insight.subject, explicitTargets: [], from: displayRows)
            )
        }

        let proposalRows = discoverySummary.proposedTags.map { proposal in
            DisplayMetadataRowModel(
                id: "proposal::\(proposal.id)",
                subject: proposal.tagName,
                subjectType: "Tag Proposal",
                category: "Semantic Tag",
                value: proposal.tagDescription,
                status: .proposed,
                source: .agent,
                rationale: proposal.rationale,
                linkedTargets: inferLinkedTargets(for: proposal.tagName, explicitTargets: proposal.targetNames, from: displayRows)
            )
        }

        return (insightRows + proposalRows).sorted {
            if $0.status != $1.status {
                return $0.status == .proposed
            }
            if $0.subject.caseInsensitiveCompare($1.subject) != .orderedSame {
                return $0.subject.localizedCaseInsensitiveCompare($1.subject) == .orderedAscending
            }
            return $0.category.localizedCaseInsensitiveCompare($1.category) == .orderedAscending
        }
    }

    private func inferLinkedTargets(for subject: String, explicitTargets: [String], from rows: [DisplayLayoutRowModel]) -> [String] {
        if !explicitTargets.isEmpty {
            return explicitTargets.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
        }

        let normalizedSubject = normalizeForMatching(subject)
        let subjectTokens = tokenSet(for: subject)
        return rows
            .filter { row in
                let normalizedTarget = normalizeForMatching(row.targetName)
                if !normalizedSubject.isEmpty,
                   (normalizedTarget == normalizedSubject || normalizedTarget.contains(normalizedSubject) || normalizedSubject.contains(normalizedTarget)) {
                    return true
                }

                let targetTokens = tokenSet(for: row.targetName)
                guard !subjectTokens.isEmpty, !targetTokens.isEmpty else { return false }
                let intersection = subjectTokens.intersection(targetTokens)
                return !intersection.isEmpty && (intersection.count == subjectTokens.count || intersection.count == targetTokens.count || intersection.count >= 2)
            }
            .map(\.targetName)
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    private func relatedLabels(for row: DisplayMetadataRowModel) -> [DisplayLabelDefinitionModel] {
        let labelNames = Set(selectedLinkedTargets.flatMap(\.labelDefinitions).map(\.name))
        let related = screenModel.labelDefinitions.filter { labelNames.contains($0.name) }
        return related.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private func normalizeForMatching(_ value: String) -> String {
        value
            .lowercased()
            .replacingOccurrences(of: "\\b(models?|props?|family|families)\\b", with: "", options: .regularExpression)
            .replacingOccurrences(of: "[^a-z0-9]+", with: "", options: .regularExpression)
    }

    private func tokenSet(for value: String) -> Set<String> {
        let cleaned = value
            .replacingOccurrences(of: "([a-z0-9])([A-Z])", with: "$1 $2", options: .regularExpression)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression)
        let rawTokens = cleaned.split(separator: " ").map(String.init)
        let filteredTokens = rawTokens.filter { token in
            !token.isEmpty &&
            token != "model" &&
            token != "models" &&
            token != "prop" &&
            token != "props" &&
            token != "family" &&
            token != "families"
        }
        return Set(filteredTokens)
    }
}
