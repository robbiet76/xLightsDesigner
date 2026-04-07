import SwiftUI

struct ProjectScreenView: View {
    @Bindable var model: ProjectScreenViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            if let banner = model.screenModel.banners.first {
                bannerView(banner)
            }
            summaryBand
            actionBand
            contextSection
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task {
            model.loadInitialProject()
        }
        .sheet(isPresented: $model.isShowingProjectSheet) {
            projectSheet
                .padding(24)
                .frame(width: 520)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.screenModel.header.title)
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text(model.screenModel.header.subtitle)
                .foregroundStyle(.secondary)
            Text(model.screenModel.header.statusBadge)
                .font(.subheadline)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color(nsColor: .controlBackgroundColor))
                .clipShape(Capsule())
        }
    }

    private var summaryBand: some View {
        GroupBox("Active Project") {
            if let summary = model.screenModel.summary {
                VStack(alignment: .leading, spacing: 10) {
                    Text(summary.projectName)
                        .font(.title2)
                        .fontWeight(.semibold)
                    detailRow(label: "Project File", value: summary.projectFilePath)
                    detailRow(label: "Show Folder", value: summary.showFolderSummary)
                    detailRow(label: "Media Path", value: summary.mediaPathSummary)
                    detailRow(label: "Readiness", value: summary.readinessExplanation)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            } else {
                Text("No active project. Create or open a project to establish working context.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            }
        }
    }

    private var actionBand: some View {
        GroupBox("Project Actions") {
            HStack(spacing: 10) {
                Button("Create Project…") { model.startCreateProject() }
                Button("Open Project…") { model.openProject() }
                Button("Save Project") { model.saveProject() }
                    .disabled(!model.screenModel.actions.canSave)
                Button("Save Project As…") { model.startSaveAsProject() }
                    .disabled(!model.screenModel.actions.canSaveAs)
                Spacer()
                Button("Choose Show Folder…") { model.chooseShowFolderForActiveProject() }
                    .disabled(model.screenModel.summary == nil)
                Button("Choose Media Folder…") { model.chooseMediaFolderForActiveProject() }
                    .disabled(model.screenModel.summary == nil)
            }
            .padding(.vertical, 4)
        }
    }

    private var contextSection: some View {
        GroupBox("Project Context") {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Readiness")
                        .font(.headline)
                    ForEach(model.screenModel.readinessItems) { item in
                        HStack(alignment: .top) {
                            Text(item.label)
                                .fontWeight(.semibold)
                                .frame(width: 110, alignment: .leading)
                            Text(item.value)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text(item.status.rawValue)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Next")
                        .font(.headline)
                    ForEach(model.screenModel.hints) { hint in
                        Text(hint.text)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private var projectSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(model.projectSheetMode.rawValue)
                .font(.title2)
                .fontWeight(.semibold)
            TextField("Project name", text: $model.projectDraft.projectName)
            HStack {
                TextField("Show folder", text: $model.projectDraft.showFolder)
                Button("Browse…") { model.chooseDraftShowFolder() }
            }
            HStack {
                TextField("Media folder", text: $model.projectDraft.mediaPath)
                Button("Browse…") { model.chooseDraftMediaFolder() }
            }
            HStack {
                Spacer()
                Button("Cancel") { model.dismissProjectSheet() }
                Button(model.projectSheetMode.rawValue) { model.confirmProjectSheet() }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.projectDraft.projectName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
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

    private func bannerView(_ banner: ProjectBannerModel) -> some View {
        Text(banner.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color(nsColor: banner.level == .blocked ? .systemRed.withAlphaComponent(0.12) : .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
