import SwiftUI
import AppKit

struct SequenceScreenView: View {
    @Bindable var model: SequenceScreenViewModel
    @Bindable var xlightsSessionModel: XLightsSessionViewModel
    let sequenceSwitchUnsavedPolicy: String

    var body: some View {
        GeometryReader { proxy in
            let currentSelectionMinHeight = max(120, min(150, proxy.size.height * 0.14))
            let currentSelectionMaxHeight = max(150, min(220, proxy.size.height * 0.24))
            let gridMinHeight = max(260, proxy.size.height * 0.36)

            VStack(alignment: .leading, spacing: 20) {
                header
                summarySection
                statusSection
                currentSelectionSection(minHeight: currentSelectionMinHeight, maxHeight: currentSelectionMaxHeight)
                inventorySection(minHeight: gridMinHeight)
            }
            .padding(24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .task { model.startLiveRefresh() }
        .onDisappear {
            model.stopLiveRefresh()
        }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.refresh()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            model.startLiveRefresh()
        }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didResignActiveNotification)) { _ in
            model.stopLiveRefresh()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.screenModel.title)
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text(model.screenModel.subtitle)
                .foregroundStyle(.secondary)
        }
        .layoutPriority(1)
    }

    private var summarySection: some View {
        GroupBox("Summary") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 12) {
                    chip(model.screenModel.overview.activeSequenceSummary)
                    chip("Draft \(model.screenModel.overview.translationSource)")
                    chip("Items \(model.screenModel.overview.itemCount)")
                    if model.screenModel.overview.commandCount > 0 {
                        chip("Commands \(model.screenModel.overview.commandCount)")
                    }
                    if model.screenModel.overview.targetCount > 0 {
                        chip("Targets \(model.screenModel.overview.targetCount)")
                    }
                    if model.screenModel.overview.sectionCount > 0 {
                        chip("Sections \(model.screenModel.overview.sectionCount)")
                    }
                    if model.screenModel.activeSequence.activeSequenceName != "No live sequence open" {
                        chip("xLights Sequence Open")
                    }
                    if model.screenModel.overview.warningCount > 0 {
                        chip("Warnings \(model.screenModel.overview.warningCount)")
                    }
                    if model.screenModel.overview.validationIssueCount > 0 {
                        chip("Checks \(model.screenModel.overview.validationIssueCount)")
                    }
                }
                Text(model.screenModel.overview.explanationText)
                    .foregroundStyle(.secondary)
                ForEach(model.screenModel.banners) { banner in
                    bannerView(banner)
                }
                if let banner = model.transientBanner {
                    bannerView(banner)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .layoutPriority(1)
    }

    private var statusSection: some View {
        GroupBox("Status") {
            VStack(alignment: .leading, spacing: 12) {
                Text(statusSummaryText)
                    .foregroundStyle(.secondary)
                detailRow(label: "Active Sequence In xLights", value: model.screenModel.activeSequence.activeSequenceName)
                detailRow(label: "Project Sequence Summary", value: model.screenModel.activeSequence.boundTrackSummary)
                detailRow(label: "Project Show Folder", value: model.projectShowFolder.isEmpty ? "(not set)" : model.projectShowFolder)
                detailRow(label: "Timing Dependency", value: timingDependencyText)
                detailRow(label: "Ready To Proceed", value: readyToProceedText)
                Divider()
                detailRow(label: "Live Sequence Path", value: xlightsSessionModel.snapshot.sequencePath.isEmpty ? "No live sequence open." : xlightsSessionModel.snapshot.sequencePath)
                detailRow(label: "Project Sequence Path", value: preferredSequencePathText)
                detailRow(label: "Media File", value: xlightsSessionModel.snapshot.mediaFile.isEmpty ? "(not set)" : xlightsSessionModel.snapshot.mediaFile)
                detailRow(label: "Sequence Settings", value: sequenceSettingsText)
                detailRow(label: "Unsaved State", value: xlightsSessionModel.snapshot.dirtyStateReason)
                detailRow(label: "Sequence Switching", value: sequenceSwitchPolicyText)
                HStack(spacing: 10) {
                    Button("Refresh xLights") {
                        xlightsSessionModel.refresh()
                        model.refresh()
                    }

                    Button("Save Sequence") {
                        Task {
                            try? await xlightsSessionModel.saveCurrentSequence()
                            model.refresh()
                        }
                    }
                    .disabled(xlightsSessionModel.snapshot.isSequenceOpen == false || xlightsSessionModel.snapshot.saveSupported == false)

                    Button("Render Sequence") {
                        Task {
                            try? await xlightsSessionModel.renderCurrentSequence()
                            model.refresh()
                        }
                    }
                    .disabled(xlightsSessionModel.snapshot.isSequenceOpen == false || xlightsSessionModel.snapshot.renderSupported == false)

                    Button(projectSequenceActionLabel) {
                        Task { await performProjectSequenceAction() }
                    }
                    .disabled(projectSequenceActionDisabled)

                    Button(model.isGeneratingProposal ? "Generating Proposal..." : sequenceProposalActionLabel) {
                        model.generateProposalFromDesignIntent()
                    }
                    .disabled(model.isGeneratingProposal)
                }
                if !xlightsSessionModel.snapshot.lastSaveSummary.isEmpty {
                    Text(xlightsSessionModel.snapshot.lastSaveSummary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if !xlightsSessionModel.snapshot.lastRenderSummary.isEmpty {
                    Text(xlightsSessionModel.snapshot.lastRenderSummary)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if !needsAttentionItems.isEmpty {
                    bulletSection(title: "Needs Attention", items: needsAttentionItems)
                }
                if model.selectedTimingReviewRow?.canAcceptReview == true {
                    HStack(spacing: 10) {
                        Button("Accept Timing Review") {
                            model.acceptTimingReview()
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
        .layoutPriority(1)
    }

    private var preferredSequencePath: String {
        model.preferredSequencePath()
    }

    private var preferredSequencePathText: String {
        preferredSequencePath.isEmpty ? "No project sequence target is available yet." : preferredSequencePath
    }

    private var preferredSequenceExists: Bool {
        let path = preferredSequencePath
        return !path.isEmpty && FileManager.default.fileExists(atPath: path)
    }

    private var isPreferredSequenceOpen: Bool {
        let current = normalizedPath(xlightsSessionModel.snapshot.sequencePath)
        let preferred = normalizedPath(preferredSequencePath)
        return !preferred.isEmpty && current == preferred
    }

    private var projectSequenceActionLabel: String {
        if preferredSequencePath.isEmpty {
            return "Project Sequence Unavailable"
        }
        if isPreferredSequenceOpen {
            return "Project Sequence Open"
        }
        if preferredSequenceExists {
            return "Open Project Sequence"
        }
        return "Create Project Sequence"
    }

    private var projectSequenceActionDisabled: Bool {
        if preferredSequencePath.isEmpty || isPreferredSequenceOpen {
            return true
        }
        return preferredSequenceExists ? !xlightsSessionModel.snapshot.openSupported : !xlightsSessionModel.snapshot.createSupported
    }

    private var sequenceProposalActionLabel: String {
        model.screenModel.overview.translationSource == "Canonical Plan" ? "Regenerate Proposal" : "Generate Proposal"
    }

    private var sequenceSwitchPolicyText: String {
        let policy = sequenceSwitchUnsavedPolicy.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch policy {
        case "discard-unsaved":
            return "When switching project sequences, native will discard unsaved xLights changes instead of saving first."
        case "save-if-needed":
            return xlightsSessionModel.snapshot.hasUnsavedChanges == true
                ? "When switching project sequences, native will save the current xLights sequence first because it has unsaved changes."
                : "When switching project sequences, native will save first only if the current xLights sequence is dirty."
        default:
            return "When switching project sequences, native will follow the configured unsaved-sequence policy."
        }
    }

    private func performProjectSequenceAction() async {
        let filePath = preferredSequencePath
        guard !filePath.isEmpty, !isPreferredSequenceOpen else { return }

        let saveBeforeSwitch = xlightsSessionModel.shouldSaveBeforeSwitch(policy: sequenceSwitchUnsavedPolicy)
        if preferredSequenceExists {
            _ = try? await xlightsSessionModel.openSequence(filePath: filePath, saveBeforeSwitch: saveBeforeSwitch)
        } else {
            _ = try? await xlightsSessionModel.createSequence(
                filePath: filePath,
                mediaFile: model.preferredMediaFile(),
                durationMs: nil,
                frameMs: nil,
                saveBeforeSwitch: saveBeforeSwitch
            )
        }
        model.refresh()
    }

    private func normalizedPath(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        return URL(fileURLWithPath: trimmed).standardizedFileURL.path
    }

    private func currentSelectionSection(minHeight: CGFloat, maxHeight: CGFloat) -> some View {
        GroupBox("Current Selection") {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    if let row = model.selectedRow {
                        Text(row.target)
                            .font(.title3)
                            .fontWeight(.semibold)
                        HStack(spacing: 10) {
                            if !row.designLabel.isEmpty {
                                compactInfoChip(label: "Design", value: row.designLabel)
                            }
                            compactInfoChip(label: "Kind", value: row.kind)
                            compactInfoChip(label: "Timing", value: row.timing)
                            compactInfoChip(label: "Level", value: row.level)
                        }
                        LazyVGrid(
                            columns: [GridItem(.adaptive(minimum: 240), spacing: 12, alignment: .top)],
                            alignment: .leading,
                            spacing: 12
                        ) {
                            detailCard(label: "Section", value: row.section)
                            detailCard(label: "Summary", value: row.summary)
                            detailCard(label: "Effects", value: "\(row.effects)")
                            detailCard(label: "Sequence Context", value: model.screenModel.activeSequence.sequencePathSummary)
                        }
                    } else {
                        Text("No sequencing items are available yet.")
                            .foregroundStyle(.secondary)
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

    private func inventorySection(minHeight: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            GroupBox("Sequencing Items") {
                Table(model.screenModel.inventoryRows, selection: $model.selectedRowID) {
                    TableColumn("Design") { row in
                        Text(row.designLabel.isEmpty ? "—" : row.designLabel)
                    }
                    TableColumn("Kind") { row in
                        Text(row.kind)
                    }
                    TableColumn("Timing") { row in
                        Text(row.timing)
                    }
                    TableColumn("Section") { row in
                        Text(row.section)
                    }
                    TableColumn("Target") { row in
                        Text(row.target)
                    }
                    TableColumn("Level") { row in
                        Text(row.level)
                    }
                    TableColumn("Summary") { row in
                        Text(row.summary)
                            .lineLimit(1)
                    }
                    TableColumn("Effects") { row in
                        Text("\(row.effects)")
                    }
                }
                .padding(.vertical, 4)
            }

            if model.screenModel.timingReview.trackCount > 0 {
                GroupBox("Timing Review") {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack(spacing: 12) {
                            chip(model.screenModel.timingReview.status)
                            chip("Tracks \(model.screenModel.timingReview.trackCount)")
                            if model.screenModel.timingReview.needsReview {
                                chip("Needs Review")
                            }
                        }
                        Text(model.screenModel.timingReview.summaryText)
                            .foregroundStyle(.secondary)
                        Table(model.screenModel.timingReview.rows, selection: $model.selectedTimingReviewRowID) {
                            TableColumn("Timing Track") { row in
                                Text(row.trackName)
                            }
                            TableColumn("Status") { row in
                                Text(row.status)
                            }
                            TableColumn("Coverage") { row in
                                Text(row.coverage)
                            }
                            TableColumn("Captured") { row in
                                Text(row.capturedAt)
                            }
                            TableColumn("Diff") { row in
                                Text(row.diffSummary)
                                    .lineLimit(1)
                            }
                            TableColumn("Action") { row in
                                if row.canAcceptReview {
                                    Button("Accept Review") {
                                        model.selectedTimingReviewRowID = row.id
                                        model.acceptTimingReview()
                                    }
                                } else {
                                    Text("No action")
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .frame(minHeight: minHeight, maxHeight: .infinity)
        .layoutPriority(2)
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(Capsule())
    }

    private var statusSummaryText: String {
        if !model.screenModel.translationSummary.blockers.isEmpty {
            return model.screenModel.translationSummary.blockers.first ?? model.screenModel.translationSummary.readinessSummary
        }
        if !model.screenModel.translationSummary.warnings.isEmpty {
            return model.screenModel.translationSummary.warnings.first ?? model.screenModel.translationSummary.readinessSummary
        }
        return model.screenModel.translationSummary.readinessSummary
    }

    private var timingDependencyText: String {
        let raw = model.screenModel.detail.materializationSummary
        if let first = raw.components(separatedBy: "\n\n").first?.trimmingCharacters(in: .whitespacesAndNewlines),
           !first.isEmpty {
            return first.replacingOccurrences(of: "Timing dependency: ", with: "")
        }
        return raw
    }

    private var sequenceSettingsText: String {
        let type = xlightsSessionModel.snapshot.sequenceType
        let frame = xlightsSessionModel.snapshot.frameMs > 0 ? "\(xlightsSessionModel.snapshot.frameMs) ms" : "unknown frame"
        let duration: String
        if xlightsSessionModel.snapshot.durationMs > 0 {
            let seconds = Double(xlightsSessionModel.snapshot.durationMs) / 1000.0
            duration = String(format: "%.1f s", seconds)
        } else {
            duration = "unknown duration"
        }
        return "\(type), \(frame), \(duration)"
    }

    private var readyToProceedText: String {
        switch model.screenModel.overview.state {
        case .ready:
            return "Yes. Sequence context is usable."
        case .partial:
            return "Partially. Review the items below before proceeding."
        case .blocked:
            return "No. Resolve the blocking items below first."
        case .none:
            return "No current sequence readiness state is available."
        }
    }

    private var needsAttentionItems: [String] {
        var items: [String] = []
        items.append(contentsOf: model.screenModel.translationSummary.blockers)
        items.append(contentsOf: model.screenModel.translationSummary.warnings)
        items.append(contentsOf: model.screenModel.validationIssues.map(\.message))

        var seen = Set<String>()
        return items.filter { item in
            let trimmed = item.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty, !seen.contains(trimmed) else { return false }
            seen.insert(trimmed)
            return true
        }
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

    private func bannerView(_ banner: WorkflowBannerModel) -> some View {
        Text(banner.text)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color(nsColor: .controlBackgroundColor))
            .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func bulletSection(title: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.subheadline)
                .fontWeight(.semibold)
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                Text("• \(item)")
                    .foregroundStyle(.secondary)
            }
        }
    }
}
