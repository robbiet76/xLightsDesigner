import SwiftUI

struct ReviewScreenView: View {
    @Bindable var model: ReviewScreenViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            ForEach(model.screenModel.banners, id: \.id) { banner in
                bannerView(banner)
            }
            pendingBand
            AdaptiveSplitView(breakpoint: 1100, spacing: 20) {
                supportPane(title: model.screenModel.designSummary.title, summary: model.screenModel.designSummary)
            } secondary: {
                supportPane(title: model.screenModel.sequenceSummary.title, summary: model.screenModel.sequenceSummary)
            }
            actionPane
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { model.refresh() }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.refresh()
        }
    }

    private var header: some View { VStack(alignment: .leading, spacing: 8) { Text(model.screenModel.title).font(.largeTitle).fontWeight(.semibold); Text(model.screenModel.subtitle).foregroundStyle(.secondary) } }

    private var pendingBand: some View {
        GroupBox("Pending Work") {
            VStack(alignment: .leading, spacing: 10) {
                Text(model.screenModel.pendingSummary.identity.title).font(.title2).fontWeight(.semibold)
                Text(model.screenModel.pendingSummary.identity.subtitle).foregroundStyle(.secondary)
                HStack(spacing: 10) { chip(model.screenModel.pendingSummary.identity.state.rawValue); chip(model.screenModel.pendingSummary.identity.updatedSummary) }
                detailRow(label: "Pending Summary", value: model.screenModel.pendingSummary.pendingSummary)
                detailRow(label: "Target Sequence", value: model.screenModel.pendingSummary.targetSequenceSummary)
                detailRow(label: "Readiness", value: model.screenModel.pendingSummary.readinessSummary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private func supportPane(title: String, summary: ReviewSupportSummaryModel) -> some View {
        GroupBox(title) {
            VStack(alignment: .leading, spacing: 10) {
                Text(summary.summary).foregroundStyle(.secondary)
                bulletSection(title: "Highlights", items: summary.highlights)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.vertical, 4)
        }
    }

    private var actionPane: some View {
        GroupBox("Apply Gate") {
            VStack(alignment: .leading, spacing: 12) {
                chip(model.screenModel.readiness.state.rawValue)
                bulletSection(title: "Blockers", items: model.screenModel.readiness.blockers)
                bulletSection(title: "Warnings", items: model.screenModel.readiness.warnings)
                bulletSection(title: "Apply Preview", items: model.screenModel.readiness.applyPreviewLines)
                detailRow(label: "Impact", value: model.screenModel.readiness.impactSummary)
                detailRow(label: "Backup / Restore", value: model.screenModel.readiness.backupSummary)
                HStack {
                    Button(model.screenModel.actions.applyButtonTitle) { model.applyPendingWork() }
                        .buttonStyle(.borderedProminent)
                        .disabled(!model.screenModel.actions.canApply)
                    Button(model.screenModel.actions.deferButtonTitle) { model.deferPendingWork() }
                        .disabled(!model.screenModel.actions.canDefer)
                    Button(model.screenModel.actions.restoreBackupButtonTitle) { model.restoreLastBackup() }
                        .disabled(!model.screenModel.actions.canRestoreBackup)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private func chip(_ text: String) -> some View { Text(text).padding(.horizontal, 10).padding(.vertical, 4).background(Color(nsColor: .controlBackgroundColor)).clipShape(Capsule()) }
    private func detailRow(label: String, value: String) -> some View { VStack(alignment: .leading, spacing: 4) { Text(label).font(.headline); Text(value).foregroundStyle(.secondary) } }
    private func bulletSection(title: String, items: [String]) -> some View { VStack(alignment: .leading, spacing: 6) { Text(title).font(.headline); ForEach(Array(items.enumerated()), id: \.offset) { _, item in Text("• \(item)").foregroundStyle(.secondary) } } }
    private func bannerView(_ banner: WorkflowBannerModel) -> some View { Text(banner.text).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Color(nsColor: .controlBackgroundColor)).clipShape(RoundedRectangle(cornerRadius: 10)) }
}
