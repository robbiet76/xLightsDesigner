import SwiftUI

struct LayoutScreenView: View {
    @Bindable var model: LayoutScreenViewModel

    var body: some View {
        GeometryReader { proxy in
            let currentSelectionMinHeight = max(120, min(150, proxy.size.height * 0.14))
            let currentSelectionMaxHeight = max(150, min(220, proxy.size.height * 0.24))
            let gridMinHeight = max(260, proxy.size.height * 0.36)

            VStack(alignment: .leading, spacing: 20) {
                header
                summarySection
                controlsSection
                currentSelectionSection(minHeight: currentSelectionMinHeight, maxHeight: currentSelectionMaxHeight)
                targetsSection(minHeight: gridMinHeight)
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
        .sheet(isPresented: $model.showAddTagSheet) {
            addTagSheet
        }
        .sheet(isPresented: $model.showRemoveTagSheet) {
            removeTagSheet
        }
        .sheet(isPresented: $model.showManageTagsSheet) {
            manageTagsSheet
        }
        .alert(
            "Layout",
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
                    chip("Targets \(model.screenModel.readinessSummary.totalTargets)")
                    if model.screenModel.readinessSummary.unresolvedCount > 0 {
                        chip("Needs Tags \(model.screenModel.readinessSummary.unresolvedCount)")
                    }
                    if !model.screenModel.tagDefinitions.isEmpty {
                        chip("Tags \(model.screenModel.tagDefinitions.count)")
                    }
                }
                Text(model.screenModel.readinessSummary.explanationText)
                if !model.screenModel.readinessSummary.nextStepText.isEmpty {
                    Text(model.screenModel.readinessSummary.nextStepText)
                        .foregroundStyle(.secondary)
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
                Text("Apply and maintain project tags over the active xLights target list.")
                    .foregroundStyle(.secondary)
                HStack(spacing: 10) {
                    Button("Add Tag…") {
                        model.presentAddTagSheet()
                    }
                    .disabled(!model.canAddTag)

                    Button("Remove Tag…") {
                        model.presentRemoveTagSheet()
                    }
                    .disabled(model.removableTags.isEmpty)

                    Button("Manage Tags…") {
                        model.presentManageTagsSheet()
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
                    switch model.screenModel.selectedTarget {
                    case let .none(message):
                        Text(message)
                            .foregroundStyle(.secondary)

                    case let .error(message):
                        Text(message)
                            .foregroundStyle(.secondary)

                    case let .selected(target):
                        Text(target.identity)
                            .font(.title3)
                            .fontWeight(.semibold)
                        HStack(spacing: 10) {
                            compactInfoChip(label: "Type", value: target.type)
                            compactInfoChip(label: "xLights Group", value: target.layoutGroup)
                            compactInfoChip(label: "Status", value: target.readinessState.rawValue)
                        }
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 240), spacing: 12, alignment: .top)],
                            alignment: .leading,
                            spacing: 12
                        ) {
                            if target.reason != "No issues detected" {
                                detailCard(label: "Issue", value: target.reason)
                            }
                            detailCard(label: "Downstream Effect", value: target.downstreamEffectSummary)
                        }
                        tagSection(title: "Assigned Tags", tags: target.assignedTags)

                    case let .multi(selection):
                        Text("\(selection.selectionCount) Targets Selected")
                            .font(.title3)
                            .fontWeight(.semibold)
                        if selection.commonTags.isEmpty {
                            Text("No tags are shared across the current selection.")
                                .foregroundStyle(.secondary)
                        } else {
                            tagSection(title: "Common Tags", tags: selection.commonTags)
                        }
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 240), spacing: 12, alignment: .top)],
                            alignment: .leading,
                            spacing: 12
                        ) {
                            if selection.mixedTagCount > 0 {
                                detailCard(
                                    label: "Mixed Tag State",
                                    value: "\(selection.mixedTagCount) additional tags appear only on part of this selection."
                                )
                            }
                            detailCard(label: "Bulk Edit", value: "Use Add Tag or Remove Tag to update the current selection in bulk.")
                        }
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

    private func targetsSection(minHeight: CGFloat) -> some View {
        GroupBox("Targets") {
            VStack(alignment: .leading, spacing: 12) {
                filterRow
                Table(model.filteredRows, selection: $model.selectedRowIDs, sortOrder: $model.sortOrder) {
                    TableColumn("Target", value: \.targetName) { row in
                        Text(row.targetName)
                    }
                    TableColumn("Type", value: \.targetType) { row in
                        Text(row.targetType)
                    }
                    TableColumn("Tags", value: \.tagSummary) { row in
                        TagRowChips(tags: row.tagDefinitions)
                    }
                    TableColumn("Status", value: \.supportStateSummary) { row in
                        Text(row.supportStateSummary)
                    }
                    TableColumn("xLights Group", value: \.layoutGroup) { row in
                        Text(row.layoutGroup)
                            .lineLimit(1)
                    }
                }
                .onChange(of: model.selectedRowIDs) { _, _ in
                    model.syncSelectedPane()
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
                .onChange(of: model.layoutGroupFilter) { _, _ in
                    model.syncSelectionToVisibleRows()
                }
                .onChange(of: model.tagsFilter) { _, _ in
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
                TextField("Filter target", text: $model.targetFilter)
                    .textFieldStyle(.roundedBorder)
                TextField("Filter type", text: $model.typeFilter)
                    .textFieldStyle(.roundedBorder)
                TextField("Filter tags", text: $model.tagsFilter)
                    .textFieldStyle(.roundedBorder)
                TextField("Filter status", text: $model.statusFilter)
                    .textFieldStyle(.roundedBorder)
                TextField("Filter xLights group", text: $model.layoutGroupFilter)
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

    private var addTagSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Add Tag")
                .font(.title2)
                .fontWeight(.semibold)
            Text("Apply one tag across the current target selection.")
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

                Text("Selected Targets: \(model.selectedRows.count)")
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
            Text("Remove one tag from the current target selection.")
                .foregroundStyle(.secondary)
            Form {
                Picker("Tag", selection: $model.selectedRemovalTagID) {
                    ForEach(model.removableTags) { tag in
                        Text(tag.name).tag(tag.id)
                    }
                }
                Text("Selected Targets: \(model.selectedRows.count)")
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
                Text("No tags assigned.")
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
            HStack(spacing: 6) {
                ForEach(Array(tags.prefix(3))) { tag in
                    TagChip(tag: tag)
                }
                if tags.count > 3 {
                    Text("+\(tags.count - 3)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct TagChip: View {
    let tag: LayoutTagDefinitionModel

    var body: some View {
        Text(tag.name)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(tagBackground)
            .foregroundStyle(tagForeground)
            .clipShape(Capsule())
    }

    private var tagBackground: Color {
        switch tag.color {
        case .none:
            return Color(nsColor: .controlBackgroundColor)
        case .red:
            return Color(nsColor: .systemRed).opacity(0.16)
        case .orange:
            return Color(nsColor: .systemOrange).opacity(0.18)
        case .yellow:
            return Color(nsColor: .systemYellow).opacity(0.20)
        case .green:
            return Color(nsColor: .systemGreen).opacity(0.16)
        case .teal:
            return Color(nsColor: .systemTeal).opacity(0.18)
        case .blue:
            return Color(nsColor: .systemBlue).opacity(0.16)
        case .purple:
            return Color(nsColor: .systemPurple).opacity(0.16)
        case .pink:
            return Color(nsColor: .systemPink).opacity(0.16)
        case .gray:
            return Color(nsColor: .quaternaryLabelColor)
        }
    }

    private var tagForeground: Color {
        switch tag.color {
        case .yellow:
            return Color(nsColor: .labelColor)
        default:
            return .primary
        }
    }
}
