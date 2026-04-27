import SwiftUI

struct PageHeaderFocusText: View {
    let text: String

    var body: some View {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !value.isEmpty {
            Text(value)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .textSelection(.enabled)
        }
    }
}
