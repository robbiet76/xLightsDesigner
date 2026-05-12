import Foundation
import Observation

@MainActor
@Observable
final class ReviewScreenViewModel {
    private let workspace: ProjectWorkspace
    private let pendingWorkService: PendingWorkService
    private let reviewExecutionService: ReviewExecutionService
    private let xlightsSessionService: XLightsSessionService
    var screenModel: ReviewScreenModel
    var calibrationReview: ProductionCalibrationReviewPanelModel
    var selectedCalibrationSequenceID = ""
    var selectedCalibrationMetricChoices: [String: String] = [:]
    var shouldShowCalibrationVideo = false
    var calibrationVideoZoom = 0.0
    var calibrationVideoIsPlaying = false
    var calibrationVideoCurrentTime = 0.0
    var calibrationVideoDuration = 0.0
    var calibrationVideoSeekTarget = 0.0
    var calibrationVideoSeekRequestId = 0
    var transientBanner: WorkflowBannerModel?
    var isApplying = false
    var isRestoringBackup = false
    private var lastAppliedSequencePath = ""
    private var lastSequenceBackupPath = ""

    init(
        workspace: ProjectWorkspace,
        pendingWorkService: PendingWorkService = LocalPendingWorkService(),
        reviewExecutionService: ReviewExecutionService = LocalReviewExecutionService(),
        xlightsSessionService: XLightsSessionService = LocalXLightsSessionService()
    ) {
        self.workspace = workspace
        self.pendingWorkService = pendingWorkService
        self.reviewExecutionService = reviewExecutionService
        self.xlightsSessionService = xlightsSessionService
        self.screenModel = Self.buildScreenModel(
            project: workspace.activeProject,
            pendingWork: try? pendingWorkService.loadPendingWork(for: workspace.activeProject),
            transientBanner: nil,
            isApplying: false,
            isRestoringBackup: false,
            lastAppliedSequencePath: "",
            lastSequenceBackupPath: ""
        )
        self.calibrationReview = Self.loadProductionCalibrationReview()
        if let first = calibrationReview.rows.first {
            self.selectedCalibrationSequenceID = first.sequenceId
            self.selectedCalibrationMetricChoices = first.metricChoices
        }
    }

    func refresh() {
        let pendingWork = try? pendingWorkService.loadPendingWork(for: workspace.activeProject)
        screenModel = Self.buildScreenModel(
            project: workspace.activeProject,
            pendingWork: pendingWork,
            transientBanner: transientBanner,
            isApplying: isApplying,
            isRestoringBackup: isRestoringBackup,
            lastAppliedSequencePath: lastAppliedSequencePath,
            lastSequenceBackupPath: lastSequenceBackupPath
        )
        calibrationReview = Self.loadProductionCalibrationReview()
        if selectedCalibrationSequenceID.isEmpty, let first = calibrationReview.rows.first {
            selectedCalibrationSequenceID = first.sequenceId
            selectedCalibrationMetricChoices = first.metricChoices
        } else if let selected = calibrationReview.rows.first(where: { $0.sequenceId == selectedCalibrationSequenceID }) {
            for metric in calibrationReview.metrics where selectedCalibrationMetricChoices[metric.id] == nil {
                selectedCalibrationMetricChoices[metric.id] = selected.metricChoices[metric.id] ?? ""
            }
        }
    }

    var selectedCalibrationReviewRow: ProductionCalibrationReviewRowModel? {
        calibrationReview.rows.first { $0.sequenceId == selectedCalibrationSequenceID }
    }

    func selectCalibrationSequence(_ sequenceId: String) {
        selectedCalibrationSequenceID = sequenceId
        selectedCalibrationMetricChoices = calibrationReview.rows.first { $0.sequenceId == sequenceId }?.metricChoices ?? [:]
        shouldShowCalibrationVideo = false
        calibrationVideoZoom = 0.0
        calibrationVideoIsPlaying = false
        calibrationVideoCurrentTime = 0.0
        calibrationVideoDuration = 0.0
        calibrationVideoSeekTarget = 0.0
        calibrationVideoSeekRequestId = 0
    }

    func setCalibrationChoice(metricId: String, optionId: String) {
        selectedCalibrationMetricChoices[metricId] = optionId
    }

    func showSelectedCalibrationVideo() {
        shouldShowCalibrationVideo = true
    }

    func resetCalibrationVideoZoom() {
        calibrationVideoZoom = 0.0
    }

    func toggleCalibrationVideoPlayback() {
        calibrationVideoIsPlaying.toggle()
    }

    func seekCalibrationVideo(to seconds: Double) {
        calibrationVideoSeekTarget = max(0, seconds)
        calibrationVideoCurrentTime = calibrationVideoSeekTarget
        calibrationVideoSeekRequestId += 1
    }

    func saveCalibrationReviewChoices() {
        guard !selectedCalibrationSequenceID.isEmpty else { return }
        do {
            try Self.saveProductionCalibrationReviewChoices(
                notesPath: calibrationReview.notesPath,
                sequenceId: selectedCalibrationSequenceID,
                metricChoices: selectedCalibrationMetricChoices
            )
            transientBanner = WorkflowBannerModel(
                id: "production-calibration-review-saved",
                text: "Saved production review choices for \(selectedCalibrationSequenceID).",
                state: .ready
            )
            refresh()
        } catch {
            transientBanner = WorkflowBannerModel(
                id: "production-calibration-review-save-failed",
                text: "Unable to save production review choices: \(error.localizedDescription)",
                state: .blocked
            )
            refresh()
        }
    }

    func applyPendingWork() {
        guard !isApplying, let project = workspace.activeProject else { return }
        let pendingWork = try? pendingWorkService.loadPendingWork(for: project)
        let blockers = Self.reviewBlockers(project: project, pendingWork: pendingWork)
        guard blockers.isEmpty else {
            transientBanner = WorkflowBannerModel(
                id: "review-apply-blocked",
                text: blockers.joined(separator: " "),
                state: .blocked
            )
            refresh()
            return
        }
        isApplying = true
        transientBanner = WorkflowBannerModel(
            id: "review-apply-running",
            text: "Applying pending work to xLights...",
            state: .partial
        )
        refresh()
        Task {
            do {
                let result = try await reviewExecutionService.applyPendingWork(
                    projectFilePath: project.projectFilePath,
                    appRootPath: AppEnvironment.canonicalAppRoot,
                    endpoint: AppEnvironment.xlightsOwnedAPIBaseURL
                )
                let saveSummary = try? await xlightsSessionService.saveCurrentSequence()
                isApplying = false
                let feedbackSummary: String
                if result.renderFeedbackCaptured {
                    feedbackSummary = " Render feedback artifacts captured."
                } else if result.renderFeedbackStatus == "owned_routes_unavailable" {
                    let missing = result.renderFeedbackMissingRequirements.joined(separator: ", ")
                    feedbackSummary = missing.isEmpty
                        ? " Render feedback observation skipped: owned render-feedback routes are unavailable."
                        : " Render feedback observation skipped: missing owned routes \(missing)."
                } else if !result.renderFeedbackStatus.isEmpty {
                    feedbackSummary = " Render feedback status: \(result.renderFeedbackStatus)."
                } else {
                    feedbackSummary = ""
                }
                let validationSummary: String
                if let validation = result.practicalValidationSummary {
                    if validation.overallOk {
                        validationSummary = " Practical validation passed: \(validation.readbackPassed) readback checks, \(validation.designPassed) design checks."
                    } else {
                        validationSummary = " Practical validation needs review: \(validation.readbackFailed) readback failures, \(validation.designFailed) design failures."
                    }
                } else {
                    validationSummary = ""
                }
                let metadataSummary = result.metadataAssignmentCount > 0
                    ? " Display metadata used: \(result.metadataAssignmentCount) assignment\(result.metadataAssignmentCount == 1 ? "" : "s")."
                    : ""
                let renderSummary = result.renderCurrentSummary.isEmpty
                    ? try? await xlightsSessionService.renderCurrentSequence()
                    : result.renderCurrentSummary
                let renderFailureSummary = result.renderCurrentError.isEmpty ? "" : " Render-current warning: \(result.renderCurrentError)."
                lastAppliedSequencePath = result.sequencePath
                lastSequenceBackupPath = result.sequenceBackupPath
                transientBanner = WorkflowBannerModel(
                    id: "review-apply-success",
                    text: "Applied \(result.commandCount) commands via \(result.applyPath.isEmpty ? "sequence apply" : result.applyPath). Revision: \(result.nextRevision.isEmpty ? "updated" : result.nextRevision)." + (result.sequenceBackupPath.isEmpty ? "" : " Backup: \(result.sequenceBackupPath).") + validationSummary + metadataSummary + feedbackSummary + renderFailureSummary + (renderSummary.map { " \($0)" } ?? "") + (saveSummary.map { " \($0)" } ?? ""),
                    state: .ready
                )
                NotificationCenter.default.post(name: .projectArtifactsDidChange, object: project.projectFilePath)
                refresh()
            } catch {
                isApplying = false
                transientBanner = WorkflowBannerModel(
                    id: "review-apply-failed",
                    text: friendlyFailureText(error),
                    state: .blocked
                )
                refresh()
            }
        }
    }

    func restoreLastBackup() {
        guard !isRestoringBackup else { return }
        let sequencePath = lastAppliedSequencePath.trimmingCharacters(in: .whitespacesAndNewlines)
        let backupPath = lastSequenceBackupPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !sequencePath.isEmpty, !backupPath.isEmpty else {
            transientBanner = WorkflowBannerModel(
                id: "review-restore-blocked",
                text: "No Review backup is available to restore yet.",
                state: .blocked
            )
            refresh()
            return
        }
        isRestoringBackup = true
        transientBanner = WorkflowBannerModel(
            id: "review-restore-running",
            text: "Restoring last Review backup...",
            state: .partial
        )
        refresh()
        Task {
            do {
                let summary = try await reviewExecutionService.restoreSequenceBackup(
                    sequencePath: sequencePath,
                    backupPath: backupPath
                )
                isRestoringBackup = false
                transientBanner = WorkflowBannerModel(
                    id: "review-restore-success",
                    text: "\(summary). Reopen or refresh xLights if the active editor still shows the pre-restore state.",
                    state: .ready
                )
                refresh()
            } catch {
                isRestoringBackup = false
                transientBanner = WorkflowBannerModel(
                    id: "review-restore-failed",
                    text: String(error.localizedDescription),
                    state: .blocked
                )
                refresh()
            }
        }
    }

    func deferPendingWork() {
        transientBanner = WorkflowBannerModel(
            id: "review-deferred",
            text: "Pending work deferred. No sequence changes were applied.",
            state: .partial
        )
        refresh()
    }

    private func friendlyFailureText(_ error: Error) -> String {
        let message = String(error.localizedDescription)
        if message.localizedCaseInsensitiveContains("Requested element was not found in the current sequence") {
            return "Pending review artifacts no longer match the active sequence/display. Rebuild the proposal before apply."
        }
        return message
    }

    private static func buildScreenModel(
        project: ActiveProjectModel?,
        pendingWork: PendingWorkReadModel?,
        transientBanner: WorkflowBannerModel?,
        isApplying: Bool,
        isRestoringBackup: Bool,
        lastAppliedSequencePath: String,
        lastSequenceBackupPath: String
    ) -> ReviewScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let state: PendingWorkState = hasProject ? .partial : .blocked
        let targetContext = ProjectTargetContext.resolve(project: project)
        let activeSequenceName = targetContext.sequenceName.isEmpty
            ? (pendingWork?.activeSequenceName ?? "No active sequence")
            : targetContext.sequenceName
        let pendingMatchesTarget = pendingWorkMatchesTarget(project: project, pendingWork: pendingWork)
        let proposalStale = projectProposalIsStale(project)
        let blockers = reviewBlockers(project: project, pendingWork: pendingWork)
        let canApply = blockers.isEmpty
        let pendingSummary = pendingWork?.proposalSummary ?? "There is no pending implementation context yet."
        let targetSequenceSummary = hasProject ? activeSequenceName : "No sequence."
        let readinessSummary = hasProject
            ? (pendingMatchesTarget
                ? "Pending work is visible and can be evaluated before owned API apply execution."
                : "Pending work exists, but it does not match the current project sequence focus.")
            : "Project context is required before review becomes actionable."
        let hasRestorePoint = !lastAppliedSequencePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !lastSequenceBackupPath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty

        let appDesignHighlights = [
            pendingWork?.appDesignMood,
            pendingWork?.appDesignTargetScope,
            pendingWork?.appDesignConstraints
        ].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        let designHighlights = (pendingWork?.proposalLines.prefix(3).map { String($0) } ?? [])
        let sequenceHighlights: [String] = hasProject
            ? [
                activeSequenceName,
                "\(pendingWork?.intentTargetIDs.count ?? 0) targets in handoff",
                "\(pendingWork?.musicSectionLabels.count ?? 0) music sections available"
            ]
            : ["Project required"]

        return ReviewScreenModel(
            title: "Review",
            subtitle: "Implementation gate for pending design and sequence work.",
            pendingSummary: ReviewPendingBandModel(
                identity: PendingWorkIdentityModel(
                    title: hasProject ? "Pending implementation context" : "No pending work",
                    subtitle: hasProject ? projectName : "Project context is required before review becomes actionable.",
                    state: state,
                    updatedSummary: hasProject ? "The same pending-work identity is shared with Design and Sequence." : "Blocked until project context exists"
                ),
                pendingSummary: pendingSummary,
                targetSequenceSummary: targetSequenceSummary,
                readinessSummary: readinessSummary
            ),
            designSummary: ReviewSupportSummaryModel(
                title: "Design Summary",
                summary: hasProject ? (pendingWork?.briefSummary ?? "No design summary available.") : "No design summary available.",
                highlights: hasProject
                    ? (designHighlights.isEmpty
                        ? (appDesignHighlights.isEmpty
                            ? [pendingWork?.moodEnergyArc ?? "Meaning-first direction", pendingWork?.narrativeCues ?? "Proposal remains reviewable", pendingWork?.visualCues ?? "Warnings stay concise"]
                            : appDesignHighlights)
                        : Array(designHighlights))
                    : ["Project required"]
            ),
            sequenceSummary: ReviewSupportSummaryModel(
                title: "Sequence Summary",
                summary: hasProject ? (pendingWork?.intentGoal ?? "No sequence summary available.") : "No sequence summary available.",
                highlights: sequenceHighlights
            ),
            readiness: ReviewReadinessModel(
                state: state,
                blockers: blockers,
                warnings: hasProject
                    ? {
                        var warnings = ["Apply uses the owned xLights API and should be reviewed before it changes the active sequence."]
                        if proposalStale {
                            warnings.append("The generated proposal is stale after a show-folder relink. Regenerate it before applying.")
                        }
                        if let pendingWork, pendingWork.riskNotes.isEmpty == false {
                            warnings.append(contentsOf: pendingWork.riskNotes.prefix(3))
                        }
                        return warnings
                    }()
                    : ["Review cannot proceed without project context."],
                applyPreviewLines: buildApplyPreviewLines(pendingWork: pendingWork),
                impactSummary: hasProject
                    ? "Estimated proposal impact: \(pendingWork?.estimatedImpact ?? 0). Lifecycle: \(pendingWork?.proposalLifecycleStatus ?? "unknown"). Execution: \(pendingWork?.executionModeSummary ?? "No execution plan available.")."
                    : "No implementation impact available.",
                backupSummary: hasProject
                    ? buildBackupSummary(
                        pendingWork: pendingWork,
                        lastAppliedSequencePath: lastAppliedSequencePath,
                        lastSequenceBackupPath: lastSequenceBackupPath
                    )
                    : "No backup context available."
            ),
            actions: ReviewActionStateModel(
                canApply: canApply && !isApplying && !isRestoringBackup,
                canDefer: hasProject && !isApplying && !isRestoringBackup,
                canRestoreBackup: hasProject && hasRestorePoint && !isApplying && !isRestoringBackup,
                applyButtonTitle: isApplying ? "Applying..." : "Apply",
                deferButtonTitle: "Defer",
                restoreBackupButtonTitle: isRestoringBackup ? "Restoring..." : "Restore Last Backup"
            ),
            banners: {
                var banners: [WorkflowBannerModel] = [
                    WorkflowBannerModel(
                    id: "review-slice",
                    text: hasProject ? "Review applies pending work through the shared sequencing backend while keeping approval local to this screen." : "Review is blocked until project context is active.",
                    state: state
                    )
                ]
                if !pendingMatchesTarget {
                    banners.append(WorkflowBannerModel(
                        id: "review-target-mismatch",
                        text: "Review artifacts do not match the current sequence focus. Regenerate the sequencing proposal for the selected sequence before applying.",
                        state: .blocked
                    ))
                } else if proposalStale {
                    banners.append(WorkflowBannerModel(
                        id: "review-proposal-stale-after-relink",
                        text: "This proposal was generated before the show-folder relink. Regenerate the sequencing proposal before applying.",
                        state: .blocked
                    ))
                }
                if let transientBanner { banners.append(transientBanner) }
                return banners
            }()
        )
    }

    private static func productionCalibrationNotesPath() -> String {
        URL(fileURLWithPath: AppEnvironment.repoRootPath, isDirectory: true)
            .appendingPathComponent("var/benchmarks/production-sequence-read/human-review-notes.template.json")
            .path
    }

    private static func productionCalibrationVideoDirectoryPath() -> String {
        URL(fileURLWithPath: AppEnvironment.repoRootPath, isDirectory: true)
            .appendingPathComponent("var/benchmarks/production-sequence-read/video-review-owned/videos")
            .path
    }

    private static func loadProductionCalibrationReview() -> ProductionCalibrationReviewPanelModel {
        let notesPath = productionCalibrationNotesPath()
        let videoDir = productionCalibrationVideoDirectoryPath()
        guard
            FileManager.default.fileExists(atPath: notesPath),
            let data = try? Data(contentsOf: URL(fileURLWithPath: notesPath)),
            let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return ProductionCalibrationReviewPanelModel(
                isAvailable: false,
                title: "Production Sequence Calibration",
                summary: "No production review worksheet is available yet.",
                notesPath: notesPath,
                videoDirectoryPath: videoDir,
                metrics: [],
                rows: []
            )
        }

        let schema = root["reviewSchema"] as? [String: Any] ?? [:]
        let metricObjects = schema["metricChoices"] as? [String: Any] ?? [:]
        let fileOrder = (schema["metricOrder"] as? [Any] ?? []).map { string($0) }.filter { !$0.isEmpty }
        let order = fileOrder.isEmpty ? metricObjects.keys.sorted() : fileOrder
        let metrics = order.compactMap { metricId -> ProductionCalibrationMetricModel? in
            guard let metric = metricObjects[metricId] as? [String: Any] else { return nil }
            let options = ((metric["options"] as? [[String: Any]]) ?? []).map { option in
                ProductionCalibrationChoiceOptionModel(
                    id: string(option["id"]),
                    label: string(option["label"]),
                    description: string(option["description"])
                )
            }.filter { !$0.id.isEmpty }
            return ProductionCalibrationMetricModel(
                id: metricId,
                label: string(metric["label"]),
                prompt: string(metric["prompt"]),
                options: options
            )
        }

        let reviews = (root["reviews"] as? [[String: Any]]) ?? []
        let rows = reviews.compactMap { review -> ProductionCalibrationReviewRowModel? in
            let sequenceId = string(review["sequenceId"])
            guard !sequenceId.isEmpty else { return nil }
            let choices = (review["metricChoices"] as? [String: Any] ?? [:]).reduce(into: [String: String]()) { partial, entry in
                partial[entry.key] = string(entry.value)
            }
            return ProductionCalibrationReviewRowModel(
                id: sequenceId,
                sequenceId: sequenceId,
                videoPath: URL(fileURLWithPath: videoDir, isDirectory: true).appendingPathComponent("\(slug(sequenceId)).mp4").path,
                status: string(review["status"]),
                recommendation: string(review["recommendation"]),
                metricChoices: choices
            )
        }

        return ProductionCalibrationReviewPanelModel(
            isAvailable: !rows.isEmpty && !metrics.isEmpty,
            title: "Production Sequence Calibration",
            summary: "Review production MP4s with structured lighting-design choices. These choices calibrate full-sequence scoring without relying on free-text interpretation.",
            notesPath: notesPath,
            videoDirectoryPath: videoDir,
            metrics: metrics,
            rows: rows
        )
    }

    private static func saveProductionCalibrationReviewChoices(
        notesPath: String,
        sequenceId: String,
        metricChoices: [String: String]
    ) throws {
        let url = URL(fileURLWithPath: notesPath)
        let data = try Data(contentsOf: url)
        guard var root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw ReviewExecutionError.invalidResponse("Review worksheet is not a JSON object.")
        }
        var reviews = root["reviews"] as? [[String: Any]] ?? []
        guard let index = reviews.firstIndex(where: { string($0["sequenceId"]) == sequenceId }) else {
            throw ReviewExecutionError.invalidResponse("Review worksheet does not contain \(sequenceId).")
        }
        reviews[index]["status"] = "reviewed"
        reviews[index]["recommendation"] = "approve"
        reviews[index]["reviewedAt"] = ISO8601DateFormatter().string(from: Date())
        reviews[index]["metricChoices"] = metricChoices
        root["reviews"] = reviews
        let output = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
        try output.write(to: url)
    }

    private static func slug(_ value: String) -> String {
        let lower = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789._-")
        var result = ""
        var lastWasDash = false
        for scalar in lower.unicodeScalars {
            if allowed.contains(scalar) {
                result.append(String(scalar))
                lastWasDash = false
            } else if !lastWasDash {
                result.append("-")
                lastWasDash = true
            }
        }
        let trimmed = result.trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        return trimmed.isEmpty ? "sequence" : trimmed
    }

    private static func buildBackupSummary(
        pendingWork: PendingWorkReadModel?,
        lastAppliedSequencePath: String,
        lastSequenceBackupPath: String
    ) -> String {
        let constraints = pendingWork?.constraintsSummary ?? "No sequencing constraints recorded."
        let restorePoint = lastSequenceBackupPath.trimmingCharacters(in: .whitespacesAndNewlines)
        let appliedSequence = lastAppliedSequencePath.trimmingCharacters(in: .whitespacesAndNewlines)
        if !restorePoint.isEmpty && !appliedSequence.isEmpty {
            return "Restore point available: \(restorePoint). Restores over target: \(appliedSequence). Current constraints: \(constraints)"
        }
        guard let pendingWork else {
            return "No generated proposal is ready. Current constraints: \(constraints)"
        }
        let sequencePath = pendingWork.activeSequencePath.trimmingCharacters(in: .whitespacesAndNewlines)
        if sequencePath.isEmpty || sequencePath == "No active sequence path" {
            return "Apply is blocked until a sequence path is selected. Current constraints: \(constraints)"
        }
        return "Before apply, the current sequence file will be copied to this project's artifacts/backups folder. Sequence: \(sequencePath). Current constraints: \(constraints)"
    }

    private static func buildApplyPreviewLines(pendingWork: PendingWorkReadModel?) -> [String] {
        guard let pendingWork else { return ["No generated proposal is ready for apply."] }
        if !pendingWork.proposalEffectPlacements.isEmpty {
            return pendingWork.proposalEffectPlacements.prefix(6).map { placement in
                let timing = "\(placement.startMs)-\(placement.endMs)ms"
                let section = placement.sectionLabel.isEmpty ? "unspecified section" : placement.sectionLabel
                let target = placement.targetId.isEmpty ? "unspecified target" : placement.targetId
                let track = placement.trackName.isEmpty ? "default track" : placement.trackName
                return "\(section): \(placement.effectName) on \(target) in \(track) at \(timing)"
            }
        }
        if !pendingWork.proposalLines.isEmpty {
            return Array(pendingWork.proposalLines.prefix(6))
        }
        let targetSummary = pendingWork.intentTargetIDs.prefix(4).joined(separator: ", ")
        let targetText = targetSummary.isEmpty ? "\(pendingWork.proposalTargetCount) targets" : targetSummary
        return [
            "\(pendingWork.proposalCommandCount) proposed commands across \(pendingWork.proposalSectionCount) sections for \(targetText)."
        ]
    }

    private static func reviewBlockers(project: ActiveProjectModel?, pendingWork: PendingWorkReadModel?) -> [String] {
        guard let project else { return ["Project context missing."] }
        guard let pendingWork else { return ["Generate a sequencing proposal before apply."] }
        if projectProposalIsStale(project) {
            return ["Generated proposal is stale after the show-folder relink. Regenerate the sequencing proposal before apply."]
        }
        if !pendingWorkMatchesTarget(project: project, pendingWork: pendingWork) {
            return ["Pending review artifacts do not match the selected project sequence."]
        }
        let activeSequenceName = pendingWork.activeSequenceName.trimmingCharacters(in: .whitespacesAndNewlines)
        if activeSequenceName.isEmpty || activeSequenceName == "No active sequence" || activeSequenceName == "No sequence selected yet" {
            return ["No active sequence loaded."]
        }
        let showFolder = project.showFolder.trimmingCharacters(in: .whitespacesAndNewlines)
        if showFolder.isEmpty {
            return ["Project show folder missing."]
        }
        let activeSequencePath = pendingWork.activeSequencePath.trimmingCharacters(in: .whitespacesAndNewlines)
        if activeSequencePath.isEmpty || activeSequencePath == "No active sequence path" {
            return ["No active sequence path selected."]
        }
        if !isPathWithinShowFolder(activeSequencePath, showFolder) {
            return ["Target sequence is outside the active project show folder."]
        }
        if pendingWork.translationSource != "Canonical Plan" {
            return ["Generate a sequencing proposal before apply."]
        }
        if pendingWork.proposalCommandCount <= 0 {
            return ["Generated proposal has no sequence commands to apply."]
        }
        return []
    }

    private static func projectProposalIsStale(_ project: ActiveProjectModel?) -> Bool {
        guard let project else { return false }
        let flags = (project.snapshot["flags"]?.value as? [String: Any]) ?? [:]
        return bool(flags["proposalStale"]) && bool(flags["hasDraftProposal"])
    }

    private static func bool(_ value: Any?) -> Bool {
        if let bool = value as? Bool { return bool }
        if let string = value as? String {
            return ["true", "yes", "1"].contains(string.trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
        }
        return false
    }

    private static func string(_ value: Any?) -> String {
        String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func pendingWorkMatchesTarget(project: ActiveProjectModel?, pendingWork: PendingWorkReadModel?) -> Bool {
        guard let project, let pendingWork else { return true }
        let context = ProjectTargetContext.resolve(project: project)
        let targetPath = ProjectTargetContext.normalizedPath(context.sequencePath)
        let pendingPath = ProjectTargetContext.normalizedPath(pendingWork.activeSequencePath)
        if !targetPath.isEmpty, !pendingPath.isEmpty, pendingWork.activeSequencePath != "No active sequence path" {
            return targetPath == pendingPath
        }
        let targetName = context.sequenceName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let pendingName = pendingWork.activeSequenceName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !targetName.isEmpty, !pendingName.isEmpty, pendingName != "no active sequence" else { return true }
        return targetName == pendingName
    }

    nonisolated private static func isPathWithinShowFolder(_ candidatePath: String, _ showFolderPath: String) -> Bool {
        let candidate = normalizePath(candidatePath)
        let root = normalizePath(showFolderPath)
        guard !candidate.isEmpty, !root.isEmpty else { return false }
        return candidate == root || candidate.hasPrefix(root + "/")
    }

    nonisolated private static func normalizePath(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        return URL(fileURLWithPath: trimmed).standardizedFileURL.path
    }
}
