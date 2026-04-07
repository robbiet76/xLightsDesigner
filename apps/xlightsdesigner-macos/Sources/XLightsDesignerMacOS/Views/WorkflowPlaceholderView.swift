import SwiftUI

struct WorkflowPlaceholderView: View {
    let workflow: WorkflowID

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            VStack(alignment: .leading, spacing: 8) {
                Text(workflow.rawValue)
                    .font(.largeTitle)
                    .fontWeight(.semibold)
                Text(workflow.summary)
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }

            GroupBox("Current native scaffold status") {
                VStack(alignment: .leading, spacing: 12) {
                    Text("This workflow is defined in specs and build packages, but no service integration or durable state is wired yet.")
                    Text("Build package")
                        .font(.headline)
                    Text(workflow.specPath)
                        .font(.system(.body, design: .monospaced))
                        .textSelection(.enabled)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            }

            Spacer()
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(Color(nsColor: .windowBackgroundColor))
    }
}
