import Foundation
import Observation
import SwiftUI

@MainActor
@Observable
final class LayoutScreenViewModel {
    enum AddTagMode: String, CaseIterable, Identifiable {
        case existing
        case new

        var id: String { rawValue }
    }

    private let workspace: ProjectWorkspace
    private let layoutService: LayoutService
    private let displayDiscoveryStore: DisplayDiscoveryStateStore

    var targetFilter = ""
    var typeFilter = ""
    var categoryFilter = ""
    var valueFilter = ""
    var statusFilter = ""
    var sortOrder = [KeyPathComparator(\DisplayMetadataRowModel.subject, order: .forward)]
    var selectedRowIDs = Set<DisplayMetadataRowModel.ID>()
    var screenModel = LayoutScreenModel(
        header: LayoutHeaderModel(
            title: "Display",
            subtitle: "Create and maintain project display metadata grounded in the active xLights layout.",
            activeProjectName: "No Project",
            sourceSummary: ""
        ),
        readinessSummary: LayoutReadinessSummaryModel(
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
        tagDefinitions: [],
        discoveryProposals: [],
        openQuestions: []
    )

    var errorMessage: String?
    var showAddTagSheet = false
    var showRemoveTagSheet = false
    var showManageTagsSheet = false
    var showDiscoveryProposalSheet = false

    var addTagMode: AddTagMode = .existing
    var selectedExistingTagID = ""
    var newTagName = ""
    var newTagDescription = ""
    var selectedRemovalTagID = ""

    var manageSelectedTagID: String?
    var manageTagName = ""
    var manageTagDescription = ""
    var manageTagColor: LayoutTagColor = .none
    private var originalManageTagName = ""
    private var originalManageTagDescription = ""
    private var originalManageTagColor: LayoutTagColor = .none
    var isSavingTagChanges = false

    init(
        workspace: ProjectWorkspace,
        layoutService: LayoutService = XLightsLayoutService(),
        displayDiscoveryStore: DisplayDiscoveryStateStore = LocalDisplayDiscoveryStateStore()
    ) {
        self.workspace = workspace
        self.layoutService = layoutService
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

    var canAddTag: Bool {
        !selectedLinkedTargetNames.isEmpty
    }

    var removableTags: [LayoutTagDefinitionModel] {
        let tagIDs = Set(selectedLinkedTargets.flatMap { $0.tagDefinitions.map(\.id) })
        return screenModel.tagDefinitions
            .filter { tagIDs.contains($0.id) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
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

    var selectedLinkedTargets: [LayoutRowModel] {
        let names = Set(selectedLinkedTargetNames)
        return screenModel.rows.filter { names.contains($0.targetName) }
    }

    private var selectedLinkedTargetNames: [String] {
        selectedMetadataRows.flatMap(\.linkedTargets)
    }

    var canSaveManagedTag: Bool {
        !manageTagName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSavingTagChanges
    }

    var hasManagedTagChanges: Bool {
        manageTagName != originalManageTagName ||
        manageTagDescription != originalManageTagDescription ||
        manageTagColor != originalManageTagColor
    }

    func loadLayout() {
        let activeProject = workspace.activeProject
        Task {
            do {
                let result = try await layoutService.loadLayout(for: activeProject)
                let discoverySummary = displayDiscoveryStore.summary(for: activeProject)
                let metadataRows = buildMetadataRows(layoutRows: result.rows, discoverySummary: discoverySummary)
                let validSelection = selectedRowIDs.intersection(Set(metadataRows.map(\.id)))
                if validSelection.isEmpty, let first = metadataRows.first {
                    selectedRowIDs = [first.id]
                } else {
                    selectedRowIDs = validSelection
                }

                screenModel = LayoutScreenModel(
                    header: LayoutHeaderModel(
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
                    tagDefinitions: result.tagDefinitions,
                    discoveryProposals: discoverySummary.proposedTags,
                    openQuestions: discoverySummary.openQuestions
                )
                syncSelectedMetadata()
            } catch {
                screenModel = LayoutScreenModel(
                    header: LayoutHeaderModel(
                        title: "Display",
                        subtitle: "Review and manage the display metadata the agents are learning from your layout.",
                        activeProjectName: workspace.activeProject?.projectName ?? "No Project",
                        sourceSummary: "xLights owned API"
                    ),
                    readinessSummary: LayoutReadinessSummaryModel(
                        state: .blocked,
                        totalTargets: 0,
                        readyCount: 0,
                        unresolvedCount: 0,
                        orphanCount: 0,
                        explanationText: "Layout could not be loaded.",
                        nextStepText: "Check that xLights is running and reachable."
                    ),
                    rows: [],
                    metadataRows: [],
                    selectedMetadata: .none(error.localizedDescription),
                    banners: [LayoutBannerModel(id: "load-failed", state: .blocked, text: error.localizedDescription)],
                    tagDefinitions: [],
                    discoveryProposals: [],
                    openQuestions: []
                )
            }
        }
    }

    func syncSelectedMetadata() {
        let selected = selectedMetadataRows
        if selected.isEmpty {
            screenModel = LayoutScreenModel(
                header: screenModel.header,
                readinessSummary: screenModel.readinessSummary,
                rows: screenModel.rows,
                metadataRows: screenModel.metadataRows,
                selectedMetadata: .none("Select one metadata entry to inspect."),
                banners: screenModel.banners,
                tagDefinitions: screenModel.tagDefinitions,
                discoveryProposals: screenModel.discoveryProposals,
                openQuestions: screenModel.openQuestions
            )
            return
        }
        let row = selected[0]
        let relatedTags = relatedTags(for: row)
        screenModel = LayoutScreenModel(
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
                relatedTags: relatedTags
            )),
            banners: screenModel.banners,
            tagDefinitions: screenModel.tagDefinitions,
            discoveryProposals: screenModel.discoveryProposals,
            openQuestions: screenModel.openQuestions
        )
    }

    func presentAddTagSheet() {
        selectedExistingTagID = screenModel.tagDefinitions.first?.id ?? ""
        newTagName = ""
        newTagDescription = ""
        addTagMode = screenModel.tagDefinitions.isEmpty ? .new : .existing
        showAddTagSheet = true
    }

    func applyAddTag() {
        let selectedIDs = selectedLinkedTargets.map(\.id)
        guard !selectedIDs.isEmpty else { return }

        let tagName: String
        let description: String
        switch addTagMode {
        case .existing:
            guard let tag = screenModel.tagDefinitions.first(where: { $0.id == selectedExistingTagID }) else { return }
            tagName = tag.name
            description = tag.description
        case .new:
            tagName = newTagName
            description = newTagDescription
        }

        Task {
            do {
                try await layoutService.addTag(
                    for: workspace.activeProject,
                    targetIDs: selectedIDs,
                    tagName: tagName,
                    description: description
                )
                showAddTagSheet = false
                loadLayout()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func presentRemoveTagSheet() {
        selectedRemovalTagID = removableTags.first?.id ?? ""
        showRemoveTagSheet = true
    }

    func applyRemoveTag() {
        let selectedIDs = selectedLinkedTargets.map(\.id)
        guard !selectedIDs.isEmpty, !selectedRemovalTagID.isEmpty else { return }

        Task {
            do {
                try await layoutService.removeTag(
                    for: workspace.activeProject,
                    targetIDs: selectedIDs,
                    tagID: selectedRemovalTagID
                )
                showRemoveTagSheet = false
                loadLayout()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func presentManageTagsSheet() {
        showManageTagsSheet = true
        if manageSelectedTagID == nil {
            selectManagedTag(id: screenModel.tagDefinitions.first?.id)
        }
    }

    func selectManagedTag(id: String?) {
        manageSelectedTagID = id
        guard let id, let tag = screenModel.tagDefinitions.first(where: { $0.id == id }) else {
            manageTagName = ""
            manageTagDescription = ""
            manageTagColor = .none
            originalManageTagName = ""
            originalManageTagDescription = ""
            originalManageTagColor = .none
            return
        }
        manageTagName = tag.name
        manageTagDescription = tag.description
        manageTagColor = tag.color
        originalManageTagName = tag.name
        originalManageTagDescription = tag.description
        originalManageTagColor = tag.color
    }

    func startNewManagedTag() {
        manageSelectedTagID = nil
        manageTagName = ""
        manageTagDescription = ""
        manageTagColor = .none
        originalManageTagName = ""
        originalManageTagDescription = ""
        originalManageTagColor = .none
    }

    func saveManagedTag(closeAfterSave: Bool = false) {
        Task {
            do {
                isSavingTagChanges = true
                try await layoutService.saveTagDefinition(
                    for: workspace.activeProject,
                    tagID: manageSelectedTagID,
                    name: manageTagName,
                    description: manageTagDescription,
                    color: manageTagColor
                )
                originalManageTagName = manageTagName
                originalManageTagDescription = manageTagDescription
                originalManageTagColor = manageTagColor
                if closeAfterSave {
                    showManageTagsSheet = false
                }
                loadLayout()
            } catch {
                errorMessage = error.localizedDescription
            }
            isSavingTagChanges = false
        }
    }

    func finishManageTags() {
        if hasManagedTagChanges && canSaveManagedTag {
            saveManagedTag(closeAfterSave: true)
        } else {
            showManageTagsSheet = false
        }
    }

    func deleteManagedTag() {
        guard let manageSelectedTagID else { return }
        Task {
            do {
                try await layoutService.deleteTagDefinition(for: workspace.activeProject, tagID: manageSelectedTagID)
                self.manageSelectedTagID = nil
                manageTagName = ""
                manageTagDescription = ""
                manageTagColor = .none
                loadLayout()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
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
                    try await layoutService.saveTagDefinition(
                        for: workspace.activeProject,
                        tagID: nil,
                        name: proposal.tagName,
                        description: proposal.tagDescription,
                        color: .none
                    )
                    try await layoutService.addTag(
                        for: workspace.activeProject,
                        targetIDs: proposal.targetNames,
                        tagName: proposal.tagName,
                        description: proposal.tagDescription
                    )
                }
                try displayDiscoveryStore.clearTagProposals(for: workspace.activeProject)
                showDiscoveryProposalSheet = false
                loadLayout()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func buildMetadataRows(
        layoutRows: [LayoutRowModel],
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
                linkedTargets: inferLinkedTargets(for: insight.subject, explicitTargets: [], from: layoutRows)
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
                linkedTargets: inferLinkedTargets(for: proposal.tagName, explicitTargets: proposal.targetNames, from: layoutRows)
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

    private func inferLinkedTargets(for subject: String, explicitTargets: [String], from rows: [LayoutRowModel]) -> [String] {
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

    private func relatedTags(for row: DisplayMetadataRowModel) -> [LayoutTagDefinitionModel] {
        let tagNames = Set(selectedLinkedTargets.flatMap(\.tagDefinitions).map(\.name))
        let related = screenModel.tagDefinitions.filter { tagNames.contains($0.name) }
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
