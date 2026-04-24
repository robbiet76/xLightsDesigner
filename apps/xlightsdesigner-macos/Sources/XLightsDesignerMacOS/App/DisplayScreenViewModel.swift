import Foundation
import Observation
import SwiftUI

private let displayMetadataSubjectTypes = ["Model", "Group", "Family"]
private let displayMetadataCategories = [
    "Target Intent",
    "Focal Hierarchy",
    "Character Prop Role",
    "Supporting Layer",
    "Background Layer",
    "Feature Family",
    "Spatial Framing"
]

private extension Sequence where Element: Hashable {
    func removingDuplicates() -> [Element] {
        var seen = Set<Element>()
        var result: [Element] = []
        for element in self where seen.insert(element).inserted {
            result.append(element)
        }
        return result
    }
}

@MainActor
@Observable
final class DisplayScreenViewModel {
    struct MetadataEditorModel {
        var originalID: String?
        var subject: String = ""
        var subjectType: String = displayMetadataSubjectTypes[0]
        var category: String = displayMetadataCategories[0]
        var value: String = ""
        var rationale: String = ""
        var rolePreference: String = ""
        var semanticHintsText: String = ""
        var effectAvoidancesText: String = ""
        var targetNames: Set<String> = []
        var targetSearchText: String = ""

        var isEditing: Bool { originalID != nil }
    }

    enum MetadataStatusFilter: String, CaseIterable {
        case all = "All Statuses"
        case confirmed = "Confirmed"
        case proposed = "Proposed"
    }

    private let workspace: ProjectWorkspace
    private let displayService: DisplayService
    private let displayDiscoveryStore: DisplayDiscoveryStateStore

    var searchText = ""
    var categoryFilter = "All Categories"
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
        overviewCards: [],
        selectedMetadata: .none("Select one metadata entry to inspect."),
        banners: [],
        labelDefinitions: [],
        discoveryProposals: []
    )

    var errorMessage: String?
    var showDiscoveryProposalSheet = false
    var showMetadataEditorSheet = false
    var metadataEditor = MetadataEditorModel()
    var pendingDeleteRow: DisplayMetadataRowModel?
    private var latestTargetPreferences: [String: PersistedDisplayTargetPreference] = [:]

    var allowedMetadataSubjectTypes: [String] { displayMetadataSubjectTypes }
    var allowedMetadataCategories: [String] { displayMetadataCategories }
    var availableTargetNames: [String] {
        screenModel.rows
            .map(\.targetName)
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    var filteredEditorTargetNames: [String] {
        let search = metadataEditor.targetSearchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if search.isEmpty {
            return availableTargetNames
        }
        return availableTargetNames.filter { $0.lowercased().contains(search) }
    }

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
        let search = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        var rows = screenModel.metadataRows.filter {
            let matchesSearch = search.isEmpty || [
                $0.subject,
                $0.subjectType,
                $0.category,
                $0.value,
                $0.rationale
            ].joined(separator: " ").lowercased().contains(search)
            let matchesCategory = categoryFilter == "All Categories" || $0.category == categoryFilter
            return matchesSearch && matchesCategory
        }
        rows.sort(using: sortOrder)
        return rows
    }

    var hasActiveFilters: Bool {
        !searchText.isEmpty || categoryFilter != "All Categories"
    }

    func clearFilters() {
        searchText = ""
        categoryFilter = "All Categories"
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

    var readinessProgress: Double {
        let rows = understoodDisplayRows
        guard !rows.isEmpty else { return 0 }
        let familyCounts = Dictionary(grouping: rows, by: { normalizedFamilyBaseName(for: $0.targetName) })
            .mapValues(\.count)
        let totalWeight = rows.reduce(0.0) { partial, row in
            partial + targetImportanceWeight(for: row, familyCounts: familyCounts, bounds: layoutBounds(for: rows))
        }
        guard totalWeight > 0 else { return 0 }
        let knownWeight = rows.reduce(0.0) { partial, row in
            let weight = targetImportanceWeight(for: row, familyCounts: familyCounts, bounds: layoutBounds(for: rows))
            let knownScore = targetKnownScore(for: row, familyCounts: familyCounts)
            return partial + (weight * knownScore)
        }
        return min(1, knownWeight / totalWeight)
    }

    var readinessStageTitle: String {
        switch readinessProgress {
        case ..<0.15: return "Getting Started"
        case ..<0.4: return "Taking Shape"
        case ..<0.75: return "Well Understood"
        default: return "Sequencing Ready"
        }
    }

    var readinessDetailText: String {
        if missingBranches.isEmpty {
            return "The display has enough semantic coverage to move into sequencing with confidence."
        }
        return "The display understanding is developing. Finish the remaining areas to make sequencing decisions with less guesswork."
    }

    var coveredBranches: [String] {
        displayCoverageBranches.filter { branchCoverageScore($0) >= 0.95 }
    }

    var missingBranches: [String] {
        displayCoverageBranches.filter { branchCoverageScore($0) < 0.95 }
    }

    var availableCategories: [String] {
        ["All Categories"] + Set(screenModel.metadataRows.map(\.category)).sorted()
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

    private var understoodDisplayRows: [DisplayLayoutRowModel] {
        screenModel.rows.filter { row in
            let type = row.targetType.lowercased()
            return !type.contains("modelgroup") && !type.contains("submodel")
        }
    }

    private var displayCoverageBranches: [String] {
        [
            "Focal hierarchy",
            "Supporting and background layers",
            "Repeated families and accents",
            "Character or feature props",
            "Spatial framing"
        ]
    }

    func loadDisplay() {
        Task {
            await reloadDisplay()
        }
    }

    func reloadDisplay() async {
        let activeProject = workspace.activeProject
        do {
            let result = try await displayService.loadDisplay(for: activeProject)
            let discoverySummary = displayDiscoveryStore.summary(for: activeProject)
            latestTargetPreferences = result.targetPreferences
            let metadataRows = buildMetadataRows(
                displayRows: result.rows,
                discoverySummary: discoverySummary,
                targetPreferences: result.targetPreferences
            )
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
                overviewCards: buildOverviewCards(from: metadataRows),
                selectedMetadata: .none("Select one metadata entry to inspect."),
                banners: result.banners,
                labelDefinitions: result.labelDefinitions,
                discoveryProposals: discoverySummary.proposedTags
            )
            syncSelectedMetadata()
        } catch {
            latestTargetPreferences = [:]
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
                overviewCards: [],
                selectedMetadata: .none(error.localizedDescription),
                banners: [DisplayBannerModel(id: "load-failed", state: .blocked, text: error.localizedDescription)],
                labelDefinitions: [],
                discoveryProposals: []
            )
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
                overviewCards: screenModel.overviewCards,
                selectedMetadata: .none("Select one metadata entry to inspect."),
                banners: screenModel.banners,
                labelDefinitions: screenModel.labelDefinitions,
                discoveryProposals: screenModel.discoveryProposals
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
            overviewCards: screenModel.overviewCards,
            selectedMetadata: .selected(DisplayMetadataSelectionModel(
                id: row.id,
                subject: row.subject,
                subjectType: row.subjectType,
                category: row.category,
                value: row.value,
                status: row.status,
                rationale: row.rationale,
                linkedTargets: row.linkedTargets,
                relatedLabels: relatedLabels
            )),
            banners: screenModel.banners,
            labelDefinitions: screenModel.labelDefinitions,
            discoveryProposals: screenModel.discoveryProposals
        )
    }

    func reviewDiscoveryProposals() {
        showDiscoveryProposalSheet = true
    }

    func proposeMetadataFromLayout() {
        let proposals = buildBaselineTagProposals(from: screenModel.rows)
        guard !proposals.isEmpty else {
            errorMessage = "No obvious xLights groups were found to seed display metadata proposals."
            return
        }
        do {
            try displayDiscoveryStore.upsertTagProposals(proposals, for: workspace.activeProject)
            loadDisplay()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startAddMetadata() {
        metadataEditor = MetadataEditorModel()
        showMetadataEditorSheet = true
    }

    func startEditSelectedMetadata() {
        guard let row = selectedMetadataRows.first else { return }
        metadataEditor = MetadataEditorModel(
            originalID: row.id,
            subject: row.subject,
            subjectType: row.subjectType,
            category: row.category,
            value: row.value,
            rationale: row.rationale,
            rolePreference: targetPreferenceSummary(for: row.linkedTargets, field: \.rolePreference),
            semanticHintsText: targetPreferenceListSummary(for: row.linkedTargets, field: \.semanticHints),
            effectAvoidancesText: targetPreferenceListSummary(for: row.linkedTargets, field: \.effectAvoidances),
            targetNames: Set(row.linkedTargets)
        )
        showMetadataEditorSheet = true
    }

    func deleteSelectedMetadata() {
        pendingDeleteRow = selectedMetadataRows.first
    }

    func confirmDeleteSelectedMetadata() {
        guard let row = pendingDeleteRow else { return }
        do {
            try displayDiscoveryStore.deleteInsight(subject: row.subject, category: normalizeCategoryForStorage(row.category), for: workspace.activeProject)
            pendingDeleteRow = nil
            loadDisplay()
        } catch {
            pendingDeleteRow = nil
            errorMessage = error.localizedDescription
        }
    }

    func saveMetadataEditor() {
        let subject = metadataEditor.subject.trimmingCharacters(in: .whitespacesAndNewlines)
        let subjectType = metadataEditor.subjectType.trimmingCharacters(in: .whitespacesAndNewlines)
        let category = metadataEditor.category.trimmingCharacters(in: .whitespacesAndNewlines)
        let value = metadataEditor.value.trimmingCharacters(in: .whitespacesAndNewlines)
        let rationale = metadataEditor.rationale.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !subject.isEmpty, !subjectType.isEmpty, !category.isEmpty, !value.isEmpty else {
            errorMessage = "Subject, type, category, and meaning are required."
            return
        }

        guard displayMetadataSubjectTypes.contains(subjectType) else {
            errorMessage = "Type must be one of: \(displayMetadataSubjectTypes.joined(separator: ", "))."
            return
        }

        guard displayMetadataCategories.contains(category) else {
            errorMessage = "Category must be selected from the supported metadata categories."
            return
        }

        let selectedTargets = Array(metadataEditor.targetNames)
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
        guard !selectedTargets.isEmpty else {
            errorMessage = "Select at least one linked xLights target."
            return
        }
        let resolvedTargets = inferLinkedTargets(for: subject, explicitTargets: selectedTargets, from: screenModel.rows)
        guard resolvedTargets.count == selectedTargets.count else {
            errorMessage = "One or more selected linked targets are not available in the current xLights layout."
            return
        }

        do {
            let insight = DisplayDiscoveryInsightModel(
                subject: subject,
                subjectType: subjectType.lowercased(),
                category: normalizeCategoryForStorage(category),
                value: value,
                rationale: rationale,
                targetNames: selectedTargets
            )
            try displayDiscoveryStore.upsertInsight(insight, for: workspace.activeProject)
            let rolePreference = metadataEditor.rolePreference.trimmingCharacters(in: .whitespacesAndNewlines)
            let semanticHints = splitList(metadataEditor.semanticHintsText)
            let effectAvoidances = splitList(metadataEditor.effectAvoidancesText)
            let editsTargetIntent = metadataEditor.originalID?.hasPrefix("target-preference::") == true
                || !rolePreference.isEmpty
                || !semanticHints.isEmpty
                || !effectAvoidances.isEmpty
            if editsTargetIntent {
                Task {
                    do {
                        try await displayService.saveTargetPreference(
                            for: workspace.activeProject,
                            targetIDs: selectedTargets,
                            rolePreference: rolePreference.isEmpty ? nil : rolePreference,
                            semanticHints: semanticHints,
                            effectAvoidances: effectAvoidances
                        )
                        loadDisplay()
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
            }
            showMetadataEditorSheet = false
            metadataEditor = MetadataEditorModel()
            loadDisplay()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func saveTargetIntent(targetIDs: [String], rolePreference: String?, semanticHints: [String], effectAvoidances: [String]) async throws {
        try await displayService.saveTargetPreference(
            for: workspace.activeProject,
            targetIDs: targetIDs,
            rolePreference: rolePreference,
            semanticHints: semanticHints,
            effectAvoidances: effectAvoidances
        )
        await reloadDisplay()
    }

    func saveTargetIntentFromUI(targetIDs: [String], rolePreference: String?, semanticHints: [String], effectAvoidances: [String]) {
        Task {
            do {
                try await saveTargetIntent(
                    targetIDs: targetIDs,
                    rolePreference: rolePreference,
                    semanticHints: semanticHints,
                    effectAvoidances: effectAvoidances
                )
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func applyDiscoveryProposals() {
        Task {
            do {
                try await promoteDiscoveryProposals()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    func promoteDiscoveryProposals() async throws {
        let proposals = screenModel.discoveryProposals
        guard !proposals.isEmpty else { return }

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
        await reloadDisplay()
    }

    private func buildMetadataRows(
        displayRows: [DisplayLayoutRowModel],
        discoverySummary: DisplayDiscoverySummaryModel,
        targetPreferences: [String: PersistedDisplayTargetPreference]
    ) -> [DisplayMetadataRowModel] {
        let labelRows = buildLabelMetadataRows(from: displayRows)
        let preferenceRows = buildPreferenceMetadataRows(from: targetPreferences, displayRows: displayRows)

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
                linkedTargets: inferLinkedTargets(for: insight.subject, explicitTargets: insight.targetNames, from: displayRows)
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

        return (labelRows + preferenceRows + insightRows + proposalRows).sorted {
            if $0.status != $1.status {
                return $0.status == .proposed
            }
            if $0.subject.caseInsensitiveCompare($1.subject) != .orderedSame {
                return $0.subject.localizedCaseInsensitiveCompare($1.subject) == .orderedAscending
            }
            return $0.category.localizedCaseInsensitiveCompare($1.category) == .orderedAscending
        }
    }

    private func buildPreferenceMetadataRows(
        from targetPreferences: [String: PersistedDisplayTargetPreference],
        displayRows: [DisplayLayoutRowModel]
    ) -> [DisplayMetadataRowModel] {
        let knownTargets = Set(displayRows.map(\.targetName))
        return targetPreferences.compactMap { targetID, preference in
            guard knownTargets.contains(targetID) else { return nil }
            let role = preference.rolePreference?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let semanticHints = (preference.semanticHints ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            let effectAvoidances = (preference.effectAvoidances ?? []).map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
            let valueParts = [
                role.isEmpty ? "" : "Role: \(role)",
                semanticHints.isEmpty ? "" : "Hints: \(semanticHints.joined(separator: ", "))",
                effectAvoidances.isEmpty ? "" : "Avoid: \(effectAvoidances.joined(separator: ", "))"
            ].filter { !$0.isEmpty }
            guard !valueParts.isEmpty else { return nil }
            return DisplayMetadataRowModel(
                id: "target-preference::\(targetID)",
                subject: targetID,
                subjectType: "Model",
                category: "Target Intent",
                value: valueParts.joined(separator: ". "),
                status: .confirmed,
                source: .userAndAgent,
                rationale: "App-owned model-level intent extension for sequencer target resolution.",
                linkedTargets: [targetID]
            )
        }
    }

    private func buildLabelMetadataRows(from displayRows: [DisplayLayoutRowModel]) -> [DisplayMetadataRowModel] {
        struct LabelBucket {
            var definition: DisplayLabelDefinitionModel
            var targetNames: Set<String>
        }

        var buckets: [String: LabelBucket] = [:]
        for row in displayRows {
            for label in row.labelDefinitions {
                if var bucket = buckets[label.id] {
                    bucket.targetNames.insert(row.targetName)
                    buckets[label.id] = bucket
                } else {
                    buckets[label.id] = LabelBucket(definition: label, targetNames: [row.targetName])
                }
            }
        }

        return buckets.values.map { bucket in
            let targets = bucket.targetNames.sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
            return DisplayMetadataRowModel(
                id: "label::\(bucket.definition.id)",
                subject: bucket.definition.name,
                subjectType: "Tag",
                category: "Semantic Tag",
                value: bucket.definition.description.isEmpty ? "Project display label." : bucket.definition.description,
                status: .confirmed,
                source: .userAndAgent,
                rationale: "Confirmed in the project display metadata store.",
                linkedTargets: targets
            )
        }
    }

    private func inferLinkedTargets(for subject: String, explicitTargets: [String], from rows: [DisplayLayoutRowModel]) -> [String] {
        if !explicitTargets.isEmpty {
            let knownTargets = Set(rows.map(\.targetName))
            return explicitTargets
                .filter { knownTargets.contains($0) }
                .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
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

    private func buildOverviewCards(from rows: [DisplayMetadataRowModel]) -> [DisplayMetadataOverviewCardModel] {
        let confirmed = rows.filter { $0.status == .confirmed }
        let proposed = rows.filter { $0.status == .proposed }
        let linkedTargets = Set(rows.flatMap(\.linkedTargets))
        let categories = Dictionary(grouping: rows, by: \.category)
        let dominantCategory = categories
            .sorted { lhs, rhs in
                if lhs.value.count != rhs.value.count { return lhs.value.count > rhs.value.count }
                return lhs.key.localizedCaseInsensitiveCompare(rhs.key) == .orderedAscending
            }
            .first

        var cards = [
            DisplayMetadataOverviewCardModel(
                id: "confirmed",
                title: "Confirmed",
                valueText: "\(confirmed.count)",
                detailText: confirmed.isEmpty ? "No confirmed learnings yet." : "User-grounded entries already shaping the display understanding.",
                accent: confirmed.isEmpty ? .needsReview : .ready
            ),
            DisplayMetadataOverviewCardModel(
                id: "proposed",
                title: "Proposed",
                valueText: "\(proposed.count)",
                detailText: proposed.isEmpty ? "No pending proposals." : "Entries waiting for review before they are promoted into the active store.",
                accent: proposed.isEmpty ? .ready : .needsReview
            ),
            DisplayMetadataOverviewCardModel(
                id: "linked-targets",
                title: "Linked Models",
                valueText: "\(linkedTargets.count)",
                detailText: linkedTargets.isEmpty ? "Metadata has not been mapped to models yet." : "Distinct xLights models currently referenced by the metadata entries.",
                accent: linkedTargets.isEmpty ? .needsReview : .ready
            )
        ]

        if let dominantCategory {
            let sampleSubjects = dominantCategory.value
                .map(\.subject)
                .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
                .prefix(3)
                .joined(separator: ", ")
            cards.append(
                DisplayMetadataOverviewCardModel(
                    id: "category",
                    title: dominantCategory.key,
                    valueText: "\(dominantCategory.value.count)",
                    detailText: sampleSubjects.isEmpty ? "No subjects in this category yet." : sampleSubjects,
                    accent: .ready
                )
            )
        }

        return cards
    }

    private func buildBaselineTagProposals(from rows: [DisplayLayoutRowModel]) -> [DisplayDiscoveryTagProposalModel] {
        let knownTargets = Set(rows.map(\.targetName))
        let candidates = rows
            .filter { row in
                let name = row.targetName.lowercased()
                let type = row.targetType.lowercased()
                let hasMembers = !row.activeGroupMembers.isEmpty || !row.directGroupMembers.isEmpty || !row.flattenedGroupMembers.isEmpty
                return hasMembers &&
                    (type.contains("group") || row.activeGroupMembers.count >= 2 || row.directGroupMembers.count >= 2) &&
                    !name.hasPrefix("allmodels")
            }
            .compactMap { row -> (proposal: DisplayDiscoveryTagProposalModel, score: Int)? in
                let targetNames = memberTargets(for: row, knownTargets: knownTargets)
                guard !targetNames.isEmpty else { return nil }
                let profile = baselineProfile(for: row)
                guard profile.score > 0 else { return nil }
                let proposal = DisplayDiscoveryTagProposalModel(
                    tagName: row.targetName,
                    tagDescription: profile.description,
                    rationale: "Seeded from xLights group membership: \(targetNames.prefix(8).joined(separator: ", "))\(targetNames.count > 8 ? "..." : "")",
                    targetNames: targetNames
                )
                return (proposal, profile.score + min(6, targetNames.count))
            }
            .sorted {
                if $0.score != $1.score { return $0.score > $1.score }
                return $0.proposal.tagName.localizedCaseInsensitiveCompare($1.proposal.tagName) == .orderedAscending
            }
            .prefix(16)

        return candidates.map(\.proposal)
    }

    private func memberTargets(for row: DisplayLayoutRowModel, knownTargets: Set<String>) -> [String] {
        let rawMembers = !row.activeGroupMembers.isEmpty
            ? row.activeGroupMembers
            : (!row.directGroupMembers.isEmpty ? row.directGroupMembers : row.flattenedGroupMembers)
        return rawMembers
            .filter { knownTargets.contains($0) }
            .removingDuplicates()
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    private func baselineProfile(for row: DisplayLayoutRowModel) -> (description: String, score: Int) {
        let name = row.targetName.lowercased()
        let type = row.targetType.lowercased()
        if name.contains("snowman") || name.contains("train") || name.contains("present") || name.contains("northpole") {
            return ("Feature or character prop group for story moments and visual callouts.", 8)
        }
        if name.contains("snowflake") || name.contains("candy") || name.contains("wreath") || name.contains("spiral") || name.contains("mini") {
            return ("Repeated prop family useful for accents, chases, and phrase development.", 7)
        }
        if name.contains("flood") {
            return ("Color wash and atmosphere layer for section mood and broad transitions.", 7)
        }
        if name.contains("gutter") || name.contains("border") || name.contains("outline") || name.contains("eave") || name.contains("garland") {
            return ("Architectural framing layer for structure, outlines, and beat support.", 6)
        }
        if name.contains("front") || name.contains("upper") || name.contains("lower") || name.contains("house") {
            return ("Spatial grouping that helps agents reason about layout placement and coverage.", 5)
        }
        if type.contains("group"), row.activeGroupMembers.count >= 4 || row.directGroupMembers.count >= 4 {
            return ("xLights model group available for coordinated sequencing decisions.", 3)
        }
        return ("", 0)
    }

    private func isBranchCovered(_ branch: String) -> Bool {
        branchCoverageScore(branch) >= 0.95
    }

    private func branchCoverageScore(_ branch: String) -> Double {
        let corpus = screenModel.metadataRows.map { row in
            [row.subject, row.subjectType, row.category, row.value, row.rationale].joined(separator: " ").lowercased()
        }

        let keywords: [String]
        let matchingRows: [DisplayMetadataRowModel]
        switch branch {
        case "Focal hierarchy":
            keywords = ["focal", "centerpiece", "primary", "main focal", "draw the eye"]
            matchingRows = screenModel.metadataRows.filter {
                let text = [$0.subject, $0.category, $0.value, $0.rationale].joined(separator: " ").lowercased()
                return keywords.contains { text.contains($0) }
            }
        case "Supporting and background layers":
            keywords = ["support", "background", "architectural", "framing", "frame", "soften", "ambiance"]
            matchingRows = screenModel.metadataRows.filter {
                let text = [$0.subject, $0.category, $0.value, $0.rationale].joined(separator: " ").lowercased()
                return keywords.contains { text.contains($0) }
            }
        case "Repeated families and accents":
            keywords = ["repeating", "repeat", "family", "accent", "pathway", "row", "support accents"]
            matchingRows = screenModel.metadataRows.filter {
                let text = [$0.subject, $0.subjectType, $0.category, $0.value, $0.rationale].joined(separator: " ").lowercased()
                return keywords.contains { text.contains($0) } || $0.subjectType.caseInsensitiveCompare("Family") == .orderedSame
            }
        case "Character or feature props":
            keywords = ["character", "feature", "scene", "named prop", "special prop", "feature props"]
            matchingRows = screenModel.metadataRows.filter {
                let text = [$0.subject, $0.category, $0.value, $0.rationale].joined(separator: " ").lowercased()
                return keywords.contains { text.contains($0) }
            }
        case "Spatial framing":
            keywords = ["foreground", "background", "center", "left", "right", "upper", "lower", "framing", "yard"]
            matchingRows = screenModel.metadataRows.filter {
                let text = [$0.subject, $0.category, $0.value, $0.rationale].joined(separator: " ").lowercased()
                return keywords.contains { text.contains($0) }
            }
        default:
            keywords = []
            matchingRows = []
        }

        let hasAnyEvidence = corpus.contains { text in
            keywords.contains { text.contains($0) }
        }
        guard hasAnyEvidence else { return 0 }

        let rowCountScore = min(1.0, Double(matchingRows.count) / 3.0)
        let linkedCoverageScore = matchingRows.contains(where: { !$0.linkedTargets.isEmpty }) ? 1.0 : 0.0
        let rationaleScore = matchingRows.contains(where: { !$0.rationale.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) ? 1.0 : 0.0

        return (rowCountScore * 0.7) + (linkedCoverageScore * 0.15) + (rationaleScore * 0.15)
    }

    private func targetKnownScore(for row: DisplayLayoutRowModel, familyCounts: [String: Int]) -> Double {
        let baseline = structuralUnderstandingBaseline(for: row, familyCounts: familyCounts)
        let linkedEntries = screenModel.metadataRows.filter { $0.linkedTargets.contains(row.targetName) }
        guard !linkedEntries.isEmpty else { return baseline }

        var metadataScore = min(1.0, 0.45 + (Double(linkedEntries.count - 1) * 0.2))
        if linkedEntries.contains(where: { !$0.rationale.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
            metadataScore += 0.15
        }
        if linkedEntries.contains(where: { $0.value.trimmingCharacters(in: .whitespacesAndNewlines).count >= 20 }) {
            metadataScore += 0.1
        }
        if linkedEntries.contains(where: { !$0.category.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }) {
            metadataScore += 0.1
        }
        return min(1.0, max(baseline, metadataScore))
    }

    private func structuralUnderstandingBaseline(for row: DisplayLayoutRowModel, familyCounts: [String: Int]) -> Double {
        let familyCount = familyCounts[normalizedFamilyBaseName(for: row.targetName)] ?? 1
        let type = row.targetType.lowercased()
        var score = 0.05

        if familyCount >= 4 { score += 0.15 }
        if familyCount >= 6 && row.nodeCount < 120 { score += 0.15 }
        if row.nodeCount < 80 { score += 0.1 }
        if type.contains("single line") || type.contains("poly line") { score += 0.05 }

        if row.nodeCount >= 300 { score -= 0.1 }
        if familyCount == 1 { score -= 0.05 }
        if type.contains("tree") || type.contains("matrix") { score -= 0.05 }

        return min(0.45, max(0.02, score))
    }

    private func targetImportanceWeight(
        for row: DisplayLayoutRowModel,
        familyCounts: [String: Int],
        bounds: (minX: Double, maxX: Double)
    ) -> Double {
        let familyCount = familyCounts[normalizedFamilyBaseName(for: row.targetName)] ?? 1
        let centerX = (bounds.minX + bounds.maxX) / 2
        let spanX = max(1.0, bounds.maxX - bounds.minX)
        let centeredness = 1.0 - min(1.0, abs(row.positionX - centerX) / (spanX / 2))
        let type = row.targetType.lowercased()

        var weight = 1.0
        if row.nodeCount >= 600 { weight += 2.2 }
        else if row.nodeCount >= 250 { weight += 1.5 }
        else if row.nodeCount >= 100 { weight += 0.8 }

        if centeredness >= 0.7 { weight += 0.5 }
        if familyCount == 1 { weight += 0.8 }
        else if familyCount <= 2 { weight += 0.4 }
        else if familyCount >= 6 { weight -= 0.2 }

        if row.submodelCount > 0 { weight += 0.2 }
        if row.width >= 4 || row.height >= 4 { weight += 0.3 }
        if type.contains("tree") || type.contains("matrix") || type.contains("star") { weight += 0.4 }

        return max(0.5, weight)
    }

    private func layoutBounds(for rows: [DisplayLayoutRowModel]) -> (minX: Double, maxX: Double) {
        guard let first = rows.first else { return (0, 1) }
        return rows.reduce((first.positionX, first.positionX)) { partial, row in
            (min(partial.0, row.positionX), max(partial.1, row.positionX))
        }
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

    private func normalizeCategoryForStorage(_ value: String) -> String {
        value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    }

    private func splitList(_ value: String) -> [String] {
        value
            .components(separatedBy: CharacterSet(charactersIn: ",\n"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .removingDuplicates()
    }

    private func targetPreferenceSummary(for targetNames: [String], field: KeyPath<PersistedDisplayTargetPreference, String?>) -> String {
        targetNames
            .compactMap { latestTargetPreferences[$0]?[keyPath: field]?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .removingDuplicates()
            .joined(separator: ", ")
    }

    private func targetPreferenceListSummary(for targetNames: [String], field: KeyPath<PersistedDisplayTargetPreference, [String]?>) -> String {
        targetNames
            .flatMap { latestTargetPreferences[$0]?[keyPath: field] ?? [] }
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .removingDuplicates()
            .joined(separator: ", ")
    }

    private func normalizedFamilyBaseName(for value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        let stripped = trimmed.replacingOccurrences(of: #"([_\-\s]?\d+)$"#, with: "", options: .regularExpression)
        return stripped.isEmpty ? trimmed : stripped
    }

    func toggleMetadataEditorTarget(_ targetName: String) {
        if metadataEditor.targetNames.contains(targetName) {
            metadataEditor.targetNames.remove(targetName)
        } else {
            metadataEditor.targetNames.insert(targetName)
        }
    }
}
