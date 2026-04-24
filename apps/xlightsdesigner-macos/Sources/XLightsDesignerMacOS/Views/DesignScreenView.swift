import SwiftUI

struct DesignScreenView: View {
    @Bindable var model: DesignScreenViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            if let banner = model.screenModel.banners.first { bannerView(banner) }
            if let banner = model.transientBanner { bannerView(banner) }
            summaryBand
            AdaptiveSplitView(breakpoint: 1100, spacing: 20) {
                authoringPane
            } secondary: {
                VStack(alignment: .leading, spacing: 20) {
                    proposalPane
                    rationalePane
                }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { model.refresh() }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.refresh()
        }
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

    private var authoringPane: some View {
        GroupBox(model.screenModel.authoring.title) {
            VStack(alignment: .leading, spacing: 14) {
                Text(model.screenModel.authoring.summary)
                    .foregroundStyle(.secondary)
                designEditor(label: "Goal", text: $model.intentDraft.goal, minHeight: 74)
                designEditor(label: "Mood / Style", text: $model.intentDraft.mood, minHeight: 74)
                designEditor(label: "Target Scope", text: $model.intentDraft.targetScope, minHeight: 74)
                designEditor(label: "Constraints", text: $model.intentDraft.constraints, minHeight: 90)
                designEditor(label: "References", text: $model.intentDraft.references, minHeight: 90)
                designEditor(label: "Approval Notes", text: $model.intentDraft.approvalNotes, minHeight: 74)
                HStack(spacing: 10) {
                    Button("Save Design Intent") {
                        model.saveDesignIntent()
                    }
                    .disabled(!model.screenModel.authoring.canSave)
                    Button("Revert Edits") {
                        model.resetDesignIntentEdits()
                    }
                    .disabled(model.intentDraft == model.savedIntentDraft)
                    Text(model.screenModel.authoring.lastSavedSummary)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
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
        .frame(maxWidth: 460, alignment: .topLeading)
    }

    private func chip(_ text: String) -> some View { Text(text).padding(.horizontal, 10).padding(.vertical, 4).background(Color(nsColor: .controlBackgroundColor)).clipShape(Capsule()) }
    private func detailRow(label: String, value: String) -> some View { VStack(alignment: .leading, spacing: 4) { Text(label).font(.headline); Text(value).foregroundStyle(.secondary) } }
    private func bulletSection(title: String, items: [String]) -> some View { VStack(alignment: .leading, spacing: 6) { Text(title).font(.headline); ForEach(Array(items.enumerated()), id: \.offset) { _, item in Text("• \(item)").foregroundStyle(.secondary) } } }
    private func bannerView(_ banner: WorkflowBannerModel) -> some View { Text(banner.text).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Color(nsColor: .controlBackgroundColor)).clipShape(RoundedRectangle(cornerRadius: 10)) }
    private func designEditor(label: String, text: Binding<String>, minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.headline)
            TextEditor(text: text)
                .font(.body)
                .frame(minHeight: minHeight)
                .padding(6)
                .background(Color(nsColor: .textBackgroundColor))
                .clipShape(RoundedRectangle(cornerRadius: 6))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color(nsColor: .separatorColor)))
                .onChange(of: text.wrappedValue) { _, _ in
                    model.updateAuthoringState()
                }
        }
    }
}
