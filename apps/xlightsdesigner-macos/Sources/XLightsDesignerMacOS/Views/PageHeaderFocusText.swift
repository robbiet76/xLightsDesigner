import SwiftUI

struct PageHeaderFocusText: View {
    let text: String

    var body: some View {
        let value = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !value.isEmpty {
            focusText(value)
                .foregroundStyle(.secondary)
                .lineLimit(2)
                .textSelection(.enabled)
        }
    }

    private func focusText(_ value: String) -> Text {
        guard let range = value.range(of: ": ") else {
            return Text(value).fontWeight(.semibold)
        }
        let label = String(value[..<range.upperBound])
        let target = String(value[range.upperBound...])
        return Text(label) + Text(target).fontWeight(.semibold)
    }
}
