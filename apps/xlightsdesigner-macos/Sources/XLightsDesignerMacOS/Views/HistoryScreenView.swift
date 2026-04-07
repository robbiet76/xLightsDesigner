import SwiftUI

struct HistoryScreenView: View {
    @Bindable var model: HistoryScreenViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            if let banner = model.screenModel.banners.first {
                bannerView(banner)
            }
            summaryBand
            mainSplit
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { model.loadHistory() }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.loadHistory()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.screenModel.header.title)
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text(model.screenModel.header.subtitle)
                .foregroundStyle(.secondary)
            Text(model.screenModel.header.activeProjectName)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var summaryBand: some View {
        GroupBox("History Summary") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 10) {
                    chip("Total \(model.screenModel.summary.totalEventCount)")
                    if !model.screenModel.summary.latestEventTimestamp.isEmpty {
                        chip(model.screenModel.summary.latestEventTimestamp)
                    }
                }
                detailRow(label: "Latest Event", value: model.screenModel.summary.latestEventSummary)
                if !model.screenModel.summary.groupedTypeSummaries.isEmpty {
                    detailRow(label: "Event Types", value: model.screenModel.summary.groupedTypeSummaries.joined(separator: " • "))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private var mainSplit: some View {
        AdaptiveSplitView(breakpoint: 1180, spacing: 20) {
            GroupBox("Events") {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Search", text: $model.searchQuery)
                        .textFieldStyle(.roundedBorder)
                    Table(model.filteredRows, selection: Binding(
                        get: { model.selectedRowID },
                        set: { model.selectRow(id: $0) }
                    )) {
                        TableColumn("When") { row in Text(row.timestampSummary) }
                        TableColumn("Type") { row in Text(row.eventType) }
                        TableColumn("Summary") { row in Text(row.summary).lineLimit(1) }
                        TableColumn("Sequence") { row in Text(row.sequenceSummary).lineLimit(1) }
                        TableColumn("Result") { row in Text(row.resultSummary).lineLimit(1) }
                        TableColumn("Artifacts") { row in Text(row.artifactAvailabilitySummary).lineLimit(1) }
                    }
                    .frame(minHeight: 420)
                }
                .padding(.vertical, 4)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        } secondary: {
            GroupBox("Selected Event") {
                VStack(alignment: .leading, spacing: 10) {
                    switch model.screenModel.selectedEvent {
                    case let .none(message):
                        Text(message)
                            .foregroundStyle(.secondary)
                    case let .error(message):
                        Text(message)
                            .foregroundStyle(.secondary)
                    case let .selected(detail):
                        Text(detail.identity)
                            .font(.title2)
                            .fontWeight(.semibold)
                        detailRow(label: "When", value: detail.timestamp)
                        detailRow(label: "Type", value: detail.eventType)
                        detailRow(label: "Project", value: detail.relatedProjectSummary)
                        detailRow(label: "Sequence", value: detail.relatedSequenceSummary)
                        detailRow(label: "Change", value: detail.changeSummary)
                        detailRow(label: "Result", value: detail.resultSummary)
                        detailRow(label: "References", value: detail.artifactReferences.joined(separator: " • "))
                        if !detail.warnings.isEmpty {
                            bulletSection(title: "Warnings", items: detail.warnings)
                        }
                        detailRow(label: "Follow Up", value: detail.followUpSummary)
                        HStack {
                            Spacer()
                            Button("Reveal Artifact") { model.revealSelectedArtifact() }
                                .disabled(detail.artifactPath == nil)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            }
        }
        .frame(minHeight: 420)
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(Capsule())
    }

    private func detailRow(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.headline)
            Text(value)
                .foregroundStyle(.secondary)
                .textSelection(.enabled)
        }
    }

    private func bulletSection(title: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.headline)
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                Text("• \(item)")
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func bannerView(_ banner: WorkflowBannerModel) -> some View {
        Text(banner.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
