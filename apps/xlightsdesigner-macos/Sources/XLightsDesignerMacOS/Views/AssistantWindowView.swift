import SwiftUI

struct AssistantWindowView: View {
    @Bindable var appModel: AppModel
    @Bindable var model: AssistantWindowViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header
            messageThread
            composer
        }
        .padding(20)
        .frame(minWidth: 320, minHeight: 640)
        .task {
            model.loadConversationIfNeeded(
                context: currentContext(),
                project: appModel.workspace.activeProject
            )
        }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 6) {
                Text("Assistant")
                    .font(.title)
                    .fontWeight(.semibold)
                Text("Guided workflow with App Assistant, Designer, Audio Analyst, and Sequencer.")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Hide") {
                appModel.showAssistantPanel = false
            }
            Button("Clear") {
                model.clearConversation(context: currentContext())
            }
        }
    }

    private var messageThread: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                ForEach(model.messages) { message in
                    VStack(alignment: .leading, spacing: 6) {
                        headerText(for: message)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        messageBody(for: message)
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
                .disabled(model.isSending)
            HStack {
                if model.isSending {
                    ProgressView()
                        .controlSize(.small)
                }
                Spacer()
                Button("Send") {
                    Task {
                        await model.sendDraft(
                            context: currentContext(),
                            project: appModel.workspace.activeProject
                        )
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.isSending || model.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private func currentContext() -> AssistantContextModel {
        appModel.assistantContext()
    }

    private func headerText(for message: AssistantMessageModel) -> Text {
        if message.role == .user {
            return Text("You")
        }
        let name = (message.displayName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false)
            ? message.displayName!
            : "Assistant"
        if let route = message.routeDecision, route.isEmpty == false, route != message.handledBy {
            return Text("\(name) • \(route)")
        }
        return Text(name)
    }

    private func messageBody(for message: AssistantMessageModel) -> Text {
        Text(styledMessageText(message.text))
    }

    private func styledMessageText(_ raw: String) -> AttributedString {
        var output = AttributedString()
        let parts = raw.split(separator: "`", omittingEmptySubsequences: false)

        for (index, part) in parts.enumerated() {
            var segment = AttributedString(String(part))
            if index.isMultiple(of: 2) {
                segment.foregroundColor = .primary
            } else {
                segment.font = .body.monospaced()
                segment.foregroundColor = .primary
                segment.backgroundColor = Color(nsColor: .controlAccentColor).opacity(0.12)
            }
            output += segment
        }

        return output
    }
}
