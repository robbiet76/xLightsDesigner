import SwiftUI

struct ProjectScreenView: View {
    @Bindable var model: ProjectScreenViewModel

    var body: some View {
        GeometryReader { proxy in
            let topHeight = max(240, min(300, proxy.size.height * 0.38))
            VStack(alignment: .leading, spacing: 20) {
                header
                if !model.screenModel.banners.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(model.screenModel.banners) { banner in
                            bannerView(banner)
                        }
                    }
                }
                topBand
                    .frame(height: topHeight)
                projectBriefSection
                    .frame(maxHeight: .infinity, alignment: .topLeading)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .task {
            model.loadInitialProject()
        }
        .sheet(isPresented: $model.isShowingProjectSheet) {
            projectSheet
                .padding(24)
                .frame(width: 520)
        }
        .sheet(isPresented: $model.isShowingOpenProjectSheet) {
            openProjectSheet
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
        }
    }

    private var topBand: some View {
        AdaptiveSplitView(breakpoint: 1180, spacing: 20) {
            VStack(alignment: .leading, spacing: 20) {
                summaryBand
                primaryActionsBand
            }
        } secondary: {
            EmptyView()
        }
    }

    private var summaryBand: some View {
        GroupBox(model.screenModel.summary == nil ? "Start Here" : "Active Project") {
            if let summary = model.screenModel.summary {
                VStack(alignment: .leading, spacing: 10) {
                    Text(summary.projectName)
                        .font(.title2)
                        .fontWeight(.semibold)
                    detailRow(label: "Project Folder", value: projectFolderPath(from: summary.projectFilePath))
                    detailRow(label: "xLights Show Folder", value: summary.showFolderSummary)
                    HStack(spacing: 10) {
                        Button("Change Show Folder…") { model.chooseShowFolderForActiveProject() }
                        Spacer()
                    }
                    detailRow(label: "Readiness", value: summary.readinessExplanation)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Create or open a project to establish the working context for Display, Design, Sequence, and Review.")
                        .foregroundStyle(.secondary)
                    HStack(spacing: 10) {
                        Button("Create Project…") { model.startCreateProject() }
                            .buttonStyle(.borderedProminent)
                        Button("Open Project…") { model.startOpenProject() }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            }
        }
    }

    private var primaryActionsBand: some View {
        GroupBox("Project Actions") {
            VStack(alignment: .leading, spacing: 14) {
                Text("Use one of these actions to establish or update the active project file.")
                    .foregroundStyle(.secondary)
                HStack(alignment: .bottom, spacing: 10) {
                    Button("Create Project…") { model.startCreateProject() }
                        .buttonStyle(.borderedProminent)
                    Button("Open Project…") { model.startOpenProject() }
                    Spacer()
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var projectBriefSection: some View {
        GroupBox("Project Mission") {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("A single guiding statement for what the show is trying to be.")
                            .foregroundStyle(.secondary)
                        Text("This should read like a coherent project mission, not a form. The designer conversation should usually shape it, and you can edit it directly here when needed.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    if model.isEditingProjectBrief {
                        HStack(spacing: 10) {
                            Button("Cancel") {
                                model.cancelProjectBriefEditing()
                            }
                            Button("Save Mission") {
                                model.saveProjectBrief()
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    } else {
                        Button(model.screenModel.brief?.isEmpty == false ? "Edit Mission" : "Create Mission") {
                            model.startEditProjectBrief()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }

                if model.isEditingProjectBrief {
                    projectBriefEditorSection
                } else if let brief = model.screenModel.brief, !brief.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        briefBlock(title: "Mission Document", value: brief.document, placeholder: "No project mission captured yet.")
                        if !brief.updatedAt.isEmpty {
                            Text("Last updated: \(brief.updatedAt)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("No project mission is captured yet.")
                            .font(.headline)
                        Text("The Designer should help establish the top-level show mission here first as a well-written guiding statement for the project.")
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var projectSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Create Project")
                .font(.title2)
                .fontWeight(.semibold)
            Text("Create a new project, set the project show folder, and optionally migrate reusable metadata from an existing project.")
                .foregroundStyle(.secondary)
            GroupBox("Project Identity") {
                VStack(alignment: .leading, spacing: 8) {
                    TextField("Project name", text: $model.projectDraft.projectName)
                }
                .padding(.vertical, 4)
            }
            GroupBox("xLights Show Folder") {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        TextField("Show folder", text: $model.projectDraft.showFolder)
                        Button("Browse…") { model.chooseDraftShowFolder() }
                    }
                }
                .padding(.vertical, 4)
            }
            GroupBox("Metadata Migration") {
                VStack(alignment: .leading, spacing: 10) {
                    Toggle("Migrate metadata from an existing project", isOn: $model.projectDraft.migrateMetadata)
                    if model.projectDraft.migrateMetadata {
                        Text("Use an existing project as the starting point, then reconcile the migrated metadata against the new xLights show in Display.")
                            .foregroundStyle(.secondary)
                        Picker("Source Project", selection: $model.projectDraft.migrationSourceProjectPath) {
                            ForEach(model.availableProjects) { project in
                                Text(project.folderName)
                                    .tag(project.projectFolderPath)
                            }
                        }
                        .labelsHidden()
                    }
                }
                .padding(.vertical, 4)
            }
            HStack {
                Spacer()
                Button("Cancel") { model.dismissProjectSheet() }
                Button("Create Project") { model.confirmProjectSheet() }
                    .buttonStyle(.borderedProminent)
                    .disabled(createProjectDisabled)
            }
        }
    }

    private var openProjectSheet: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Open Project")
                .font(.title2)
                .fontWeight(.semibold)
            Text("Choose a project from the canonical Projects folder.")
                .foregroundStyle(.secondary)
            GroupBox("Available Projects") {
                Picker("Project", selection: $model.selectedOpenProjectPath) {
                    ForEach(model.availableProjects) { project in
                        Text(project.folderName)
                            .tag(project.projectFolderPath)
                    }
                }
                .labelsHidden()
                .padding(.vertical, 4)
            }
            HStack {
                Spacer()
                Button("Cancel") { model.dismissOpenProjectSheet() }
                Button("Open") { model.openSelectedProject() }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.selectedOpenProjectPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var createProjectDisabled: Bool {
        let nameMissing = model.projectDraft.projectName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let showMissing = model.projectDraft.showFolder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let migrationMissing = model.projectDraft.migrateMetadata && model.projectDraft.migrationSourceProjectPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return nameMissing || showMissing || migrationMissing
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

    private func briefBlock(title: String, value: String, placeholder: String) -> some View {
        GroupBox(title) {
            Text(value.isEmpty ? placeholder : value)
                .foregroundStyle(value.isEmpty ? .secondary : .primary)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(.vertical, 4)
        }
    }

    private var projectBriefEditorSection: some View {
        editableBriefBlock(title: "Mission Document", text: $model.projectBriefEditor.document, minHeight: 280)
    }

    private func editableBriefBlock(title: String, text: Binding<String>, minHeight: CGFloat = 120) -> some View {
        GroupBox(title) {
            TextEditor(text: text)
                .frame(minHeight: minHeight)
                .padding(.vertical, 4)
        }
    }

    private func bannerView(_ banner: ProjectBannerModel) -> some View {
        Text(banner.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(bannerColor(for: banner.level))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func bannerColor(for level: WorkflowReadinessLevel) -> Color {
        switch level {
        case .ready:
            return Color(nsColor: .systemGreen).opacity(0.12)
        case .partial:
            return Color(nsColor: .systemOrange).opacity(0.12)
        case .blocked:
            return Color(nsColor: .systemRed).opacity(0.12)
        }
    }

    private func projectFolderPath(from projectFilePath: String) -> String {
        URL(fileURLWithPath: projectFilePath).deletingLastPathComponent().path
    }
}
