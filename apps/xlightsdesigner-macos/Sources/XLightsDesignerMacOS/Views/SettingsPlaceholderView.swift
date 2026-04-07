import SwiftUI

struct SettingsPlaceholderView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Settings")
                .font(.title)
                .fontWeight(.semibold)
            Text("Settings remains outside the main workflow. This placeholder is scaffold-only and should later bind to the shared settings service defined in the native build package.")
                .foregroundStyle(.secondary)
            Text("Spec: specs/app-ui/macos-native-settings-build-package-2026-04-06.md")
                .font(.system(.body, design: .monospaced))
                .textSelection(.enabled)
            Spacer()
        }
        .padding(24)
        .frame(minWidth: 520, minHeight: 320, alignment: .topLeading)
    }
}
