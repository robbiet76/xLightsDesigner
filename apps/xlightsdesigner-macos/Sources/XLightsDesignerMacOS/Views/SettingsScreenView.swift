import SwiftUI

struct SettingsScreenView: View {
    @Environment(\.dismiss) private var dismiss
    @Bindable var model: SettingsScreenViewModel

    var body: some View {
        VStack(spacing: 0) {
            HSplitView {
                List(SettingsCategoryID.allCases, selection: categorySelection) { category in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(category.title)
                        Text(category.subtitle)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                    .tag(category)
                }
                .frame(minWidth: 220, idealWidth: 240, maxWidth: 260)

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        header
                        if let banner = model.screenModel.banner {
                            bannerView(banner)
                        }
                        content
                        maintenanceSection
                        Spacer(minLength: 0)
                    }
                    .padding(24)
                }
                .frame(minWidth: 560, idealWidth: 760)
            }
            Divider()
            HStack {
                Spacer()
                Button("Close") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 14)
        }
        .frame(minWidth: 900, minHeight: 620)
        .onAppear {
            model.load()
        }
        .onDisappear {
            NSColorPanel.shared.close()
        }
    }

    private var categorySelection: Binding<SettingsCategoryID?> {
        Binding(
            get: { model.screenModel.selectedCategory },
            set: { model.selectCategory($0 ?? .general) }
        )
    }

    @ViewBuilder
    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Settings")
                        .font(.title)
                        .fontWeight(.semibold)
                    Text(model.screenModel.selectedCategory.subtitle)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch model.screenModel.selectedCategory {
        case .general:
            pathSection(title: "Environment", rows: [
                SettingsPathRowModel(id: "xlights-endpoint", label: "Owned xLights API", value: model.screenModel.xlightsStatus.baseURL),
                SettingsPathRowModel(id: "assistant-model", label: "Assistant Model", value: model.screenModel.agentConfig.model.isEmpty ? "Not set" : model.screenModel.agentConfig.model)
            ])
        case .providers:
            providerSection
        case .teamChat:
            teamChatSection
        case .xlights:
            xlightsSection
        case .operators:
            operatorsSection
        case .pathsStorage:
            pathSection(title: "Canonical Paths", rows: model.screenModel.pathRows)
        case .diagnosticsMaintenance:
            diagnosticsSection
        }
    }

    @ViewBuilder
    private var providerSection: some View {
        section("Providers", subtitle: "Shared assistant runtime configuration.") {
            LabeledContent("Model") {
                TextField("gpt-5.4-mini", text: $model.screenModel.agentConfig.model)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 280)
            }
            LabeledContent("Base URL") {
                TextField("https://api.openai.com/v1", text: $model.screenModel.agentConfig.baseURL)
                    .textFieldStyle(.roundedBorder)
                    .frame(minWidth: 320)
            }
            LabeledContent("API Key") {
                SecureField(model.screenModel.agentConfig.hasStoredAPIKey ? "Stored key available" : "sk-...", text: $model.screenModel.agentConfig.apiKey)
                    .textFieldStyle(.roundedBorder)
                    .frame(minWidth: 320)
            }
            Text(model.screenModel.agentConfig.hasStoredAPIKey ? "A stored key already exists. Enter a new one only to replace it." : "No stored API key found.")
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack {
                Button("Save Provider Settings") {
                    model.saveProviderSettings()
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    @ViewBuilder
    private var teamChatSection: some View {
        section("Team Chat", subtitle: "Nicknames and bubble colors used in the shared chat thread.") {
            VStack(alignment: .leading, spacing: 10) {
                Text("People")
                    .font(.subheadline)
                    .fontWeight(.medium)
                Text("Nicknames are optional. Bubble colors update existing chat messages immediately.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                nicknameRow(
                    "You",
                    nickname: $model.screenModel.agentConfig.userIdentity.nickname,
                    bubbleColorHex: $model.screenModel.agentConfig.userIdentity.bubbleColorHex,
                    onChangeCommitted: model.saveTeamChatSettingsSilently
                )
                Divider()
                nicknameRow(
                    "App Assistant",
                    nickname: $model.screenModel.agentConfig.identities.appAssistant.nickname,
                    bubbleColorHex: $model.screenModel.agentConfig.identities.appAssistant.bubbleColorHex,
                    onChangeCommitted: model.saveTeamChatSettingsSilently
                )
                nicknameRow(
                    "Audio Analyst",
                    nickname: $model.screenModel.agentConfig.identities.audioAnalyst.nickname,
                    bubbleColorHex: $model.screenModel.agentConfig.identities.audioAnalyst.bubbleColorHex,
                    onChangeCommitted: model.saveTeamChatSettingsSilently
                )
                nicknameRow(
                    "Designer",
                    nickname: $model.screenModel.agentConfig.identities.designer.nickname,
                    bubbleColorHex: $model.screenModel.agentConfig.identities.designer.bubbleColorHex,
                    onChangeCommitted: model.saveTeamChatSettingsSilently
                )
                nicknameRow(
                    "Sequencer",
                    nickname: $model.screenModel.agentConfig.identities.sequencer.nickname,
                    bubbleColorHex: $model.screenModel.agentConfig.identities.sequencer.bubbleColorHex,
                    onChangeCommitted: model.saveTeamChatSettingsSilently
                )
            }
        }
    }

    @ViewBuilder
    private var xlightsSection: some View {
        section("xLights", subtitle: "Owned API connection status.") {
            LabeledContent("Endpoint") {
                Text(model.screenModel.xlightsStatus.baseURL)
                    .textSelection(.enabled)
            }
            LabeledContent("Status") {
                Text(model.screenModel.xlightsStatus.connected ? "Connected" : "Unavailable")
                    .foregroundStyle(model.screenModel.xlightsStatus.connected ? .green : .orange)
            }
            Text(model.screenModel.xlightsStatus.summary)
                .foregroundStyle(.secondary)
            HStack {
                Button("Test Connection") {
                    model.testXLightsConnection()
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    @ViewBuilder
    private var operatorsSection: some View {
        section("Operators", subtitle: "Default safety policies.") {
            Picker("Apply Confirmation", selection: $model.screenModel.safetyConfig.applyConfirmMode) {
                Text("Large changes only").tag("large-only")
                Text("Always confirm").tag("always")
                Text("Never confirm").tag("never")
            }
            Picker("Sequence Switching", selection: $model.screenModel.safetyConfig.sequenceSwitchUnsavedPolicy) {
                Text("Save then switch").tag("save-if-needed")
                Text("Discard unsaved").tag("discard-unsaved")
            }
            LabeledContent("Large Change Threshold") {
                TextField("60", value: $model.screenModel.safetyConfig.largeChangeThreshold, format: .number)
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 120)
            }
            HStack {
                Button("Save Operator Settings") {
                    model.saveOperatorSettings()
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    @ViewBuilder
    private func pathSection(title: String, rows: [SettingsPathRowModel]) -> some View {
        section(title, subtitle: "Canonical roots only.") {
            ForEach(rows) { row in
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.label)
                            .fontWeight(.medium)
                        Text(row.value)
                            .font(.system(.body, design: .monospaced))
                            .textSelection(.enabled)
                    }
                    Spacer()
                    Button("Reveal") {
                        model.revealPath(row.value)
                    }
                }
                Divider()
            }
        }
    }

    @ViewBuilder
    private var diagnosticsSection: some View {
        section("Diagnostics & Maintenance", subtitle: "Utility actions only.") {
            HStack {
                Button("Reveal Desktop State Root") {
                    model.revealPath(AppEnvironment.desktopStateRoot)
                }
                Button("Create Desktop State Backup") {
                    model.createStateBackup()
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    @ViewBuilder
    private var maintenanceSection: some View {
        if model.screenModel.selectedCategory != .diagnosticsMaintenance {
            section("Maintenance", subtitle: "Utility actions remain separated from ordinary configuration.") {
                Button("Open Diagnostics & Maintenance") {
                    model.selectCategory(.diagnosticsMaintenance)
                }
            }
        }
    }

    private func section<Content: View>(_ title: String, subtitle: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            content()
        }
        .padding(18)
        .background(Color(nsColor: .windowBackgroundColor))
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func nicknameRow(
        _ label: String,
        nickname: Binding<String>,
        bubbleColorHex: Binding<String>,
        onChangeCommitted: @escaping () -> Void
    ) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Text(label)
                .frame(width: 110, alignment: .leading)
            TextField("Optional nickname", text: nickname)
                .textFieldStyle(.roundedBorder)
                .frame(width: 220)
                .onChange(of: nickname.wrappedValue) { _, _ in
                    onChangeCommitted()
                }
            AgentBubbleColorPicker(hex: bubbleColorHex, onCommit: onChangeCommitted)
        }
    }

    private func bannerView(_ banner: SettingsBannerModel) -> some View {
        let color: Color = switch banner.level {
        case .info: .blue
        case .success: .green
        case .warning: .orange
        case .blocked: .red
        }
        return HStack {
            Text(banner.text)
                .foregroundStyle(color)
            Spacer()
        }
        .padding(12)
        .background(color.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

private struct AgentBubbleColorPicker: View {
    @Binding var hex: String
    let onCommit: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            ColorPicker("", selection: colorBinding, supportsOpacity: false)
                .labelsHidden()
                .frame(width: 28)
            Button("Default") {
                hex = ""
                onCommit()
            }
            .buttonStyle(.borderless)
            .font(.caption)
            .foregroundStyle(hex.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .secondary : .primary)
        }
    }

    private var colorBinding: Binding<Color> {
        Binding(
            get: { Color(hex: hex) ?? Color(nsColor: .controlAccentColor).opacity(0.2) },
            set: {
                hex = nsColorHexString(NSColor($0))
                onCommit()
            }
        )
    }

    private func nsColorHexString(_ color: NSColor) -> String {
        let converted = color.usingColorSpace(.sRGB) ?? .controlAccentColor
        let red = Int(round(converted.redComponent * 255))
        let green = Int(round(converted.greenComponent * 255))
        let blue = Int(round(converted.blueComponent * 255))
        return String(format: "#%02X%02X%02XFF", red, green, blue)
    }
}
