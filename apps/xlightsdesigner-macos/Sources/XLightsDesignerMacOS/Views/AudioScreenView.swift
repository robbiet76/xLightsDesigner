import SwiftUI

struct AudioScreenView: View {
    @Bindable var model: AudioScreenViewModel

    var body: some View {
        GeometryReader { proxy in
            let currentSelectionMinHeight = max(120, min(150, proxy.size.height * 0.14))
            let currentSelectionMaxHeight = max(150, min(220, proxy.size.height * 0.24))
            let gridMinHeight = max(260, proxy.size.height * 0.36)

            VStack(alignment: .leading, spacing: 20) {
                header
                summarySection
                controlsSection
                currentSelectionSection(minHeight: currentSelectionMinHeight, maxHeight: currentSelectionMaxHeight)
                librarySection(minHeight: gridMinHeight)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .task {
            model.loadLibrary()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.header.title)
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text(model.header.subtitle)
                .foregroundStyle(.secondary)
        }
        .layoutPriority(1)
    }

    private var summarySection: some View {
        GroupBox("Summary") {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    statusChip("Total \(model.header.totalCount)")
                    statusChip("Complete \(model.header.completeCount)")
                    if model.header.partialCount > 0 {
                        statusChip("Partial \(model.header.partialCount)")
                    }
                    if model.header.needsReviewCount > 0 {
                        statusChip("Needs Review \(model.header.needsReviewCount)")
                    }
                    if model.header.failedCount > 0 {
                        statusChip("Failed \(model.header.failedCount)")
                    }
                }
                Text(summaryText)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .layoutPriority(1)
    }

    private var controlsSection: some View {
        GroupBox("Controls") {
            VStack(alignment: .leading, spacing: 16) {
                Picker("Mode", selection: $model.mode) {
                    ForEach(AudioMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                if model.mode == .singleTrack {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Choose a single audio file to analyze into the shared track library.")
                            .foregroundStyle(.secondary)
                        TextField("Audio file path", text: $model.singleTrackPath)
                        HStack {
                            Button("Browse File…") {
                                model.browseForTrack()
                            }
                            Button("Analyze Track") {
                                model.analyzeTrack()
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(model.singleTrackPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Choose a folder for batch analysis into the shared track library.")
                            .foregroundStyle(.secondary)
                        TextField("Folder path", text: $model.folderPath)
                        Toggle("Include subfolders recursively", isOn: $model.recursiveEnabled)
                        HStack {
                            Button("Browse Folder…") {
                                model.browseForFolder()
                            }
                            Button("Analyze Folder") {
                                model.analyzeFolder()
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(model.folderPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .layoutPriority(1)
    }

    private func currentSelectionSection(minHeight: CGFloat, maxHeight: CGFloat) -> some View {
        GroupBox("Current Selection") {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    switch model.currentResult {
                    case .empty:
                        Text("Select a track or start an analysis run to see the current result.")
                            .foregroundStyle(.secondary)

                    case let .track(track):
                        VStack(alignment: .leading, spacing: 10) {
                            Text(track.displayName)
                                .font(.title3)
                                .fontWeight(.semibold)
                            HStack(spacing: 8) {
                                statusChip(track.status.rawValue)
                                statusChip(track.identityState.rawValue)
                            }
                            HStack(spacing: 10) {
                                compactInfoChip(label: "Artist", value: track.artist)
                                compactInfoChip(label: "Last analyzed", value: track.lastAnalyzedSummary)
                            }
                            LazyVGrid(
                                columns: [GridItem(.adaptive(minimum: 240), spacing: 12, alignment: .top)],
                                alignment: .leading,
                                spacing: 12
                            ) {
                                detailCard(label: "Available timings", value: track.availableTimingsSummary)
                                detailCard(label: "Missing / issues", value: track.missingIssuesSummary)
                                detailCard(label: "Recommended action", value: track.recommendedActionText)
                                if track.reason != "No issues detected" {
                                    detailCard(label: "Reason", value: track.reason)
                                }
                            }
                            if track.canConfirmIdentity {
                                Divider()
                                TextField("Track title", text: Binding(
                                    get: { track.editableTitleDraft },
                                    set: { model.updateDraftTitle($0) }
                                ))
                                TextField("Track artist", text: Binding(
                                    get: { track.editableArtistDraft },
                                    set: { model.updateDraftArtist($0) }
                                ))
                                HStack {
                                    Button("Confirm Track Info") {
                                        model.confirmTrackInfo()
                                    }
                                    .buttonStyle(.borderedProminent)
                                    .disabled(track.editableTitleDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || track.editableArtistDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                                }
                            }
                        }

                    case let .batchRunning(batch):
                        VStack(alignment: .leading, spacing: 10) {
                            Text(batch.batchLabel)
                                .font(.title3)
                                .fontWeight(.semibold)
                            statusChip("Running")
                            LazyVGrid(
                                columns: [GridItem(.adaptive(minimum: 240), spacing: 12, alignment: .top)],
                                alignment: .leading,
                                spacing: 12
                            ) {
                                detailCard(label: "Processed", value: "\(batch.processedCount) / \(batch.totalCount)")
                                detailCard(label: "Counts", value: "Complete \(batch.completeCount), Partial \(batch.partialCount), Needs Review \(batch.needsReviewCount), Failed \(batch.failedCount)")
                                detailCard(label: "Progress", value: batch.progressNote)
                            }
                        }

                    case let .batchComplete(batch):
                        VStack(alignment: .leading, spacing: 10) {
                            Text(batch.batchLabel)
                                .font(.title3)
                                .fontWeight(.semibold)
                            statusChip("Batch Complete")
                            LazyVGrid(
                                columns: [GridItem(.adaptive(minimum: 240), spacing: 12, alignment: .top)],
                                alignment: .leading,
                                spacing: 12
                            ) {
                                detailCard(label: "Processed", value: "\(batch.processedCount)")
                                detailCard(label: "Counts", value: "Complete \(batch.completeCount), Partial \(batch.partialCount), Needs Review \(batch.needsReviewCount), Failed \(batch.failedCount)")
                                detailCard(label: "Top issues", value: batch.topIssueCategories)
                                detailCard(label: "Recommended action", value: batch.followUpActionText)
                            }
                        }

                    case let .error(error):
                        VStack(alignment: .leading, spacing: 10) {
                            Text(error.title)
                                .font(.title3)
                                .fontWeight(.semibold)
                            Text(error.explanation)
                                .foregroundStyle(.secondary)
                            if error.canRetry {
                                Button("Retry") {
                                    model.retryCurrentResult()
                                }
                                .buttonStyle(.borderedProminent)
                            }
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(minHeight: minHeight)
            .frame(maxHeight: maxHeight)
            .padding(.vertical, 4)
        }
        .layoutPriority(1)
    }

    private func librarySection(minHeight: CGFloat) -> some View {
        GroupBox("Shared Track Library") {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("\(model.filteredRows.count) tracks")
                        .foregroundStyle(.secondary)
                    Spacer()
                    TextField("Search", text: $model.searchQuery)
                        .textFieldStyle(.roundedBorder)
                }

                Table(model.filteredRows, selection: Binding(
                    get: { model.selectedRowID },
                    set: { model.selectRow(id: $0) }
                )) {
                    TableColumn("Track") { row in
                        Text(row.displayName)
                    }
                    TableColumn("Status") { row in
                        Text(row.status.rawValue)
                    }
                    TableColumn("Available Timings") { row in
                        Text(row.availableTimingsSummary)
                            .lineLimit(1)
                    }
                    TableColumn("Missing / Issues") { row in
                        Text(row.missingIssuesSummary)
                            .lineLimit(1)
                    }
                    TableColumn("Identity") { row in
                        Text(row.identitySummary)
                    }
                    TableColumn("Last Analyzed") { row in
                        Text(row.lastAnalyzedSummary)
                    }
                    TableColumn("Action") { row in
                        Text(row.actionSummaryText)
                            .lineLimit(1)
                    }
                }
            }
            .padding(.vertical, 4)
        }
        .frame(minHeight: minHeight, maxHeight: .infinity)
        .layoutPriority(2)
    }

    private func statusChip(_ text: String) -> some View {
        Text(text)
            .font(.subheadline)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(Capsule())
    }

    private func detailRow(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.subheadline)
                .fontWeight(.semibold)
            Text(value)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private func detailCard(label: String, value: String) -> some View {
        detailRow(label: label, value: value)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(10)
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.55))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func compactInfoChip(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value.isEmpty ? "None" : value)
                .font(.subheadline)
                .fontWeight(.medium)
                .lineLimit(1)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.7))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private var summaryText: String {
        if model.header.needsReviewCount > 0 {
            return "\(model.header.needsReviewCount) tracks still need identity review or follow-up before the library is fully clean."
        }
        if model.header.failedCount > 0 {
            return "\(model.header.failedCount) tracks failed analysis and may need to be rerun."
        }
        return "Use single-track or folder analysis to keep the shared track library current."
    }
}
