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

    var targetFilter = ""
    var typeFilter = ""
    var layoutGroupFilter = ""
    var tagsFilter = ""
    var statusFilter = ""
    var sortOrder = [KeyPathComparator(\LayoutRowModel.targetName, order: .forward)]
    var selectedRowIDs = Set<LayoutRowModel.ID>()
    var screenModel = LayoutScreenModel(
        header: LayoutHeaderModel(
            title: "Layout",
            subtitle: "Create and maintain project tags over the active xLights layout.",
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
        selectedTarget: .none("Select one or more targets to inspect or tag."),
        banners: [],
        tagDefinitions: []
    )

    var errorMessage: String?
    var showAddTagSheet = false
    var showRemoveTagSheet = false
    var showManageTagsSheet = false

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

    init(workspace: ProjectWorkspace, layoutService: LayoutService = XLightsLayoutService()) {
        self.workspace = workspace
        self.layoutService = layoutService
    }

    var filteredRows: [LayoutRowModel] {
        let target = targetFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let type = typeFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let layoutGroup = layoutGroupFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let tags = tagsFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let status = statusFilter.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        var rows = screenModel.rows.filter {
            (target.isEmpty || $0.targetName.lowercased().contains(target)) &&
            (type.isEmpty || $0.targetType.lowercased().contains(type)) &&
            (layoutGroup.isEmpty || $0.layoutGroup.lowercased().contains(layoutGroup)) &&
            (tags.isEmpty || $0.tagFilterSummary.lowercased().contains(tags)) &&
            (status.isEmpty || $0.supportStateSummary.lowercased().contains(status))
        }
        rows.sort(using: sortOrder)
        return rows
    }

    var hasActiveFilters: Bool {
        !targetFilter.isEmpty || !typeFilter.isEmpty || !layoutGroupFilter.isEmpty || !tagsFilter.isEmpty || !statusFilter.isEmpty
    }

    func clearFilters() {
        targetFilter = ""
        typeFilter = ""
        layoutGroupFilter = ""
        tagsFilter = ""
        statusFilter = ""
    }

    func updateSortOrder(_ order: [KeyPathComparator<LayoutRowModel>]) {
        sortOrder = order
    }

    func syncSelectionToVisibleRows() {
        let visibleIDs = Set(filteredRows.map(\.id))
        selectedRowIDs = selectedRowIDs.intersection(visibleIDs)
        if selectedRowIDs.isEmpty, let first = filteredRows.first {
            selectedRowIDs = [first.id]
        }
        syncSelectedPane()
    }

    var selectedRows: [LayoutRowModel] {
        screenModel.rows.filter { selectedRowIDs.contains($0.id) }
    }

    var canAddTag: Bool {
        !selectedRows.isEmpty
    }

    var removableTags: [LayoutTagDefinitionModel] {
        let tagIDs = Set(selectedRows.flatMap { $0.tagDefinitions.map(\.id) })
        return screenModel.tagDefinitions
            .filter { tagIDs.contains($0.id) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
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
                let validSelection = selectedRowIDs.intersection(Set(result.rows.map(\.id)))
                if validSelection.isEmpty, let first = result.rows.first {
                    selectedRowIDs = [first.id]
                } else {
                    selectedRowIDs = validSelection
                }

                screenModel = LayoutScreenModel(
                    header: LayoutHeaderModel(
                        title: "Layout",
                        subtitle: "Tag xLights targets so design and sequencing can use them meaningfully.",
                        activeProjectName: workspace.activeProject?.projectName ?? "No Project",
                        sourceSummary: result.sourceSummary
                    ),
                    readinessSummary: result.readiness,
                    rows: result.rows,
                    selectedTarget: .none("Select one or more targets to inspect or tag."),
                    banners: result.banners,
                    tagDefinitions: result.tagDefinitions
                )
                syncSelectedPane()
            } catch {
                screenModel = LayoutScreenModel(
                    header: LayoutHeaderModel(
                        title: "Layout",
                        subtitle: "Tag xLights targets so design and sequencing can use them meaningfully.",
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
                    selectedTarget: .error(error.localizedDescription),
                    banners: [LayoutBannerModel(id: "load-failed", state: .blocked, text: error.localizedDescription)],
                    tagDefinitions: []
                )
            }
        }
    }

    func syncSelectedPane() {
        let selected = selectedRows
        if selected.isEmpty {
            screenModel = LayoutScreenModel(
                header: screenModel.header,
                readinessSummary: screenModel.readinessSummary,
                rows: screenModel.rows,
                selectedTarget: .none("Select one or more targets to inspect or tag."),
                banners: screenModel.banners,
                tagDefinitions: screenModel.tagDefinitions
            )
            return
        }

        if selected.count == 1, let row = selected.first {
            let selectedModel = LayoutSelectedTargetModel(
                identity: row.targetName,
                type: row.targetType,
                layoutGroup: row.layoutGroup,
                readinessState: row.tagDefinitions.isEmpty ? .needsReview : .ready,
                reason: row.issuesSummary,
                assignedTags: row.tagDefinitions,
                downstreamEffectSummary: row.submodelCount > 0
                    ? "\(row.submodelCount) submodels are available for later design and sequencing detail."
                    : "No submodels are reported for this target."
            )
            screenModel = LayoutScreenModel(
                header: screenModel.header,
                readinessSummary: screenModel.readinessSummary,
                rows: screenModel.rows,
                selectedTarget: .selected(selectedModel),
                banners: screenModel.banners,
                tagDefinitions: screenModel.tagDefinitions
            )
            return
        }

        let commonTagIDs = selected.reduce(Set(selected.first?.tagDefinitions.map(\.id) ?? [])) { partial, row in
            partial.intersection(Set(row.tagDefinitions.map(\.id)))
        }
        let commonTags = screenModel.tagDefinitions
            .filter { commonTagIDs.contains($0.id) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let mixedTagIDs = Set(selected.flatMap { $0.tagDefinitions.map(\.id) }).subtracting(commonTagIDs)
        let multi = LayoutMultiSelectionModel(
            selectionCount: selected.count,
            commonTags: commonTags,
            mixedTagCount: mixedTagIDs.count
        )
        screenModel = LayoutScreenModel(
            header: screenModel.header,
            readinessSummary: screenModel.readinessSummary,
            rows: screenModel.rows,
            selectedTarget: .multi(multi),
            banners: screenModel.banners,
            tagDefinitions: screenModel.tagDefinitions
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
        let selectedIDs = selectedRows.map(\.id)
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
        let selectedIDs = selectedRows.map(\.id)
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
}
