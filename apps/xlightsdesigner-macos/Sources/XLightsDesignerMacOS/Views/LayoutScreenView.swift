import SwiftUI

struct LayoutScreenView: View {
    @Bindable var model: LayoutScreenViewModel

    var body: some View {
        GeometryReader { proxy in
            let currentSelectionMinHeight = max(150, min(220, proxy.size.height * 0.2))
            let currentSelectionMaxHeight = max(220, min(320, proxy.size.height * 0.32))
            let gridMinHeight = max(260, proxy.size.height * 0.36)

            VStack(alignment: .leading, spacing: 20) {
                header
                summarySection
                controlsSection
                currentSelectionSection(minHeight: currentSelectionMinHeight, maxHeight: currentSelectionMaxHeight)
                metadataSection(minHeight: gridMinHeight)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .task {
            model.loadLayout()
        }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.loadLayout()
        }
        .onReceive(NotificationCenter.default.publisher(for: .displayDiscoveryDidChange)) { _ in
            model.loadLayout()
        }
        .sheet(isPresented: $model.showAddTagSheet) {
            addTagSheet
        }
        .sheet(isPresented: $model.showRemoveTagSheet) {
            removeTagSheet
        }
        .sheet(isPresented: $model.showManageTagsSheet) {
            manageTagsSheet
        }
        .sheet(isPresented: $model.showDiscoveryProposalSheet) {
            discoveryProposalSheet
        }
        .alert(
            "Display",
            isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { newValue in
                    if !newValue { model.errorMessage = nil }
                }
            )
        ) {
            Button("OK", role: .cancel) {
                model.errorMessage = nil
            }
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.screenModel.header.title)
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text(model.screenModel.header.subtitle)
                .foregroundStyle(.secondary)
            if model.screenModel.header.activeProjectName != "No Project" {
                Text("Project: \(model.screenModel.header.activeProjectName)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .layoutPriority(1)
    }

    private var summarySection: some View {
        GroupBox("Summary") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    chip(model.screenModel.readinessSummary.state.rawValue)
                    chip("Confirmed \(model.confirmedMetadataCount)")
                    if model.proposedMetadataCount > 0 {
                        chip("Proposed \(model.proposedMetadataCount)")
                    }
                    if !model.screenModel.openQuestions.isEmpty {
                        chip("Open Questions \(model.screenModel.openQuestions.count)")
                    }
                    if model.linkedTargetCoverageCount > 0 {
                        chip("Linked Targets \(model.linkedTargetCoverageCount)")
                    }
                }
                Text(model.screenModel.readinessSummary.explanationText)
                if !model.screenModel.readinessSummary.nextStepText.isEmpty {
                    Text(model.screenModel.readinessSummary.nextStepText)
                        .foregroundStyle(.secondary)
                }
                if !model.screenModel.openQuestions.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Open Questions")
                            .font(.headline)
                        ForEach(model.screenModel.openQuestions.prefix(3), id: \.self) { question in
                            Text(question)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                ForEach(model.screenModel.banners) { banner in
                    bannerView(banner)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .layoutPriority(1)
    }

    private var controlsSection: some View {
        GroupBox("Controls") {
            VStack(alignment: .leading, spacing: 12) {
                Text("Use chat to create understanding, then review and apply the resulting display metadata here.")
                    .foregroundStyle(.secondary)
                HStack(spacing: 10) {
                    Button("Refresh Display") {
                        model.loadLayout()
                    }
                    Button("Review Proposals…") {
                        model.reviewDiscoveryProposals()
                    }
                    .disabled(model.discoveryProposals.isEmpty)
                    Button("Apply Proposed Tags") {
                        model.applyDiscoveryProposals()
                    }
                    .disabled(model.discoveryProposals.isEmpty)
                    Button("Manage Tags…") {
                        model.presentManageTagsSheet()
                    }
                }
                if model.canAddTag {
                    HStack(spacing: 10) {
                        Button("Add Tag to Linked Targets…") {
                            model.presentAddTagSheet()
                        }
                        Button("Remove Tag…") {
                            model.presentRemoveTagSheet()
                        }
                        .disabled(model.removableTags.isEmpty)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .layoutPriority(1)
    }

    private func currentSelectionSection(minHeight: CGFloat, maxHeight: CGFloat) -> some View {
        GroupBox("Current Selection") {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    switch model.screenModel.selectedMetadata {
                    case let .none(message):
                        Text(message)
                            .foregroundStyle(.secondary)

                    case let .selected(entry):
                        Text(entry.subject)
                            .font(.title3)
                            .fontWeight(.semibold)
                        HStack(spacing: 10) {
                            compactInfoChip(label: "Type", value: entry.subjectType)
                            compactInfoChip(label: "Category", value: entry.category)
                            compactInfoChip(label: "Status", value: entry.status.rawValue)
                            compactInfoChip(label: "Source", value: entry.source.rawValue)
                        }
                        detailCard(label: "Meaning", value: entry.value)
                        if !entry.rationale.isEmpty {
                            detailCard(label: "Rationale", value: entry.rationale)
                        }
                        if !entry.linkedTargets.isEmpty {
                            detailCard(label: "Linked Models", value: entry.linkedTargets.joined(separator: ", "))
                        }
                        tagSection(title: "Related Tags", tags: entry.relatedTags)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: minHeight)
            .frame(maxHeight: maxHeight)
            .padding(.vertical, 4)
        }
        .layoutPriority(1)
    }

    private func metadataSection(minHeight: CGFloat) -> some View {
        GroupBox("Display Metadata") {
            VStack(alignment: .leading, spacing: 12) {
                filterRow
                Table(model.filteredRows, selection: $model.selectedRowIDs, sortOrder: $model.sortOrder) {
                    TableColumn("Subject", value: \.subject) { row in
                        Text(row.subject)
                    }
                    TableColumn("Type", value: \.subjectType) { row in
                        Text(row.subjectType)
                    }
                    TableColumn("Category", value: \.category) { row in
                        Text(row.category)
                    }
                    TableColumn("Value", value: \.value) { row in
                        Text(row.value)
                            .lineLimit(2)
                    }
                    TableColumn("Status", value: \.statusSummary) { row in
                        Text(row.status.rawValue)
                    }
                    TableColumn("Source", value: \.sourceSummary) { row in
                        Text(row.source.rawValue)
                    }
                    TableColumn("Linked Targets", value: \.linkedTargetSummary) { row in
                        Text(row.linkedTargetSummary)
                    }
                }
                .onChange(of: model.selectedRowIDs) { _, _ in
                    model.syncSelectedMetadata()
                }
                .onChange(of: model.sortOrder) { _, newValue in
                    model.updateSortOrder(newValue)
                }
                .onChange(of: model.targetFilter) { _, _ in
                    model.syncSelectionToVisibleRows()
                }
                .onChange(of: model.typeFilter) { _, _ in
                    model.syncSelectionToVisibleRows()
                }
                .onChange(of: model.categoryFilter) { _, _ in
                    model.syncSelectionToVisibleRows()
                }
                .onChange(of: model.valueFilter) { _, _ in
                    model.syncSelectionToVisibleRows()
                }
                .onChange(of: model.statusFilter) { _, _ in
                    model.syncSelectionToVisibleRows()
                }
            }
            .padding(.vertical, 4)
        }
        .frame(minHeight: minHeight, maxHeight: .infinity)
        .layoutPriority(2)
    }

    private var filterRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                TextField("Filter subject", text: $model.targetFilter)
                    .textFieldStyle(.roundedBorder)
                TextField("Filter type", text: $model.typeFilter)
                    .textFieldStyle(.roundedBorder)
                TextField("Filter category", text: $model.categoryFilter)
                    .textFieldStyle(.roundedBorder)
                TextField("Filter value or rationale", text: $model.valueFilter)
                    .textFieldStyle(.roundedBorder)
                TextField("Filter status or source", text: $model.statusFilter)
                    .textFieldStyle(.roundedBorder)
            }
            if model.hasActiveFilters {
                HStack {
                    Spacer()
                    Button("Clear Filters") {
                        model.clearFilters()
                        model.syncSelectionToVisibleRows()
                    }
                }
            }
        }
    }

    private var discoveryProposalSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Review Proposed Metadata")
                .font(.title2)
                .fontWeight(.semibold)
            Text("These proposals came from the display-discovery conversation. Applying them creates tag definitions and assigns them to the linked xLights models.")
                .foregroundStyle(.secondary)
            List(model.discoveryProposals) { proposal in
                VStack(alignment: .leading, spacing: 6) {
                    Text(proposal.tagName)
                        .font(.headline)
                    if !proposal.tagDescription.isEmpty {
                        Text(proposal.tagDescription)
                    }
                    Text("Targets: \(proposal.targetNames.joined(separator: ", "))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !proposal.rationale.isEmpty {
                        Text(proposal.rationale)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }
            HStack {
                Spacer()
                Button("Close") {
                    model.showDiscoveryProposalSheet = false
                }
                Button("Apply") {
                    model.applyDiscoveryProposals()
                }
            }
        }
        .padding(24)
        .frame(minWidth: 720, minHeight: 420)
    }

    private var addTagSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Add Tag")
                .font(.title2)
                .fontWeight(.semibold)
            Text("Apply one tag across the linked models for the current metadata selection.")
                .foregroundStyle(.secondary)
            Form {
                Picker("Mode", selection: $model.addTagMode) {
                    Text("Existing Tag").tag(LayoutScreenViewModel.AddTagMode.existing)
                    Text("New Tag").tag(LayoutScreenViewModel.AddTagMode.new)
                }
                .pickerStyle(.segmented)

                if model.addTagMode == .existing {
                    Picker("Tag", selection: $model.selectedExistingTagID) {
                        ForEach(model.screenModel.tagDefinitions) { tag in
                            Text(tag.name).tag(tag.id)
                        }
                    }
                } else {
                    TextField("Tag Name", text: $model.newTagName)
                    TextField("Description (Optional)", text: $model.newTagDescription)
                }

                Text("Linked Models: \(model.selectedLinkedTargets.count)")
                    .foregroundStyle(.secondary)
            }
            HStack {
                Spacer()
                Button("Cancel") {
                    model.showAddTagSheet = false
                }
                Button("Apply") {
                    model.applyAddTag()
                }
                .disabled(
                    model.addTagMode == .existing
                        ? model.selectedExistingTagID.isEmpty
                        : model.newTagName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                )
            }
        }
        .padding(24)
        .frame(minWidth: 460)
    }

    private var removeTagSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Remove Tag")
                .font(.title2)
                .fontWeight(.semibold)
            Text("Remove one tag from the linked models for the current metadata selection.")
                .foregroundStyle(.secondary)
            Form {
                Picker("Tag", selection: $model.selectedRemovalTagID) {
                    ForEach(model.removableTags) { tag in
                        Text(tag.name).tag(tag.id)
                    }
                }
                Text("Linked Models: \(model.selectedLinkedTargets.count)")
                    .foregroundStyle(.secondary)
            }
            HStack {
                Spacer()
                Button("Cancel") {
                    model.showRemoveTagSheet = false
                }
                Button("Remove") {
                    model.applyRemoveTag()
                }
                .disabled(model.selectedRemovalTagID.isEmpty)
            }
        }
        .padding(24)
        .frame(minWidth: 420)
    }

    private var manageTagsSheet: some View {
        NavigationSplitView {
            List(
                model.screenModel.tagDefinitions,
                selection: Binding(
                    get: { model.manageSelectedTagID },
                    set: { model.selectManagedTag(id: $0) }
                )
            ) { tag in
                VStack(alignment: .leading, spacing: 4) {
                    TagChip(tag: tag)
                    Text("Used by \(tag.usageCount) targets")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .tag(tag.id)
            }
            .toolbar {
                Button("New Tag") {
                    model.startNewManagedTag()
                }
            }
        } detail: {
            VStack(alignment: .leading, spacing: 16) {
                Text(model.manageSelectedTagID == nil ? "New Tag" : "Edit Tag")
                    .font(.title2)
                    .fontWeight(.semibold)
                Form {
                    TextField("Tag Name", text: $model.manageTagName)
                    Picker("Color", selection: $model.manageTagColor) {
                        ForEach(LayoutTagColor.allCases, id: \.self) { color in
                            Text(color.displayName).tag(color)
                        }
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(.headline)
                        TextEditor(text: $model.manageTagDescription)
                            .frame(minHeight: 120)
                    }
                }
                HStack {
                    Button("Save") {
                        model.saveManagedTag()
                    }
                    .disabled(!model.canSaveManagedTag)
                    Spacer()
                    if model.manageSelectedTagID != nil {
                        Button("Delete Tag", role: .destructive) {
                            model.deleteManagedTag()
                        }
                    }
                    Button("Done") {
                        model.finishManageTags()
                    }
                }
            }
            .padding(24)
        }
        .frame(minWidth: 760, minHeight: 440)
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(Capsule())
    }

    private func bannerView(_ banner: LayoutBannerModel) -> some View {
        Text(banner.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(bannerColor(for: banner.state))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func bannerColor(for state: LayoutReadinessState) -> Color {
        switch state {
        case .ready:
            return Color(nsColor: .systemGreen).opacity(0.12)
        case .needsReview:
            return Color(nsColor: .systemOrange).opacity(0.12)
        case .blocked:
            return Color(nsColor: .systemRed).opacity(0.12)
        }
    }

    private func detailRow(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.subheadline)
                .fontWeight(.semibold)
            Text(value)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
        }
    }

    private func detailCard(label: String, value: String) -> some View {
        detailRow(label: label, value: value)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func compactInfoChip(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value.isEmpty ? "None" : value)
                .font(.subheadline)
                .fontWeight(.medium)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func tagSection(title: String, tags: [LayoutTagDefinitionModel]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            if tags.isEmpty {
                Text("No related tags yet.")
                    .foregroundStyle(.secondary)
            } else {
                FlowTagList(tags: tags)
            }
        }
    }
}

private struct FlowTagList: View {
    let tags: [LayoutTagDefinitionModel]

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 120), spacing: 8, alignment: .leading)],
            alignment: .leading,
            spacing: 8
        ) {
            ForEach(tags) { tag in
                VStack(alignment: .leading, spacing: 4) {
                    TagChip(tag: tag)
                    if !tag.description.isEmpty {
                        Text(tag.description)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Color(nsColor: .controlBackgroundColor).opacity(0.6))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
    }
}

private struct TagRowChips: View {
    let tags: [LayoutTagDefinitionModel]

    var body: some View {
        if tags.isEmpty {
            Text("No tags")
                .foregroundStyle(.secondary)
        } else {
            FlowTagList(tags: Array(tags.prefix(3)))
        }
    }
}

private struct TagChip: View {
    let tag: LayoutTagDefinitionModel

    var body: some View {
        Text(tag.name)
            .font(.caption)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundStyle(tagForegroundColor)
            .background(tagBackgroundColor)
            .clipShape(Capsule())
    }

    private var tagBackgroundColor: Color {
        switch tag.color {
        case .none:
            return Color(nsColor: .controlBackgroundColor)
        case .red:
            return Color.red.opacity(0.18)
        case .orange:
            return Color.orange.opacity(0.18)
        case .yellow:
            return Color.yellow.opacity(0.2)
        case .green:
            return Color.green.opacity(0.18)
        case .teal:
            return Color.teal.opacity(0.18)
        case .blue:
            return Color.blue.opacity(0.18)
        case .purple:
            return Color.purple.opacity(0.18)
        case .pink:
            return Color.pink.opacity(0.18)
        case .gray:
            return Color.gray.opacity(0.18)
        }
    }

    private var tagForegroundColor: Color {
        switch tag.color {
        case .yellow:
            return Color.black.opacity(0.75)
        default:
            return .primary
        }
    }
}
