import SwiftUI
import AVKit

struct ReviewScreenView: View {
    @Bindable var model: ReviewScreenViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                ForEach(model.screenModel.banners, id: \.id) { banner in
                    bannerView(banner)
                }
                pendingBand
                AdaptiveSplitView(breakpoint: 1100, spacing: 20) {
                    supportPane(title: model.screenModel.designSummary.title, summary: model.screenModel.designSummary)
                } secondary: {
                    supportPane(title: model.screenModel.sequenceSummary.title, summary: model.screenModel.sequenceSummary)
                }
                productionCalibrationReviewPane
                actionPane
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { model.refresh() }
        .onReceive(NotificationCenter.default.publisher(for: .projectWorkspaceDidChange)) { _ in
            model.refresh()
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(model.screenModel.title)
                .font(.largeTitle)
                .fontWeight(.semibold)
            Text(model.screenModel.subtitle)
                .foregroundStyle(.secondary)
            PageHeaderFocusText(text: headerFocusText)
        }
    }

    private var headerFocusText: String {
        let sequence = model.screenModel.pendingSummary.targetSequenceSummary.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sequence.isEmpty, sequence != "No sequence." else { return "" }
        return "Sequence: \(sequence)"
    }

    private var pendingBand: some View {
        GroupBox("Pending Work") {
            VStack(alignment: .leading, spacing: 10) {
                Text(model.screenModel.pendingSummary.identity.title).font(.title2).fontWeight(.semibold)
                Text(model.screenModel.pendingSummary.identity.subtitle).foregroundStyle(.secondary)
                HStack(spacing: 10) { chip(model.screenModel.pendingSummary.identity.state.rawValue); chip(model.screenModel.pendingSummary.identity.updatedSummary) }
                detailRow(label: "Pending Summary", value: model.screenModel.pendingSummary.pendingSummary)
                detailRow(label: "Sequence", value: model.screenModel.pendingSummary.targetSequenceSummary)
                detailRow(label: "Readiness", value: model.screenModel.pendingSummary.readinessSummary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private func supportPane(title: String, summary: ReviewSupportSummaryModel) -> some View {
        GroupBox(title) {
            VStack(alignment: .leading, spacing: 10) {
                Text(summary.summary).foregroundStyle(.secondary)
                bulletSection(title: "Highlights", items: summary.highlights)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .padding(.vertical, 4)
        }
    }

    private var actionPane: some View {
        GroupBox("Apply Gate") {
            VStack(alignment: .leading, spacing: 12) {
                chip(model.screenModel.readiness.state.rawValue)
                bulletSection(title: "Blockers", items: model.screenModel.readiness.blockers)
                bulletSection(title: "Warnings", items: model.screenModel.readiness.warnings)
                bulletSection(title: "Apply Preview", items: model.screenModel.readiness.applyPreviewLines)
                detailRow(label: "Impact", value: model.screenModel.readiness.impactSummary)
                detailRow(label: "Backup / Restore", value: model.screenModel.readiness.backupSummary)
                HStack {
                    Button(model.screenModel.actions.applyButtonTitle) { model.applyPendingWork() }
                        .buttonStyle(.borderedProminent)
                        .disabled(!model.screenModel.actions.canApply)
                    Button(model.screenModel.actions.deferButtonTitle) { model.deferPendingWork() }
                        .disabled(!model.screenModel.actions.canDefer)
                    Button(model.screenModel.actions.restoreBackupButtonTitle) { model.restoreLastBackup() }
                        .disabled(!model.screenModel.actions.canRestoreBackup)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
        }
    }

    private var productionCalibrationReviewPane: some View {
        GroupBox(model.calibrationReview.title) {
            if !model.calibrationReview.isAvailable {
                Text(model.calibrationReview.summary)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            } else {
                VStack(alignment: .leading, spacing: 14) {
                    Text(model.calibrationReview.summary)
                        .foregroundStyle(.secondary)
                    Picker("Sequence", selection: Binding(
                        get: { model.selectedCalibrationSequenceID },
                        set: { model.selectCalibrationSequence($0) }
                    )) {
                        ForEach(model.calibrationReview.rows) { row in
                            Text(row.sequenceId).tag(row.sequenceId)
                        }
                    }
                    .pickerStyle(.menu)

                    VStack(alignment: .leading, spacing: 16) {
                        calibrationVideoPane
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                        Divider()
                        ScrollView {
                            calibrationMetricChoicesPane
                                .frame(maxWidth: .infinity, alignment: .topLeading)
                                .padding(.trailing, 8)
                        }
                        .frame(maxWidth: .infinity, minHeight: 260, maxHeight: 520, alignment: .topLeading)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.vertical, 4)
            }
        }
    }

    private var calibrationVideoPane: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Reference Video").font(.headline)
            if let row = model.selectedCalibrationReviewRow, FileManager.default.fileExists(atPath: row.videoPath) {
                if model.shouldShowCalibrationVideo {
                    calibrationVideoZoomControls

                    ProductionCalibrationVideoPlayerView(
                        videoURL: URL(fileURLWithPath: row.videoPath),
                        zoom: $model.calibrationVideoZoom,
                        isPlaying: $model.calibrationVideoIsPlaying,
                        currentTime: $model.calibrationVideoCurrentTime,
                        duration: $model.calibrationVideoDuration,
                        seekTarget: $model.calibrationVideoSeekTarget,
                        seekRequestId: $model.calibrationVideoSeekRequestId
                    )
                    .aspectRatio(16.0 / 9.0, contentMode: .fit)
                    .frame(maxWidth: .infinity, minHeight: 420, idealHeight: 560, maxHeight: 620)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                    calibrationVideoPlaybackControls
                } else {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Video is ready for review.")
                            .foregroundStyle(.secondary)
                        Button("Load Video") { model.showSelectedCalibrationVideo() }
                            .buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity, minHeight: 420, alignment: .center)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                Text(row.videoPath)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            } else {
                Text("Video file is not available for the selected sequence.")
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private var calibrationVideoZoomControls: some View {
        HStack(spacing: 12) {
            Text(model.calibrationVideoZoom > 0 ? "\(Int(model.calibrationVideoZoom * 100))%" : "Fit")
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(width: 52, alignment: .trailing)
            Button("Reset") { model.resetCalibrationVideoZoom() }
                .buttonStyle(.bordered)
            Text("Pinch to zoom. Drag to pan. Click video to play or pause.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var calibrationVideoPlaybackControls: some View {
        HStack(spacing: 12) {
            Button(model.calibrationVideoIsPlaying ? "Pause" : "Play") {
                model.toggleCalibrationVideoPlayback()
            }
            .buttonStyle(.bordered)

            Text(Self.formatPlaybackTime(model.calibrationVideoCurrentTime))
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(width: 56, alignment: .trailing)

            Slider(
                value: Binding(
                    get: { model.calibrationVideoCurrentTime },
                    set: { model.calibrationVideoCurrentTime = $0 }
                ),
                in: 0...max(model.calibrationVideoDuration, 1),
                onEditingChanged: { editing in
                    if !editing {
                        model.seekCalibrationVideo(to: model.calibrationVideoCurrentTime)
                    }
                }
            )
            .frame(minWidth: 260)

            Text(Self.formatPlaybackTime(model.calibrationVideoDuration))
                .font(.caption)
                .monospacedDigit()
                .foregroundStyle(.secondary)
                .frame(width: 56, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 4)
    }

    private static func formatPlaybackTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds > 0 else { return "0:00" }
        let totalSeconds = Int(seconds.rounded())
        return "\(totalSeconds / 60):\(String(format: "%02d", totalSeconds % 60))"
    }

    private var calibrationMetricChoicesPane: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Lighting Design Review").font(.headline)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 360), alignment: .top)], alignment: .leading, spacing: 14) {
                ForEach(model.calibrationReview.metrics) { metric in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(metric.label).font(.subheadline).fontWeight(.semibold)
                        Text(metric.prompt).font(.caption).foregroundStyle(.secondary)
                        Picker(metric.label, selection: Binding(
                            get: { model.selectedCalibrationMetricChoices[metric.id] ?? "" },
                            set: { model.setCalibrationChoice(metricId: metric.id, optionId: $0) }
                        )) {
                            Text("Select...").tag("")
                            ForEach(metric.options) { option in
                                Text(option.label).tag(option.id)
                            }
                        }
                        .labelsHidden()
                        .pickerStyle(.menu)
                        if let selected = metric.options.first(where: { $0.id == model.selectedCalibrationMetricChoices[metric.id] }) {
                            Text(selected.description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .padding(12)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            HStack {
                Button("Save Review Choices") { model.saveCalibrationReviewChoices() }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.selectedCalibrationSequenceID.isEmpty)
                Text(model.calibrationReview.notesPath)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }

    private func chip(_ text: String) -> some View { Text(text).padding(.horizontal, 10).padding(.vertical, 4).background(Color(nsColor: .controlBackgroundColor)).clipShape(Capsule()) }
    private func detailRow(label: String, value: String) -> some View { VStack(alignment: .leading, spacing: 4) { Text(label).font(.headline); Text(value).foregroundStyle(.secondary) } }
    private func bulletSection(title: String, items: [String]) -> some View { VStack(alignment: .leading, spacing: 6) { Text(title).font(.headline); ForEach(Array(items.enumerated()), id: \.offset) { _, item in Text("• \(item)").foregroundStyle(.secondary) } } }
    private func bannerView(_ banner: WorkflowBannerModel) -> some View { Text(banner.text).frame(maxWidth: .infinity, alignment: .leading).padding(12).background(Color(nsColor: .controlBackgroundColor)).clipShape(RoundedRectangle(cornerRadius: 10)) }
}

private struct ProductionCalibrationVideoPlayerView: NSViewRepresentable {
    let videoURL: URL
    @Binding var zoom: Double
    @Binding var isPlaying: Bool
    @Binding var currentTime: Double
    @Binding var duration: Double
    @Binding var seekTarget: Double
    @Binding var seekRequestId: Int

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = PannableScrollView()
        scrollView.hasHorizontalScroller = true
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = false
        scrollView.borderType = .noBorder
        scrollView.drawsBackground = true
        scrollView.backgroundColor = .black
        scrollView.allowsMagnification = true
        scrollView.minMagnification = 0.05
        scrollView.maxMagnification = 1.0
        scrollView.magnification = max(0.05, min(zoom > 0 ? zoom : 1.0, 1.0))

        let containerView = FlippedDocumentView(frame: .zero)
        containerView.wantsLayer = true
        containerView.layer?.backgroundColor = NSColor.black.cgColor

        let playerView = AVPlayerView()
        playerView.controlsStyle = .none
        playerView.videoGravity = .resizeAspect
        playerView.player = context.coordinator.player(for: videoURL)
        containerView.addSubview(playerView)

        let panOverlayView = PanOverlayView()
        panOverlayView.panScrollView = scrollView
        panOverlayView.onMagnify = { factor in
            context.coordinator.applyNativeMagnification(factor, scrollView: scrollView) { nextZoom in
                zoom = nextZoom
            }
        }
        panOverlayView.onClick = {
            isPlaying.toggle()
        }
        containerView.addSubview(panOverlayView)

        scrollView.documentView = containerView
        context.coordinator.containerView = containerView
        context.coordinator.playerView = playerView
        context.coordinator.panOverlayView = panOverlayView
        if let effectiveZoom = context.coordinator.configure(scrollView: scrollView, videoURL: videoURL, zoom: zoom) {
            zoom = effectiveZoom
        }
        context.coordinator.configurePlayback(
            playerView.player,
            seekTarget: seekTarget,
            seekRequestId: seekRequestId,
            updateCurrentTime: { currentTime = $0 },
            updateDuration: { duration = $0 }
        )
        DispatchQueue.main.async {
            if let effectiveZoom = context.coordinator.configure(scrollView: scrollView, videoURL: videoURL, zoom: zoom) {
                zoom = effectiveZoom
            }
        }
        return scrollView
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {
        if context.coordinator.playerView == nil {
            context.coordinator.containerView = nsView.documentView as? FlippedDocumentView
            context.coordinator.playerView = context.coordinator.containerView?.subviews.compactMap { $0 as? AVPlayerView }.first
            context.coordinator.panOverlayView = context.coordinator.containerView?.subviews.compactMap { $0 as? PanOverlayView }.first
        }
        let player = context.coordinator.player(for: videoURL)
        context.coordinator.playerView?.player = player
        if isPlaying {
            player.play()
        } else {
            player.pause()
        }
        context.coordinator.configurePlayback(
            player,
            seekTarget: seekTarget,
            seekRequestId: seekRequestId,
            updateCurrentTime: { currentTime = $0 },
            updateDuration: { duration = $0 }
        )
        context.coordinator.panOverlayView?.onMagnify = { factor in
            context.coordinator.applyNativeMagnification(factor, scrollView: nsView) { nextZoom in
                zoom = nextZoom
            }
        }
        context.coordinator.panOverlayView?.onClick = {
            isPlaying.toggle()
        }
        if let effectiveZoom = context.coordinator.configure(scrollView: nsView, videoURL: videoURL, zoom: zoom) {
            zoom = effectiveZoom
        }
    }

    static func dismantleNSView(_ nsView: NSScrollView, coordinator: Coordinator) {
        coordinator.playerView?.player?.pause()
        coordinator.playerView?.player = nil
        nsView.documentView = nil
        coordinator.reset()
    }

    private final class FlippedDocumentView: NSView {
        override var isFlipped: Bool { true }
    }

    private final class PannableScrollView: NSScrollView {
        private var lastDragPoint: NSPoint?

        override func mouseDown(with event: NSEvent) {
            lastDragPoint = convert(event.locationInWindow, from: nil)
        }

        override func mouseDragged(with event: NSEvent) {
            guard let lastDragPoint else { return }
            let currentPoint = convert(event.locationInWindow, from: nil)
            let deltaX = lastDragPoint.x - currentPoint.x
            let deltaY = currentPoint.y - lastDragPoint.y
            let visible = contentView.bounds
            guard let documentView else { return }
            let maxX = max(0, documentView.frame.width - visible.width)
            let maxY = max(0, documentView.frame.height - visible.height)
            let nextOrigin = NSPoint(
                x: min(max(visible.origin.x + deltaX, 0), maxX),
                y: min(max(visible.origin.y + deltaY, 0), maxY)
            )
            contentView.scroll(to: nextOrigin)
            reflectScrolledClipView(contentView)
            self.lastDragPoint = currentPoint
        }

        override func mouseUp(with event: NSEvent) {
            lastDragPoint = nil
        }
    }

    final class PanOverlayView: NSView {
        weak var panScrollView: NSScrollView?
        var onMagnify: ((CGFloat) -> Void)?
        var onClick: (() -> Void)?
        private var lastDragPoint: NSPoint?
        private var didDrag = false

        override var acceptsFirstResponder: Bool { true }

        override func hitTest(_ point: NSPoint) -> NSView? {
            self
        }

        override func mouseDown(with event: NSEvent) {
            lastDragPoint = event.locationInWindow
            didDrag = false
        }

        override func mouseDragged(with event: NSEvent) {
            guard
                let panScrollView,
                let documentView = panScrollView.documentView,
                let lastDragPoint
            else { return }
            let currentPoint = event.locationInWindow
            if hypot(currentPoint.x - lastDragPoint.x, currentPoint.y - lastDragPoint.y) > 3 {
                didDrag = true
            }
            let visible = panScrollView.contentView.bounds
            let maxX = max(0, documentView.frame.width - visible.width)
            let maxY = max(0, documentView.frame.height - visible.height)
            let nextOrigin = NSPoint(
                x: min(max(visible.origin.x + (lastDragPoint.x - currentPoint.x), 0), maxX),
                y: min(max(visible.origin.y + (currentPoint.y - lastDragPoint.y), 0), maxY)
            )
            panScrollView.contentView.scroll(to: nextOrigin)
            panScrollView.reflectScrolledClipView(panScrollView.contentView)
            self.lastDragPoint = currentPoint
        }

        override func scrollWheel(with event: NSEvent) {
            panScrollView?.scrollWheel(with: event)
        }

        override func magnify(with event: NSEvent) {
            let factor = max(0.2, 1.0 + event.magnification)
            onMagnify?(factor)
        }

        override func mouseUp(with event: NSEvent) {
            if !didDrag {
                onClick?()
            }
            lastDragPoint = nil
            didDrag = false
        }
    }

    final class Coordinator {
        private var currentURL: URL?
        private var currentPlayer: AVPlayer?
        private var currentVideoSize: CGSize?
        private var timeObserverToken: Any?
        private var observedPlayer: AVPlayer?
        private var lastAppliedSeekRequestId = 0
        var containerView: NSView?
        var playerView: AVPlayerView?
        var panOverlayView: PanOverlayView?
        private var lastZoom = 0.0

        func player(for url: URL) -> AVPlayer {
            if currentURL == url, let currentPlayer {
                return currentPlayer
            }
            currentPlayer?.pause()
            let player = AVPlayer(url: url)
            currentURL = url
            currentPlayer = player
            return player
        }

        @MainActor
        func configurePlayback(
            _ player: AVPlayer?,
            seekTarget: Double,
            seekRequestId: Int,
            updateCurrentTime: @escaping (Double) -> Void,
            updateDuration: @escaping (Double) -> Void
        ) {
            guard let player else { return }
            installTimeObserverIfNeeded(
                player,
                updateCurrentTime: updateCurrentTime,
                updateDuration: updateDuration
            )
            syncDuration(player, updateDuration: updateDuration)
            if seekTarget.isFinite, seekTarget >= 0, seekRequestId != lastAppliedSeekRequestId {
                lastAppliedSeekRequestId = seekRequestId
                player.seek(to: CMTime(seconds: seekTarget, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
            }
        }

        @MainActor
        private func installTimeObserverIfNeeded(
            _ player: AVPlayer,
            updateCurrentTime: @escaping (Double) -> Void,
            updateDuration: @escaping (Double) -> Void
        ) {
            if observedPlayer === player, timeObserverToken != nil {
                return
            }
            removeTimeObserver()
            observedPlayer = player
            timeObserverToken = player.addPeriodicTimeObserver(
                forInterval: CMTime(seconds: 0.25, preferredTimescale: 600),
                queue: .main
            ) { [weak self, weak player] time in
                guard let self, let player else { return }
                let seconds = time.seconds
                if seconds.isFinite {
                    updateCurrentTime(max(0, seconds))
                }
                self.syncDuration(player, updateDuration: updateDuration)
            }
        }

        @MainActor
        private func syncDuration(_ player: AVPlayer, updateDuration: (Double) -> Void) {
            let seconds = player.currentItem?.duration.seconds ?? 0
            if seconds.isFinite, seconds > 0 {
                updateDuration(seconds)
            }
        }

        @MainActor
        private func removeTimeObserver() {
            if let timeObserverToken, let observedPlayer {
                observedPlayer.removeTimeObserver(timeObserverToken)
            }
            timeObserverToken = nil
            observedPlayer = nil
        }

        @MainActor
        func applyNativeMagnification(_ factor: CGFloat, scrollView: NSScrollView, updateZoom: (Double) -> Void) {
            let nextZoom = min(max(scrollView.magnification * factor, scrollView.minMagnification), scrollView.maxMagnification)
            let visible = scrollView.contentView.bounds
            scrollView.setMagnification(nextZoom, centeredAt: NSPoint(x: visible.midX, y: visible.midY))
            lastZoom = Double(nextZoom)
            updateZoom(Double(nextZoom))
        }

        @MainActor
        func configure(scrollView: NSScrollView, videoURL: URL, zoom: Double) -> Double? {
            guard
                let containerView = containerView ?? scrollView.documentView,
                let playerView = playerView ?? containerView.subviews.compactMap({ $0 as? AVPlayerView }).first
            else { return nil }
            let viewportWidth = max(scrollView.contentView.bounds.width, scrollView.bounds.width, 900)
            let aspectRatio: CGFloat = 1.848
            let nativeSize = naturalVideoSize(for: videoURL)
            let videoWidth = max(1, nativeSize.width)
            let videoHeight = max(1, nativeSize.height > 0 ? nativeSize.height : videoWidth * aspectRatio)
            let fitZoom = min(1.0, max(0.05, viewportWidth / videoWidth))
            let clampedZoom = zoom > 0 ? min(max(zoom, scrollView.minMagnification), scrollView.maxMagnification) : fitZoom
            containerView.frame = NSRect(x: 0, y: 0, width: videoWidth, height: videoHeight)
            let videoFrame = NSRect(
                x: 0,
                y: 0,
                width: videoWidth,
                height: videoHeight
            )
            playerView.frame = videoFrame
            panOverlayView?.frame = videoFrame
            if abs(Double(scrollView.magnification) - clampedZoom) > 0.0001 {
                let visible = scrollView.contentView.bounds
                scrollView.setMagnification(CGFloat(clampedZoom), centeredAt: NSPoint(x: visible.midX, y: visible.midY))
            }
            lastZoom = clampedZoom
            return clampedZoom
        }

        private func naturalVideoSize(for url: URL) -> CGSize {
            if currentURL == url, let currentVideoSize {
                return currentVideoSize
            }
            let asset = AVURLAsset(url: url)
            guard let track = asset.tracks(withMediaType: .video).first else {
                return CGSize(width: 500, height: 924)
            }
            let transformedSize = track.naturalSize.applying(track.preferredTransform)
            let size = CGSize(width: abs(transformedSize.width), height: abs(transformedSize.height))
            currentVideoSize = size
            return size
        }

        @MainActor
        func reset() {
            removeTimeObserver()
            currentPlayer?.pause()
            currentPlayer = nil
            currentURL = nil
            currentVideoSize = nil
            containerView = nil
            playerView = nil
            panOverlayView = nil
            lastZoom = 0.0
            lastAppliedSeekRequestId = 0
        }
    }
}
