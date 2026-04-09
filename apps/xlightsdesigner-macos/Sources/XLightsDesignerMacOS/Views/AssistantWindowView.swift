import AppKit
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
                Text("Design Team Chat")
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
        ScrollViewReader { proxy in
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
                                .background(bubbleColor(for: message))
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .textSelection(.enabled)
                        }
                        .id(message.id)
                    }
                }
            }
            .defaultScrollAnchor(.bottom)
            .onAppear {
                scrollToLatest(using: proxy)
            }
            .onChange(of: model.messages.count) { _, _ in
                scrollToLatest(using: proxy)
            }
        }
    }

    private var composer: some View {
        VStack(alignment: .leading, spacing: 10) {
            ZStack(alignment: .topLeading) {
                if model.draft.isEmpty {
                    Text("Ask for guidance or route work from the current workflow…")
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 10)
                        .allowsHitTesting(false)
                }

                AssistantComposerTextView(
                    text: $model.draft,
                    isEnabled: !model.isSending,
                    onSubmit: {
                        Task {
                            await model.sendDraft(
                                context: currentContext(),
                                project: appModel.workspace.activeProject
                            )
                        }
                    }
                )
            }
            .frame(minHeight: 58, idealHeight: 72, maxHeight: 86)
            .padding(4)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(nsColor: .separatorColor))
            )

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

    private func scrollToLatest(using proxy: ScrollViewProxy) {
        guard let lastID = model.messages.last?.id else { return }
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(lastID, anchor: .bottom)
            }
        }
    }

    private func headerText(for message: AssistantMessageModel) -> Text {
        if message.role == .user {
            let nickname = appModel.settingsScreenModel.screenModel.agentConfig.userIdentity.nickname.trimmingCharacters(in: .whitespacesAndNewlines)
            return Text(nickname.isEmpty ? "You" : "\(nickname) (You)")
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

    private func bubbleColor(for message: AssistantMessageModel) -> Color {
        guard message.role == .assistant else {
            if let custom = appModel.settingsScreenModel.screenModel.agentConfig.userIdentity.bubbleColor {
                return custom.opacity(0.20)
            }
            return Color.accentColor.opacity(0.12)
        }
        let identity = appModel.settingsScreenModel.screenModel.agentConfig.identities.identity(for: message.handledBy ?? "")
        if let custom = identity.bubbleColor {
            return custom.opacity(0.20)
        }
        return Color(nsColor: .controlBackgroundColor)
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

private struct AssistantComposerTextView: NSViewRepresentable {
    @Binding var text: String
    let isEnabled: Bool
    let onSubmit: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onSubmit: onSubmit)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder
        scrollView.drawsBackground = false
        scrollView.autohidesScrollers = true

        let textView = AssistantComposerNSTextView()
        textView.delegate = context.coordinator
        textView.onSubmit = onSubmit
        textView.isRichText = false
        textView.importsGraphics = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isContinuousSpellCheckingEnabled = true
        textView.font = .preferredFont(forTextStyle: .body)
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 4, height: 7)
        textView.textContainer?.widthTracksTextView = true
        textView.isHorizontallyResizable = false
        textView.isVerticallyResizable = true
        textView.autoresizingMask = [.width]
        textView.string = text

        scrollView.documentView = textView
        return scrollView
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? AssistantComposerNSTextView else { return }
        textView.isEditable = isEnabled
        textView.isSelectable = isEnabled
        textView.onSubmit = onSubmit

        if textView.string != text {
            context.coordinator.isUpdating = true
            textView.string = text
            context.coordinator.isUpdating = false
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding var text: String
        let onSubmit: () -> Void
        var isUpdating = false

        init(text: Binding<String>, onSubmit: @escaping () -> Void) {
            _text = text
            self.onSubmit = onSubmit
        }

        func textDidChange(_ notification: Notification) {
            guard !isUpdating,
                  let textView = notification.object as? NSTextView else { return }
            text = textView.string
        }
    }
}

private final class AssistantComposerNSTextView: NSTextView {
    var onSubmit: (() -> Void)?

    override func keyDown(with event: NSEvent) {
        let isReturn = event.keyCode == 36 || event.keyCode == 76
        let modifiers = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if isReturn && modifiers.isDisjoint(with: [.shift, .option, .control, .command]) {
            onSubmit?()
            return
        }
        super.keyDown(with: event)
    }
}
