import SwiftUI

struct SequenceScreenView: View {
    @Bindable var model: SequenceScreenViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            if let banner = model.screenModel.banners.first { bannerView(banner) }
            contextBand
            HSplitView {
                translationPane
                detailPane
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { model.refresh() }
    }

    private var header: some View { VStack(alignment: .leading, spacing: 8) { Text(model.screenModel.title).font(.largeTitle).fontWeight(.semibold); Text(model.screenModel.subtitle).foregroundStyle(.secondary) } }

    private var contextBand: some View {
        GroupBox("Sequence Context") {
            VStack(alignment: .leading, spacing: 10) {
                Text(model.screenModel.activeSequence.identity.title).font(.title2).fontWeight(.semibold)
                Text(model.screenModel.activeSequence.identity.subtitle).foregroundStyle(.secondary)
                HStack(spacing: 10) { chip(model.screenModel.activeSequence.identity.state.rawValue); chip(model.screenModel.activeSequence.identity.updatedSummary) }
                detailRow(label: "Active Sequence", value: model.screenModel.activeSequence.activeSequenceName)
                detailRow(label: "Sequence Path", value: model.screenModel.activeSequence.sequencePathSummary)
                detailRow(label: "Bound Track", value: model.screenModel.activeSequence.boundTrackSummary)
                detailRow(label: "Timing", value: model.screenModel.activeSequence.timingSummary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private var translationPane: some View {
        GroupBox("Translation Readiness") {
            VStack(alignment: .leading, spacing: 12) {
                chip(model.screenModel.translationSummary.state.rawValue)
                detailRow(label: "Readiness", value: model.screenModel.translationSummary.readinessSummary)
                bulletSection(title: "Blockers", items: model.screenModel.translationSummary.blockers)
                bulletSection(title: "Warnings", items: model.screenModel.translationSummary.warnings)
                detailRow(label: "Handoff", value: model.screenModel.translationSummary.handoffSummary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.vertical, 4)
        }
    }

    private var detailPane: some View {
        GroupBox("Technical Detail") {
            VStack(alignment: .leading, spacing: 12) {
                detailRow(label: "Revision", value: model.screenModel.detail.revisionSummary)
                detailRow(label: "Settings", value: model.screenModel.detail.settingsSummary)
                detailRow(label: "Binding", value: model.screenModel.detail.bindingSummary)
                detailRow(label: "Materialization", value: model.screenModel.detail.materializationSummary)
                bulletSection(title: "Technical Warnings", items: model.screenModel.detail.technicalWarnings)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.vertical, 4)
        }
        .frame(minWidth: 320)
    }

    private func chip(_ text: String) -> some View { Text(text).padding(.horizontal, 10).padding(.vertical, 4).background(Color(nsColor: .controlBackgroundColor)).clipShape(Capsule()) }
    private func detailRow(label: String, value: String) -> some View { VStack(alignment: .leading, spacing: 4) { Text(label).font(.headline); Text(value).foregroundStyle(.secondary) } }
    private func bulletSection(title: String, items: [String]) -> some View { VStack(alignment: .leading, spacing: 6) { Text(title).font(.headline); ForEach(Array(items.enumerated()), id: \.offset) { _, item in Text("• \(item)").foregroundStyle(.secondary) } } }
    private func bannerView(_ banner: WorkflowBannerModel) -> some View { Text(banner.text).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Color(nsColor: .controlBackgroundColor)).clipShape(RoundedRectangle(cornerRadius: 10)) }
}
