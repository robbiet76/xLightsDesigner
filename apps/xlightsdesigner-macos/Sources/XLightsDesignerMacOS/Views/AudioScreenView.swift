import SwiftUI

struct AudioScreenView: View {
    @Bindable var model: AudioScreenViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            header
            topBand
            librarySection
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.header.title)
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text(model.header.subtitle)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                countBadge(label: "Total", value: model.header.totalCount)
                countBadge(label: "Complete", value: model.header.completeCount)
                countBadge(label: "Partial", value: model.header.partialCount)
                countBadge(label: "Needs Review", value: model.header.needsReviewCount)
                countBadge(label: "Failed", value: model.header.failedCount)
            }
        }
    }

    private var topBand: some View {
        HStack(alignment: .top, spacing: 20) {
            actionColumn
            currentResultColumn
        }
    }

    private var actionColumn: some View {
        GroupBox("Do") {
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
                            Button("Browse File…") {}
                                .disabled(true)
                            Button("Analyze Track") {
                                model.analyzeTrack()
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Choose a folder for batch analysis into the shared track library.")
                            .foregroundStyle(.secondary)
                        TextField("Folder path", text: $model.folderPath)
                        Toggle("Include subfolders recursively", isOn: $model.recursiveEnabled)
                        HStack {
                            Button("Browse Folder…") {}
                                .disabled(true)
                            Button("Analyze Folder") {
                                model.analyzeFolder()
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .frame(maxWidth: 420)
    }

    private var currentResultColumn: some View {
        GroupBox("Understand / Fix") {
            VStack(alignment: .leading, spacing: 14) {
                switch model.currentResult {
                case .empty:
                    Text("Select a track or start an analysis run to see the current result.")
                        .foregroundStyle(.secondary)

                case let .track(track):
                    VStack(alignment: .leading, spacing: 10) {
                        Text(track.displayName)
                            .font(.title2)
                            .fontWeight(.semibold)
                        Text(track.artist)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            statusChip(track.status.rawValue)
                            statusChip(track.identityState.rawValue)
                            statusChip(track.lastAnalyzedSummary)
                        }
                        detailRow(label: "Available timings", value: track.availableTimingsSummary)
                        detailRow(label: "Missing / issues", value: track.missingIssuesSummary)
                        detailRow(label: "Reason", value: track.reason)
                        detailRow(label: "Recommended action", value: track.recommendedActionText)
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
                            .font(.title2)
                            .fontWeight(.semibold)
                        statusChip("Running")
                        detailRow(label: "Processed", value: "\(batch.processedCount) / \(batch.totalCount)")
                        detailRow(label: "Counts", value: "Complete \(batch.completeCount), Partial \(batch.partialCount), Needs Review \(batch.needsReviewCount), Failed \(batch.failedCount)")
                        detailRow(label: "Progress", value: batch.progressNote)
                    }

                case let .batchComplete(batch):
                    VStack(alignment: .leading, spacing: 10) {
                        Text(batch.batchLabel)
                            .font(.title2)
                            .fontWeight(.semibold)
                        statusChip("Batch Complete")
                        detailRow(label: "Processed", value: "\(batch.processedCount)")
                        detailRow(label: "Counts", value: "Complete \(batch.completeCount), Partial \(batch.partialCount), Needs Review \(batch.needsReviewCount), Failed \(batch.failedCount)")
                        detailRow(label: "Top issues", value: batch.topIssueCategories)
                        detailRow(label: "Recommended action", value: batch.followUpActionText)
                    }

                case let .error(error):
                    VStack(alignment: .leading, spacing: 10) {
                        Text(error.title)
                            .font(.title2)
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
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .frame(maxWidth: .infinity)
    }

    private var librarySection: some View {
        GroupBox("Shared Track Library") {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("\(model.filteredRows.count) tracks")
                        .foregroundStyle(.secondary)
                    Spacer()
                    TextField("Search", text: $model.searchQuery)
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 260)
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
                .frame(minHeight: 320)
            }
            .padding(.vertical, 4)
        }
    }

    private func countBadge(label: String, value: Int) -> some View {
        HStack(spacing: 6) {
            Text(label)
                .foregroundStyle(.secondary)
            Text(String(value))
                .fontWeight(.semibold)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color(nsColor: .controlBackgroundColor))
        .clipShape(Capsule())
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
                .font(.headline)
            Text(value)
                .foregroundStyle(.secondary)
        }
    }
}
