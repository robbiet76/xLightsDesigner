import SwiftUI

struct AssistantWindowView: View {
    @Bindable var appModel: AppModel
    @Bindable var model: AssistantWindowViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
            contextBand
            messageThread
            composer
        }
        .padding(20)
        .frame(minWidth: 520, minHeight: 640)
        .task {
            model.loadConversationIfNeeded()
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text("Assistant")
                    .font(.title)
                    .fontWeight(.semibold)
                Text("Unified app guidance and specialist routing across workflows.")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Clear") {
                model.clearConversation()
            }
        }
    }

    private var contextBand: some View {
        let context = currentContext()
        return GroupBox("Context") {
            VStack(alignment: .leading, spacing: 8) {
                detailRow(label: "Project", value: context.activeProjectName)
                detailRow(label: "Workflow", value: context.workflowName)
                detailRow(label: "Focus", value: context.focusedSummary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private var messageThread: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                ForEach(model.messages) { message in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(message.role == .assistant ? "Assistant" : "You")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(message.text)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(message.role == .assistant ? Color(nsColor: .controlBackgroundColor) : Color.accentColor.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 10) {
            TextField("Ask for guidance or route work from the current workflow…", text: $model.draft, axis: .vertical)
                .lineLimit(3...6)
                .textFieldStyle(.roundedBorder)
            HStack {
                Spacer()
                Button("Send") {
                    model.sendDraft(context: currentContext())
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private func currentContext() -> AssistantContextModel {
        AssistantContextModel(
            activeProjectName: appModel.workspace.activeProject?.projectName ?? "No Project",
            workflowName: appModel.selectedWorkflow.rawValue,
            focusedSummary: focusedSummary()
        )
    }

    private func focusedSummary() -> String {
        switch appModel.selectedWorkflow {
        case .project:
            return appModel.workspace.activeProject?.projectFilePath ?? "Project summary"
        case .layout:
            switch appModel.layoutScreenModel.screenModel.selectedTarget {
            case let .selected(target):
                return target.identity
            default:
                return "No target selected"
            }
        case .audio:
            switch appModel.audioScreenModel.currentResult {
            case let .track(track):
                return track.displayName
            case let .batchComplete(batch):
                return batch.batchLabel
            case let .batchRunning(batch):
                return batch.batchLabel
            default:
                return "No track selected"
            }
        default:
            return "No focused item"
        }
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
