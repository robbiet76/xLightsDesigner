import SwiftUI

struct DisplayScreenView: View {
    @Bindable var model: DisplayScreenViewModel

    var body: some View {
        GeometryReader { proxy in
            let topSectionHeight = max(220, min(280, proxy.size.height * 0.28))
            let gridMinHeight = max(360, proxy.size.height * 0.5)

            VStack(alignment: .leading, spacing: 16) {
                header
                compactTopSection(height: topSectionHeight)
                metadataSection(minHeight: gridMinHeight)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .task {
            model.loadDisplay()
        }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.loadDisplay()
        }
        .onReceive(NotificationCenter.default.publisher(for: .displayDiscoveryDidChange)) { _ in
            model.loadDisplay()
        }
        .sheet(isPresented: $model.showDiscoveryProposalSheet) {
            discoveryProposalSheet
        }
        .sheet(isPresented: $model.showMetadataEditorSheet) {
            metadataEditorSheet
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
        .alert(
            "Delete Metadata",
            isPresented: Binding(
                get: { model.pendingDeleteRow != nil },
                set: { newValue in
                    if !newValue { model.pendingDeleteRow = nil }
                }
            )
        ) {
            Button("Delete", role: .destructive) {
                model.confirmDeleteSelectedMetadata()
            }
            Button("Cancel", role: .cancel) {
                model.pendingDeleteRow = nil
            }
        } message: {
            Text("Remove this metadata entry from the display understanding?")
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

    private func compactTopSection(height: CGFloat) -> some View {
        HStack(alignment: .top, spacing: 16) {
            GroupBox("Display Status") {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(alignment: .firstTextBaseline) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(model.readinessStageTitle)
                                    .font(.title3)
                                    .fontWeight(.semibold)
                                Text("\(Int((model.readinessProgress * 100).rounded()))% understood")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            chip(model.screenModel.readinessSummary.state.rawValue)
                        }

                        ProgressView(value: model.readinessProgress)
                            .controlSize(.large)

                        Text(model.readinessDetailText)
                            .foregroundStyle(.secondary)

                        HStack(alignment: .top, spacing: 16) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Covered")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                if model.coveredBranches.isEmpty {
                                    Text("No major areas covered yet.")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                } else {
                                    flowStringSection(labels: model.coveredBranches, backgroundTint: .green.opacity(0.16))
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            VStack(alignment: .leading, spacing: 8) {
                                Text("Still Needed")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                if model.missingBranches.isEmpty {
                                    Text("Nothing major is missing.")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                } else {
                                    flowStringSection(labels: model.missingBranches, backgroundTint: .red.opacity(0.16))
                                }
                            }
                        }

                        if !model.screenModel.banners.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(model.screenModel.banners) { banner in
                                    bannerView(banner)
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            currentSelectionSection()
                .frame(maxWidth: .infinity)
                .frame(maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(height: height)
        .layoutPriority(1)
    }

    private func currentSelectionSection() -> some View {
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
                            compactInfoChip(label: "Linked", value: "\(entry.linkedTargets.count)")
                        }
                        detailCard(label: "Meaning", value: entry.value)
                        if !entry.rationale.isEmpty {
                            detailCard(label: "Rationale", value: entry.rationale)
                        }
                        if !entry.linkedTargets.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Linked Models")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                Text(entry.linkedTargets.joined(separator: ", "))
                                    .font(.subheadline)
                                    .foregroundStyle(.primary)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(12)
                                    .background(Color.secondary.opacity(0.08))
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                            }
                        }
                        if !entry.relatedLabels.isEmpty {
                            labelSection(title: "Applied Labels", labels: entry.relatedLabels)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(maxHeight: .infinity, alignment: .topLeading)
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
                        VStack(alignment: .leading, spacing: 2) {
                            Text(row.subject)
                                .fontWeight(.medium)
                            Text(row.subjectType)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    TableColumn("Category", value: \.category) { row in
                        Text(row.category)
                    }
                    TableColumn("Meaning", value: \.value) { row in
                        Text(row.value)
                            .lineLimit(2)
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
                .onChange(of: model.searchText) { _, _ in
                    model.syncSelectionToVisibleRows()
                }
                .onChange(of: model.categoryFilter) { _, _ in
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
                Button("Add Metadata") {
                    model.startAddMetadata()
                }
                Button("Propose From Layout") {
                    model.proposeMetadataFromLayout()
                }
                .disabled(model.screenModel.rows.isEmpty)
                if !model.discoveryProposals.isEmpty {
                    Button("Review Proposals (\(model.discoveryProposals.count))") {
                        model.reviewDiscoveryProposals()
                    }
                }
                Button("Edit") {
                    model.startEditSelectedMetadata()
                }
                .disabled(model.selectedMetadataRows.isEmpty)
                Button("Delete", role: .destructive) {
                    model.deleteSelectedMetadata()
                }
                .disabled(model.selectedMetadataRows.isEmpty)
                TextField("Search subject, meaning, or rationale", text: $model.searchText)
                    .textFieldStyle(.roundedBorder)
                Picker("Category", selection: $model.categoryFilter) {
                    ForEach(model.availableCategories, id: \.self) { category in
                        Text(category).tag(category)
                    }
                }
                .frame(width: 220)
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

    private var metadataEditorSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(model.metadataEditor.isEditing ? "Edit Metadata" : "Add Metadata")
                .font(.title2)
                .fontWeight(.semibold)

            Grid(alignment: .leadingFirstTextBaseline, horizontalSpacing: 12, verticalSpacing: 12) {
                GridRow {
                    Text("Subject")
                    TextField("HiddenTree", text: $model.metadataEditor.subject)
                }
                GridRow {
                    Text("Type")
                    Picker("Type", selection: $model.metadataEditor.subjectType) {
                        ForEach(model.allowedMetadataSubjectTypes, id: \.self) { type in
                            Text(type).tag(type)
                        }
                    }
                    .labelsHidden()
                }
                GridRow {
                    Text("Category")
                    Picker("Category", selection: $model.metadataEditor.category) {
                        ForEach(model.allowedMetadataCategories, id: \.self) { category in
                            Text(category).tag(category)
                        }
                    }
                    .labelsHidden()
                }
                GridRow {
                    Text("Meaning")
                    TextField("Primary focal structure and central anchor", text: $model.metadataEditor.value, axis: .vertical)
                        .lineLimit(3...5)
                }
                GridRow {
                    Text("Rationale")
                    TextField("Optional supporting note", text: $model.metadataEditor.rationale, axis: .vertical)
                        .lineLimit(2...4)
                }
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Linked Targets")
                    .font(.headline)
                TextField("Filter targets", text: $model.metadataEditor.targetSearchText)
                    .textFieldStyle(.roundedBorder)

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 6) {
                        ForEach(model.filteredEditorTargetNames, id: \.self) { targetName in
                            Toggle(isOn: Binding(
                                get: { model.metadataEditor.targetNames.contains(targetName) },
                                set: { _ in model.toggleMetadataEditorTarget(targetName) }
                            )) {
                                Text(targetName)
                            }
                            .toggleStyle(.checkbox)
                        }
                    }
                }
                .frame(minHeight: 140, maxHeight: 220)
                .overlay {
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.secondary.opacity(0.2))
                }

            }

            Text("Choose the exact xLights targets this metadata applies to. Subject naming alone is not treated as sufficient linkage.")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack {
                Spacer()
                Button("Cancel") {
                    model.showMetadataEditorSheet = false
                }
                Button("Save") {
                    model.saveMetadataEditor()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(minWidth: 620, minHeight: 320)
    }

    private var discoveryProposalSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Review Proposed Metadata")
                .font(.title2)
                .fontWeight(.semibold)
            Text("These proposals came from display discovery or the live xLights layout. Applying them promotes the reviewed metadata into the active display label store and maps it to the linked xLights models.")
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

    private func chip(_ text: String) -> some View {
        Text(text)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(Capsule())
    }

    private func bannerView(_ banner: DisplayBannerModel) -> some View {
        Text(banner.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(bannerColor(for: banner.state))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func flowLabelSection(labels: [String]) -> some View {
        LazyVGrid(columns: [
            GridItem(.adaptive(minimum: 120, maximum: 220), spacing: 8, alignment: .leading)
        ], alignment: .leading, spacing: 8) {
            ForEach(labels, id: \.self) { label in
                Text(label)
                    .font(.caption)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.secondary.opacity(0.10))
                    .clipShape(Capsule())
            }
        }
    }

    private func flowStringSection(labels: [String], backgroundTint: Color) -> some View {
        LazyVGrid(columns: [
            GridItem(.adaptive(minimum: 140, maximum: 220), spacing: 8, alignment: .leading)
        ], alignment: .leading, spacing: 8) {
            ForEach(labels, id: \.self) { label in
                Text(label)
                    .font(.caption)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(backgroundTint)
                    .clipShape(Capsule())
            }
        }
    }

    private func bannerColor(for state: DisplayReadinessState) -> Color {
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

    private func labelSection(title: String, labels: [DisplayLabelDefinitionModel]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            if labels.isEmpty {
                Text("No related labels yet.")
                    .foregroundStyle(.secondary)
            } else {
                FlowLabelList(labels: labels)
            }
        }
    }
}

private struct FlowLabelList: View {
    let labels: [DisplayLabelDefinitionModel]

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 120), spacing: 8, alignment: .leading)],
            alignment: .leading,
            spacing: 8
        ) {
            ForEach(labels) { label in
                VStack(alignment: .leading, spacing: 4) {
                    LabelChip(label: label)
                    if !label.description.isEmpty {
                        Text(label.description)
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

private struct LabelChip: View {
    let label: DisplayLabelDefinitionModel

    var body: some View {
        Text(label.name)
            .font(.caption)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .foregroundStyle(labelForegroundColor)
            .background(labelBackgroundColor)
            .clipShape(Capsule())
    }

    private var labelBackgroundColor: Color {
        switch label.color {
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

    private var labelForegroundColor: Color {
        switch label.color {
        case .yellow:
            return Color.black.opacity(0.75)
        default:
            return .primary
        }
    }
}
