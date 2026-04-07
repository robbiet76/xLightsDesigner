import SwiftUI

struct LayoutScreenView: View {
    @Bindable var model: LayoutScreenViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            readinessBand
            mainSplit
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task {
            model.loadLayout()
        }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.loadLayout()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.screenModel.header.title)
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text(model.screenModel.header.subtitle)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Text(model.screenModel.header.activeProjectName)
                Text(model.screenModel.header.sourceSummary)
                    .foregroundStyle(.secondary)
            }
            .font(.subheadline)
        }
    }

    private var readinessBand: some View {
        GroupBox("Readiness") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    chip(model.screenModel.readinessSummary.state.rawValue)
                    chip("Total \(model.screenModel.readinessSummary.totalTargets)")
                    chip("Ready \(model.screenModel.readinessSummary.readyCount)")
                    chip("Needs Review \(model.screenModel.readinessSummary.unresolvedCount)")
                }
                Text(model.screenModel.readinessSummary.explanationText)
                Text(model.screenModel.readinessSummary.nextStepText)
                    .foregroundStyle(.secondary)
                ForEach(model.screenModel.banners) { banner in
                    Text(banner.text)
                        .foregroundStyle(.secondary)
                }
                HStack {
                    Spacer()
                    Button("Refresh Layout") { model.loadLayout() }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private var mainSplit: some View {
        HStack(alignment: .top, spacing: 20) {
            GroupBox("Targets") {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Search", text: $model.searchQuery)
                        .textFieldStyle(.roundedBorder)
                    Table(model.filteredRows, selection: Binding(
                        get: { model.selectedRowID },
                        set: { model.selectRow(id: $0) }
                    )) {
                        TableColumn("Target") { row in Text(row.targetName) }
                        TableColumn("Type") { row in Text(row.targetType) }
                        TableColumn("Tags") { row in Text(row.tagSummary).lineLimit(1) }
                        TableColumn("Assignment") { row in Text(row.assignmentSummary).lineLimit(1) }
                        TableColumn("Support State") { row in Text(row.supportStateSummary) }
                        TableColumn("Issues") { row in Text(row.issuesSummary).lineLimit(1) }
                        TableColumn("Action") { row in Text(row.actionSummaryText).lineLimit(1) }
                    }
                    .frame(minHeight: 420)
                }
                .padding(.vertical, 4)
            }
            .frame(minWidth: 640)

            GroupBox("Selected Target") {
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
                            .font(.title2)
                            .fontWeight(.semibold)
                        detailRow(label: "Type", value: target.type)
                        detailRow(label: "Readiness", value: target.readinessState.rawValue)
                        detailRow(label: "Tags", value: target.currentTags)
                        detailRow(label: "Assignment", value: target.assignmentSummary)
                        detailRow(label: "Reason", value: target.reason)
                        detailRow(label: "Recommended Action", value: target.recommendedAction)
                        detailRow(label: "Downstream Effect", value: target.downstreamEffectSummary)
                        detailRow(label: "Source", value: target.sourcePathSummary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            }
            .frame(minWidth: 320, maxWidth: 380)
        }
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
        }
    }
}
