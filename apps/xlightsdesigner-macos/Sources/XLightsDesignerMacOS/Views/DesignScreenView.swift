import SwiftUI

struct DesignScreenView: View {
    @Bindable var model: DesignScreenViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            if let banner = model.screenModel.banners.first { bannerView(banner) }
            summaryBand
            HSplitView {
                proposalPane
                rationalePane
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { model.refresh() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.screenModel.title).font(.largeTitle).fontWeight(.semibold)
            Text(model.screenModel.subtitle).foregroundStyle(.secondary)
        }
    }

    private var summaryBand: some View {
        GroupBox("Design Summary") {
            VStack(alignment: .leading, spacing: 10) {
                Text(model.screenModel.summary.identity.title).font(.title2).fontWeight(.semibold)
                Text(model.screenModel.summary.identity.subtitle).foregroundStyle(.secondary)
                HStack(spacing: 10) {
                    chip(model.screenModel.summary.identity.state.rawValue)
                    chip(model.screenModel.summary.identity.updatedSummary)
                }
                detailRow(label: "Brief", value: model.screenModel.summary.briefSummary)
                detailRow(label: "Proposal", value: model.screenModel.summary.proposalSummary)
                detailRow(label: "Readiness", value: model.screenModel.summary.readinessText)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private var proposalPane: some View {
        GroupBox("Proposal") {
            VStack(alignment: .leading, spacing: 10) {
                detailRow(label: model.screenModel.proposal.briefTitle, value: model.screenModel.proposal.briefSummary)
                detailRow(label: model.screenModel.proposal.proposalTitle, value: model.screenModel.proposal.proposalSummary)
                detailRow(label: "Reference Direction", value: model.screenModel.proposal.referenceDirection)
                detailRow(label: "Director Influence", value: model.screenModel.proposal.directorInfluence)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.vertical, 4)
        }
    }

    private var rationalePane: some View {
        GroupBox("Rationale") {
            VStack(alignment: .leading, spacing: 14) {
                bulletSection(title: "Rationale Notes", items: model.screenModel.rationale.rationaleNotes)
                bulletSection(title: "Assumptions", items: model.screenModel.rationale.assumptions)
                bulletSection(title: "Open Questions", items: model.screenModel.rationale.openQuestions)
                bulletSection(title: "Warnings", items: model.screenModel.rationale.warnings)
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
