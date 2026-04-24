import Foundation
import Observation

@MainActor
@Observable
final class SequenceScreenViewModel {
    private let workspace: ProjectWorkspace
    private let pendingWorkService: PendingWorkService
    private let projectService: ProjectService
    private let proposalService: SequenceProposalService
    private var liveRefreshTask: Task<Void, Never>?
    private var latestPendingWork: PendingWorkReadModel?

    var screenModel: SequenceScreenModel
    var selectedRowID: SequenceInventoryRowModel.ID?
    var selectedTimingReviewRowID: SequenceTimingReviewRowModel.ID?
    var isRefreshing = false
    var isGeneratingProposal = false
    var transientBanner: WorkflowBannerModel?

    init(
        workspace: ProjectWorkspace,
        pendingWorkService: PendingWorkService = LocalPendingWorkService(),
        projectService: ProjectService = LocalProjectService(),
        proposalService: SequenceProposalService = LocalSequenceProposalService()
    ) {
        self.workspace = workspace
        self.pendingWorkService = pendingWorkService
        self.projectService = projectService
        self.proposalService = proposalService
        self.screenModel = Self.placeholderScreenModel(project: workspace.activeProject)
        self.selectedRowID = nil
        self.selectedTimingReviewRowID = nil
    }

    func refresh() {
        guard !isRefreshing else { return }
        isRefreshing = true
        let project = workspace.activeProject
        Task {
            let pendingWork = try? pendingWorkService.loadPendingWork(for: project)
            latestPendingWork = pendingWork
            let session = await Self.loadSequenceSession(project: project, pendingWork: pendingWork)
            let model = Self.buildScreenModel(project: project, pendingWork: pendingWork, session: session)
            screenModel = model
            if screenModel.inventoryRows.contains(where: { $0.id == selectedRowID }) == false {
                selectedRowID = screenModel.inventoryRows.first?.id
            }
            if screenModel.timingReview.rows.contains(where: { $0.id == selectedTimingReviewRowID }) == false {
                selectedTimingReviewRowID = screenModel.timingReview.rows.first?.id
            }
            isRefreshing = false
        }
    }

    func startLiveRefresh() {
        guard liveRefreshTask == nil else { return }
        refresh()
        liveRefreshTask = Task { [weak self] in
            while Task.isCancelled == false {
                try? await Task.sleep(for: .seconds(2))
                guard Task.isCancelled == false else { break }
                await MainActor.run {
                    self?.refresh()
                }
            }
        }
    }

    func stopLiveRefresh() {
        liveRefreshTask?.cancel()
        liveRefreshTask = nil
    }

    var selectedRow: SequenceInventoryRowModel? {
        guard let selectedRowID else { return screenModel.inventoryRows.first }
        return screenModel.inventoryRows.first(where: { $0.id == selectedRowID }) ?? screenModel.inventoryRows.first
    }

    var selectedTimingReviewRow: SequenceTimingReviewRowModel? {
        guard let selectedTimingReviewRowID else { return screenModel.timingReview.rows.first }
        return screenModel.timingReview.rows.first(where: { $0.id == selectedTimingReviewRowID }) ?? screenModel.timingReview.rows.first
    }

    var projectShowFolder: String {
        workspace.activeProject?.showFolder.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    }

    func preferredSequencePath() -> String {
        let showFolder = projectShowFolder
        guard !showFolder.isEmpty else { return "" }
        if let pendingPath = latestPendingWork?.activeSequencePath,
           pendingPath.isEmpty == false,
           pendingPath != "No active sequence path",
           Self.isPathWithinShowFolder(pendingPath, showFolder) {
            return pendingPath
        }
        let baseName = preferredSequenceBaseName()
        guard !baseName.isEmpty else { return "" }
        return URL(fileURLWithPath: showFolder)
            .appendingPathComponent(baseName, isDirectory: true)
            .appendingPathComponent(baseName)
            .appendingPathExtension("xsq")
            .path
    }

    func preferredMediaFile() -> String? {
        if let pendingAudio = latestPendingWork?.audioPath,
           pendingAudio.isEmpty == false,
           pendingAudio != "No audio path selected" {
            return pendingAudio
        }
        return nil
    }

    func preferredSequenceBaseName() -> String {
        if let pendingPath = latestPendingWork?.activeSequencePath,
           pendingPath.isEmpty == false,
           pendingPath != "No active sequence path" {
            let last = URL(fileURLWithPath: pendingPath).deletingPathExtension().lastPathComponent
            if !last.isEmpty { return sanitizeSequenceBaseName(last) }
        }
        if let activeName = latestPendingWork?.activeSequenceName,
           activeName.isEmpty == false,
           activeName != "No active sequence" {
            return sanitizeSequenceBaseName(activeName)
        }
        if let audio = preferredMediaFile() {
            let last = URL(fileURLWithPath: audio).deletingPathExtension().lastPathComponent
            if !last.isEmpty { return sanitizeSequenceBaseName(last) }
        }
        return ""
    }

    private func sanitizeSequenceBaseName(_ raw: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(.whitespaces)
        let filtered = String(raw.unicodeScalars.map { allowed.contains($0) ? String($0) : " " }.joined())
        let words = filtered
            .split(whereSeparator: { $0.isWhitespace })
            .map(String.init)
            .filter { !$0.isEmpty }
        return words.joined()
    }

    func acceptTimingReview() {
        guard let activeProject = workspace.activeProject, let row = selectedTimingReviewRow, row.canAcceptReview else { return }
        var updatedProject = activeProject
        let runtime = (updatedProject.snapshot["sequenceAgentRuntime"]?.value as? [String: Any]) ?? [:]
        let timingTrackProvenance = (runtime["timingTrackProvenance"] as? [String: Any]) ?? [:]
        let timingGeneratedSignatures = (runtime["timingGeneratedSignatures"] as? [String: Any]) ?? [:]

        guard var record = timingTrackProvenance[row.id] as? [String: Any] else { return }
        let acceptedAt = ISO8601DateFormatter().string(from: Date())
        var userFinal = (record["userFinal"] as? [String: Any]) ?? [:]
        userFinal["acceptedAt"] = acceptedAt
        userFinal["reviewer"] = "native_app"
        userFinal["reviewNote"] = "Accepted from native Sequence screen."
        if let source = record["source"] as? [String: Any] {
            userFinal["marks"] = source["marks"]
            userFinal["capturedAt"] = acceptedAt
        }
        record["userFinal"] = userFinal
        record["diff"] = [
            "summary": [
                "unchanged": 0,
                "moved": 0,
                "relabeled": 0,
                "addedByUser": 0,
                "removedFromSource": 0
            ]
        ]

        var updatedProvenance = timingTrackProvenance
        updatedProvenance[row.id] = record
        var updatedRuntime = runtime
        updatedRuntime["timingTrackProvenance"] = updatedProvenance
        updatedRuntime["timingGeneratedSignatures"] = timingGeneratedSignatures
        updatedProject.snapshot["sequenceAgentRuntime"] = AnyCodable(updatedRuntime)

        do {
            let saved = try projectService.saveProject(updatedProject)
            workspace.setProject(saved)
        } catch {
            return
        }

        refresh()
    }

    func generateProposalFromDesignIntent() {
        guard !isGeneratingProposal, let activeProject = workspace.activeProject else { return }
        let pendingWork = latestPendingWork
        let prerequisiteBlockers = Self.proposalPrerequisiteBlockers(project: activeProject, pendingWork: pendingWork)
        guard prerequisiteBlockers.isEmpty else {
            transientBanner = WorkflowBannerModel(
                id: "sequence-proposal-blocked",
                text: prerequisiteBlockers.joined(separator: " "),
                state: .blocked
            )
            return
        }
        let prompt = Self.buildNativeDesignPrompt(project: activeProject, pendingWork: pendingWork)
        guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            transientBanner = WorkflowBannerModel(
                id: "sequence-proposal-no-intent",
                text: "Save design intent before generating a sequencing proposal.",
                state: .blocked
            )
            return
        }
        isGeneratingProposal = true
        transientBanner = WorkflowBannerModel(
            id: "sequence-proposal-running",
            text: "Generating sequencing proposal from native design intent.",
            state: .partial
        )
        Task {
            do {
                let result = try await proposalService.generateProposal(
                    projectFilePath: activeProject.projectFilePath,
                    appRootPath: activeProject.appRootPath,
                    endpoint: AppEnvironment.xlightsOwnedAPIBaseURL,
                    prompt: prompt
                )
                transientBanner = WorkflowBannerModel(
                    id: "sequence-proposal-success",
                    text: "Generated proposal \(result.proposalArtifactID.isEmpty ? "" : result.proposalArtifactID). \(result.warningCount) warnings.",
                    state: .ready
                )
                isGeneratingProposal = false
                NotificationCenter.default.post(name: .projectArtifactsDidChange, object: activeProject.projectFilePath)
                refresh()
            } catch {
                transientBanner = WorkflowBannerModel(
                    id: "sequence-proposal-failed",
                    text: friendlyError(error),
                    state: .blocked
                )
                isGeneratingProposal = false
            }
        }
    }

    private func friendlyError(_ error: Error) -> String {
        let message = error.localizedDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        if message.contains("Project snapshot is missing audioPathInput") {
            return "Choose or analyze audio before generating a sequencing proposal."
        }
        return message.isEmpty ? "Proposal generation failed." : message
    }

    private static func proposalPrerequisiteBlockers(project: ActiveProjectModel, pendingWork: PendingWorkReadModel?) -> [String] {
        let snapshot = project.snapshot.mapValues(\.value)
        let audioPath = string(snapshot["audioPathInput"], fallback: pendingWork?.audioPath ?? "")
        let sequencePath = string(snapshot["sequencePathInput"], fallback: pendingWork?.activeSequencePath ?? "")
        var blockers: [String] = []
        if audioPath.isEmpty || audioPath == "No audio path selected" {
            blockers.append("Choose or analyze audio before generating a sequencing proposal.")
        }
        if sequencePath.isEmpty || sequencePath == "No active sequence path" {
            blockers.append("Create or select the project sequence before generating a sequencing proposal.")
        }
        return blockers
    }

    private static func placeholderScreenModel(project: ActiveProjectModel?) -> SequenceScreenModel {
        SequenceScreenModel(
            title: "Sequence",
            subtitle: "Technical translation of the current creative work into sequence context.",
            hasLiveSequence: false,
            planOnlyMode: false,
            overview: SequenceOverviewModel(
                state: project == nil ? .blocked : .partial,
                activeSequenceSummary: project == nil ? "No active sequence" : "Loading…",
                translationSource: "Pending",
                itemCount: 0,
                commandCount: 0,
                targetCount: 0,
                sectionCount: 0,
                warningCount: 0,
                validationIssueCount: 0,
                explanationText: project == nil ? "Sequence remains blocked until a project is active." : "Loading current sequence context and technical translation."
            ),
            activeSequence: SequenceContextBandModel(
                identity: PendingWorkIdentityModel(
                    title: project == nil ? "No active sequence context" : "Loading sequence context",
                    subtitle: project?.projectName ?? "Project context is required before sequence readiness matters.",
                    state: project == nil ? .blocked : .partial,
                    updatedSummary: project == nil ? "Blocked until project context exists" : "Loading…"
                ),
                activeSequenceName: "Loading…",
                sequencePathSummary: "Loading…",
                boundTrackSummary: "Loading…",
                timingSummary: "Loading…"
            ),
            translationSummary: SequenceTranslationSummaryModel(
                state: project == nil ? .blocked : .partial,
                readinessSummary: project == nil ? "Sequence workflow is blocked until a project is active." : "Loading translation readiness.",
                blockers: [],
                warnings: [],
                handoffSummary: "Loading…"
            ),
            detail: SequenceDetailPaneModel(
                revisionSummary: "Loading…",
                settingsSummary: "Loading…",
                bindingSummary: "Loading…",
                materializationSummary: "Loading…",
                technicalWarnings: []
            ),
            validationIssues: [],
            timingReview: SequenceTimingReviewSummaryModel(status: "empty", summaryText: "No timing tracks tracked yet.", trackCount: 0, needsReview: false, rows: []),
            inventoryRows: [],
            banners: []
        )
    }

    private static func buildNativeDesignPrompt(project: ActiveProjectModel, pendingWork: PendingWorkReadModel?) -> String {
        let intent = project.snapshot["nativeDesignIntent"]?.value as? [String: Any] ?? [:]
        let goal = string(intent["goal"], fallback: pendingWork?.nativeDesignGoal ?? "")
        let mood = string(intent["mood"], fallback: pendingWork?.nativeDesignMood ?? "")
        let targetScope = string(intent["targetScope"], fallback: pendingWork?.nativeDesignTargetScope ?? "")
        let constraints = string(intent["constraints"], fallback: pendingWork?.nativeDesignConstraints ?? "")
        let references = string(intent["references"], fallback: pendingWork?.nativeDesignReferences ?? "")
        let approvalNotes = string(intent["approvalNotes"], fallback: pendingWork?.nativeDesignApprovalNotes ?? "")
        let lines = [
            goal.isEmpty ? "" : "Goal: \(goal)",
            mood.isEmpty ? "" : "Mood and style: \(mood)",
            targetScope.isEmpty ? "" : "Target scope: \(targetScope)",
            constraints.isEmpty ? "" : "Constraints: \(constraints)",
            references.isEmpty ? "" : "References: \(references)",
            approvalNotes.isEmpty ? "" : "Approval notes: \(approvalNotes)"
        ].filter { !$0.isEmpty }
        return lines.joined(separator: "\n")
    }

    private static func buildScreenModel(project: ActiveProjectModel?, pendingWork: PendingWorkReadModel?, session: SequenceSessionSnapshot) -> SequenceScreenModel {
        let projectName = project?.projectName ?? "No active project"
        let hasProject = project != nil
        let inventoryRows = buildInventoryRows(pendingWork: pendingWork)
        let liveSequenceOpen = session.hasLiveSequence
        let activeSequenceName = liveSequenceOpen ? session.activeSequenceName : "No live sequence open"
        let activeSequencePath = liveSequenceOpen
            ? session.activeSequencePathSummary
            : "No live sequence is currently open in xLights."
        let projectSequenceSummary: String
        if let pendingWork {
            projectSequenceSummary = pendingWork.recentSequenceCount > 0
                ? "\(pendingWork.recentSequenceCount) recent project sequence\(pendingWork.recentSequenceCount == 1 ? "" : "s") available."
                : "No project sequence history is recorded yet."
        } else {
            projectSequenceSummary = "No project sequence history is available."
        }
        let targetSummary: String
        if let pendingWork, !pendingWork.intentTargetIDs.isEmpty {
            let preview = pendingWork.intentTargetIDs.prefix(4).joined(separator: ", ")
            targetSummary = "Targets: \(pendingWork.intentTargetIDs.count) in current intent handoff. \(preview)"
        } else {
            targetSummary = "No target scope available yet."
        }
        let timingSummary: String
        if let pendingWork, !pendingWork.musicSectionLabels.isEmpty {
            let sectionPreview = pendingWork.musicSectionLabels.prefix(4).joined(separator: ", ")
            timingSummary = "\(pendingWork.musicSectionLabels.count) music sections available from design context. \(sectionPreview)"
        } else {
            timingSummary = "No timing substrate available."
        }
        let sceneFootprint = pendingWork.map { "\($0.layoutModelCount) models, \($0.layoutGroupCount) groups." } ?? "No scene footprint available."
        let nativeTargetScope = pendingWork?.nativeDesignTargetScope.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let nativeTargetScopeSummary = nativeTargetScope.isEmpty ? "No native target scope saved." : nativeTargetScope
        let warnings = session.validationIssues.filter { $0.severity != .blocked }.map(\.message)
        let blockers = session.validationIssues.filter { $0.severity == .blocked }.map(\.message)

        return SequenceScreenModel(
            title: "Sequence",
            subtitle: "Technical translation of the current creative work into sequence context.",
            hasLiveSequence: session.hasLiveSequence,
            planOnlyMode: session.planOnlyMode,
            overview: SequenceOverviewModel(
                state: session.overallState,
                activeSequenceSummary: hasProject ? projectSequenceSummary : "No project sequence summary available.",
                translationSource: pendingWork?.translationSource ?? "Pending",
                itemCount: inventoryRows.count,
                commandCount: pendingWork?.proposalCommandCount ?? 0,
                targetCount: pendingWork?.proposalTargetCount ?? pendingWork?.intentTargetIDs.count ?? 0,
                sectionCount: pendingWork?.proposalSectionCount ?? pendingWork?.intentSectionCount ?? 0,
                warningCount: warnings.count,
                validationIssueCount: session.validationIssues.count,
                explanationText: hasProject
                    ? "Sequence turns the current design handoff into inspectable technical changes before review and apply."
                    : "Sequence remains blocked until a project is active."
            ),
            activeSequence: SequenceContextBandModel(
                identity: PendingWorkIdentityModel(
                    title: hasProject ? "Current sequence context" : "No active sequence context",
                    subtitle: hasProject ? projectName : "Project context is required before sequence readiness matters.",
                    state: session.overallState,
                    updatedSummary: session.contextSummary
                ),
                activeSequenceName: hasProject ? activeSequenceName : "No sequence",
                sequencePathSummary: hasProject ? activeSequencePath : "No sequence path available.",
                boundTrackSummary: hasProject ? projectSequenceSummary : "No project sequence summary available.",
                timingSummary: hasProject ? timingSummary : "No timing substrate available."
            ),
            translationSummary: SequenceTranslationSummaryModel(
                state: session.overallState,
                readinessSummary: session.readinessSummary,
                blockers: hasProject ? blockers : ["Active project required."],
                warnings: hasProject ? warnings : ["Sequence workflow remains informational without project context."],
                handoffSummary: pendingWork?.intentGoal ?? pendingWork?.nativeDesignGoal ?? "Sequence handoff is unavailable."
            ),
            detail: SequenceDetailPaneModel(
                revisionSummary: hasProject ? "Project snapshot currently anchors \(pendingWork?.artifactTimestampSummary ?? project?.updatedAt ?? "unknown revision time")." : "No revision available.",
                settingsSummary: hasProject ? "Source: \(pendingWork?.translationSource ?? "Pending"). Commands: \(pendingWork?.proposalCommandCount ?? 0). \(projectSequenceSummary)" : "No settings summary.",
                bindingSummary: hasProject ? "\(targetSummary)\n\nNative design scope: \(nativeTargetScopeSummary)\n\nConstraints: \(pendingWork?.constraintsSummary ?? "No sequencing constraints recorded.")" : "No binding available.",
                materializationSummary: hasProject ? "Timing dependency: \(session.timingDependencySummary)\n\nExecution: \(pendingWork?.executionModeSummary ?? "No execution plan available.")" : "No materialization summary.",
                technicalWarnings: hasProject
                    ? (["Scene footprint: \(sceneFootprint)"] + session.technicalWarnings)
                    : ["Project context missing."]
            ),
            validationIssues: session.validationIssues,
            timingReview: session.timingReview,
            inventoryRows: inventoryRows,
            banners: session.banners
        )
    }

    private static func buildInventoryRows(pendingWork: PendingWorkReadModel?) -> [SequenceInventoryRowModel] {
        guard let pendingWork else { return [] }
        if !pendingWork.proposalEffectPlacements.isEmpty {
            return aggregateEffectPlacements(pendingWork.proposalEffectPlacements)
        }
        let proposalRows = pendingWork.proposalLines.enumerated().map { index, line in
            summarizeSequenceRow(line: line, index: index + 1)
        }
        if proposalRows.isEmpty {
            return pendingWork.musicSectionLabels.enumerated().map { index, label in
                SequenceInventoryRowModel(
                    id: "section-\(index)-\(label)",
                    designLabel: "",
                    kind: "Section Context",
                    timing: "XD: Song Structure",
                    section: label,
                    target: "Pending target scope",
                    level: "Section",
                    summary: "Section available for future technical translation.",
                    effects: 0
                )
            }
        }
        return proposalRows
    }

    private static func aggregateEffectPlacements(_ placements: [PendingEffectPlacement]) -> [SequenceInventoryRowModel] {
        var buckets: [String: (designLabel: String, kind: String, timing: String, section: String, target: String, level: String, summaries: [String], count: Int)] = [:]
        for placement in placements {
            let designLabel = buildDesignLabel(designId: placement.designId, designRevision: placement.designRevision)
            let level = inferLevel(for: placement.targetId)
            let key = [designLabel, placement.trackName, placement.sectionLabel, placement.targetId, level].joined(separator: "|")
            if buckets[key] == nil {
                buckets[key] = (designLabel, "Effect Placement", placement.trackName, placement.sectionLabel, placement.targetId, level, [], 0)
            }
            buckets[key]?.summaries.append(placement.effectName)
            buckets[key]?.count += 1
        }
        return buckets.enumerated().map { index, entry in
            let value = entry.value
            let uniqueSummaries = Array(Set(value.summaries)).sorted()
            return SequenceInventoryRowModel(
                id: "placement-\(index)-\(entry.key)",
                designLabel: value.designLabel,
                kind: value.kind,
                timing: value.timing,
                section: value.section,
                target: value.target,
                level: value.level,
                summary: uniqueSummaries.joined(separator: ", "),
                effects: value.count
            )
        }.sorted { lhs, rhs in
            if lhs.section != rhs.section { return lhs.section < rhs.section }
            if lhs.target != rhs.target { return lhs.target < rhs.target }
            return lhs.designLabel < rhs.designLabel
        }
    }

    private static func summarizeSequenceRow(line: String, index: Int) -> SequenceInventoryRowModel {
        let raw = line.trimmingCharacters(in: .whitespacesAndNewlines)
        let parts = raw.split(separator: "/").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        let section = parts.first ?? "General"
        let target = parts.count > 1 ? parts[1] : "Unresolved"
        let summary = parts.count > 2 ? parts.dropFirst(2).joined(separator: " / ") : (raw.isEmpty ? "Pending translation detail" : raw)
        let lowerSection = section.lowercased()
        let timing = containsAny(lowerSection, terms: ["chorus", "verse", "intro", "bridge", "pre-chorus", "post-chorus", "outro", "hook"])
            ? "XD: Song Structure"
            : "XD: Sequencer Plan"
        return SequenceInventoryRowModel(
            id: "proposal-\(index)",
            designLabel: "",
            kind: "Translated Change",
            timing: timing,
            section: section,
            target: target,
            level: inferLevel(for: target),
            summary: summary,
            effects: max(1, summary.components(separatedBy: CharacterSet(charactersIn: ",;")).filter { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false }.count)
        )
    }

    private static func buildDesignLabel(designId: String, designRevision: Int) -> String {
        let raw = designId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return "" }
        if raw.hasPrefix("DES-") {
            let number = raw.replacingOccurrences(of: "DES-", with: "")
            return "D\(number).\(designRevision)"
        }
        return raw
    }

    private static func inferLevel(for target: String) -> String {
        let lowerTarget = target.lowercased()
        if lowerTarget == "allmodels" || lowerTarget == "global" { return "Group" }
        if target.contains("/") || containsAny(lowerTarget, terms: ["submodel", "segment", "face", "hat", "eyes", "left", "right", "top", "bottom"]) {
            return "Submodel"
        }
        return "Model"
    }

    private static func containsAny(_ text: String, terms: [String]) -> Bool {
        terms.contains { text.contains($0) }
    }

    private static func loadSequenceSession(project: ActiveProjectModel?, pendingWork: PendingWorkReadModel?) async -> SequenceSessionSnapshot {
        guard let project else {
            return SequenceSessionSnapshot(
                overallState: .blocked,
                contextSummary: "Blocked until project context exists",
                readinessSummary: "Sequence workflow is blocked until a project is active.",
                timingDependencySummary: "No timing dependency available.",
                technicalWarnings: [],
                validationIssues: [SequenceValidationIssueModel(id: "project-required", severity: .blocked, code: "project_required", message: "Active project required.")],
                timingReview: SequenceTimingReviewSummaryModel(status: "empty", summaryText: "No timing tracks tracked yet.", trackCount: 0, needsReview: false, rows: []),
                banners: [WorkflowBannerModel(id: "sequence-blocked", text: "Sequence is blocked until project context is active.", state: .blocked)],
                effectiveSequencePath: "",
                hasLiveSequence: false,
                planOnlyMode: false,
                activeSequenceName: "",
                activeSequencePathSummary: ""
            )
        }

        async let healthTask = fetchHealth()
        async let openTask = fetchOpenSequence()
        let health = await healthTask
        let openSequence = await openTask

        let snapshot = project.snapshot.mapValues(\.value)
        let flags = (snapshot["flags"] as? [String: Any]) ?? [:]
        let planOnlyMode = bool(flags["planOnlyMode"])
        let activeSequenceLoaded = bool(flags["activeSequenceLoaded"])
        let sequencePathInput = string(snapshot["sequencePathInput"])
        let showFolder = project.showFolder
        let liveSequencePath = openSequence.path
        let liveSequenceAllowed = isPathWithinShowFolder(liveSequencePath, showFolder)
        let liveSequenceOpen = openSequence.isOpen && !liveSequencePath.isEmpty && liveSequenceAllowed
        let effectiveSequenceLoaded = activeSequenceLoaded || liveSequenceOpen
        let effectiveSequencePath = liveSequenceOpen ? liveSequencePath : sequencePathInput
        let effectiveSequenceAllowed = effectiveSequencePath.isEmpty ? true : isPathWithinShowFolder(effectiveSequencePath, showFolder.isEmpty ? effectiveSequencePath : showFolder)
        let liveSequenceName = liveSequencePath.isEmpty
            ? ""
            : URL(fileURLWithPath: liveSequencePath).deletingPathExtension().lastPathComponent

        let inventoryRows = buildInventoryRows(pendingWork: pendingWork)
        let requiredTrackNames = Set((pendingWork?.proposalEffectPlacements ?? []).map(\.trackName).filter { $0.lowercased().hasPrefix("xd:") })
        let needsTiming = (pendingWork?.proposalSectionCount ?? pendingWork?.intentSectionCount ?? 0) > 0
        let timingDependencyReady = !needsTiming || !requiredTrackNames.isEmpty || pendingWork?.proposalShouldUseFullSongStructureTrack == true
        let timingDependencySummary: String
        if !needsTiming {
            timingDependencySummary = "No timing dependency is required for the current draft."
        } else if requiredTrackNames.isEmpty == false || pendingWork?.proposalShouldUseFullSongStructureTrack == true {
            timingDependencySummary = "Required timing context is planned for the current section scope."
        } else {
            timingDependencySummary = "Required timing context is missing for the current section scope."
        }

        let timingReview = buildTimingReview(from: snapshot, requiredTrackNames: requiredTrackNames)
        let dashboardSequenceBlocked = health && !planOnlyMode && (!effectiveSequenceLoaded || !effectiveSequenceAllowed)

        var validationIssues: [SequenceValidationIssueModel] = []
        if inventoryRows.isEmpty {
            validationIssues.append(SequenceValidationIssueModel(id: "no-sequence-draft", severity: .partial, code: "no_sequence_draft", message: "No translated sequence changes are available yet."))
        }
        if health == false {
            validationIssues.append(SequenceValidationIssueModel(id: "xlights-not-connected", severity: .blocked, code: "xlights_not_connected", message: "Connect to xLights before sequencing."))
        }
        if dashboardSequenceBlocked {
            if effectiveSequenceLoaded == false {
                validationIssues.append(SequenceValidationIssueModel(id: "no-active-sequence", severity: .blocked, code: "no_active_sequence", message: "Open a sequence or enter plan-only mode."))
            } else if effectiveSequenceAllowed == false {
                validationIssues.append(SequenceValidationIssueModel(id: "sequence-outside-show", severity: .blocked, code: "sequence_outside_show_folder", message: "Open a sequence inside the active Show Directory."))
            }
        }
        if timingDependencyReady == false {
            validationIssues.append(SequenceValidationIssueModel(id: "missing-required-timing-track", severity: .partial, code: "missing_required_timing_track", message: timingDependencySummary))
        }
        if timingReview.needsReview {
            validationIssues.append(SequenceValidationIssueModel(id: "timing-review-required", severity: .partial, code: "timing_review_required", message: timingReview.summaryText))
        }

        let overallState: PendingWorkState
        if validationIssues.contains(where: { $0.severity == .blocked }) {
            overallState = .blocked
        } else if validationIssues.isEmpty {
            overallState = .ready
        } else {
            overallState = .partial
        }

        let contextSummary: String
        if health == false {
            contextSummary = "xLights is unavailable"
        } else if effectiveSequenceLoaded == false {
            contextSummary = "No live sequence is open"
        } else if effectiveSequenceAllowed == false {
            contextSummary = "Live sequence is outside the project show folder"
        } else {
            contextSummary = "Technical translation reflects the current live sequence context"
        }

        let readinessSummary = validationIssues.first?.message ?? "Technical translation context is tied to the latest project snapshot, current intent handoff, and real design artifacts."
        var banners: [WorkflowBannerModel] = []
        if health == false {
            banners.append(WorkflowBannerModel(id: "sequence-xlights-required", text: "Sequence needs a live xLights session for full session validation.", state: .blocked))
        } else if effectiveSequenceLoaded == false {
            banners.append(WorkflowBannerModel(id: "sequence-open-required", text: "Open the target sequence in xLights to validate live sequence context.", state: .blocked))
        }
        if timingReview.needsReview {
            banners.append(WorkflowBannerModel(id: "timing-review", text: timingReview.summaryText, state: .partial))
        }

        var technicalWarnings: [String] = []
        if let pendingWork, pendingWork.riskNotes.isEmpty == false {
            technicalWarnings.append(contentsOf: pendingWork.riskNotes.prefix(3))
        }
        if planOnlyMode {
            technicalWarnings.append("Plan-only mode is enabled.")
        }

        return SequenceSessionSnapshot(
            overallState: overallState,
            contextSummary: contextSummary,
            readinessSummary: readinessSummary,
            timingDependencySummary: timingDependencySummary,
            technicalWarnings: technicalWarnings,
            validationIssues: validationIssues,
            timingReview: timingReview,
            banners: banners,
            effectiveSequencePath: effectiveSequencePath,
            hasLiveSequence: liveSequenceOpen,
            planOnlyMode: planOnlyMode,
            activeSequenceName: liveSequenceOpen ? liveSequenceName : string(snapshot["activeSequence"]),
            activeSequencePathSummary: liveSequenceOpen
                ? "\(liveSequencePath)\nSource of truth: currently open in xLights."
                : (effectiveSequencePath.isEmpty ? "No sequence path available." : "\(effectiveSequencePath)\nSource of truth: project snapshot (no live sequence open).")
        )
    }

    private static func buildTimingReview(from snapshot: [String: Any], requiredTrackNames: Set<String>) -> SequenceTimingReviewSummaryModel {
        let runtime = (snapshot["sequenceAgentRuntime"] as? [String: Any]) ?? [:]
        let policies = (runtime["timingTrackPolicies"] as? [String: Any]) ?? [:]
        let signatures = (runtime["timingGeneratedSignatures"] as? [String: Any]) ?? [:]
        let provenance = (runtime["timingTrackProvenance"] as? [String: Any]) ?? [:]

        let rows: [SequenceTimingReviewRowModel] = provenance.compactMap { key, value in
            guard let record = value as? [String: Any] else { return nil }
            let policy = (policies[key] as? [String: Any]) ?? [:]
            let trackName = string(record["trackName"]).isEmpty ? string(policy["trackName"], fallback: string(policy["sourceTrack"])) : string(record["trackName"])
            guard !trackName.isEmpty else { return nil }
            let status = classifyTimingStatus(record: record, expectedGeneratedSignature: string(signatures[key]))
            let coverage = string(record["coverageMode"], fallback: "unknown")
            let capturedAt = string(((record["userFinal"] as? [String: Any])?["capturedAt"]))
            let diffSummary = summarizeTimingDiff(record: record)
            let required = requiredTrackNames.isEmpty || requiredTrackNames.contains(trackName)
            return SequenceTimingReviewRowModel(
                id: key,
                trackName: trackName,
                status: status,
                coverage: coverage,
                capturedAt: capturedAt.isEmpty ? "—" : capturedAt,
                diffSummary: diffSummary,
                canAcceptReview: required && (status == "user_edited" || status == "stale")
            )
        }.sorted { $0.trackName < $1.trackName }

        let requiredRows = rows.filter { requiredTrackNames.isEmpty || requiredTrackNames.contains($0.trackName) }
        let staleCount = requiredRows.filter { $0.status == "stale" }.count
        let editedCount = requiredRows.filter { $0.status == "user_edited" }.count
        let needsReview = staleCount > 0 || editedCount > 0
        let summaryText: String
        let status: String
        if requiredRows.isEmpty {
            status = "empty"
            summaryText = "No timing tracks tracked yet."
        } else if staleCount > 0 {
            status = "stale"
            summaryText = "\(staleCount) timing track\(staleCount == 1 ? "" : "s") stale against the latest generated source."
        } else if editedCount > 0 {
            status = "edited"
            summaryText = "\(editedCount) timing track\(editedCount == 1 ? "" : "s") contain user edits."
        } else {
            status = "clean"
            summaryText = "\(requiredRows.count) timing track\(requiredRows.count == 1 ? "" : "s") unchanged."
        }

        return SequenceTimingReviewSummaryModel(
            status: status,
            summaryText: summaryText,
            trackCount: requiredRows.count,
            needsReview: needsReview,
            rows: rows
        )
    }

    private static func classifyTimingStatus(record: [String: Any], expectedGeneratedSignature: String) -> String {
        let diffSummary = (((record["diff"] as? [String: Any])?["summary"] as? [String: Any]) ?? [:])
        let hasUserEdits = int(diffSummary["moved"]) > 0 || int(diffSummary["relabeled"]) > 0 || int(diffSummary["addedByUser"]) > 0 || int(diffSummary["removedFromSource"]) > 0
        let sourceSignature = timingMarksSignature((((record["source"] as? [String: Any])?["marks"]) as? [[String: Any]]) ?? [])
        let stale = !expectedGeneratedSignature.isEmpty && !sourceSignature.isEmpty && expectedGeneratedSignature != sourceSignature
        if stale { return "stale" }
        if hasUserEdits { return "user_edited" }
        return "unchanged"
    }

    private static func summarizeTimingDiff(record: [String: Any]) -> String {
        let diffSummary = (((record["diff"] as? [String: Any])?["summary"] as? [String: Any]) ?? [:])
        return "moved \(int(diffSummary["moved"])), relabeled \(int(diffSummary["relabeled"])), added \(int(diffSummary["addedByUser"])), removed \(int(diffSummary["removedFromSource"]))"
    }

    private static func timingMarksSignature(_ marks: [[String: Any]]) -> String {
        marks.map { mark in
            let startMs = max(0, int(mark["startMs"]))
            let endMs = max(startMs + 1, int(mark["endMs"]))
            let label = string(mark["label"])
            return "\(startMs):\(endMs):\(label)"
        }
        .filter { !$0.isEmpty }
        .sorted()
        .joined(separator: "|")
    }

    nonisolated private static func fetchHealth() async -> Bool {
        guard let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + "/health") else { return false }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let dataObject = json["data"] as? [String: Any] else {
            return false
        }
        return bool(dataObject["listenerReachable"])
    }

    nonisolated private static func fetchOpenSequence() async -> OpenSequenceSnapshot {
        guard let url = URL(string: AppEnvironment.xlightsOwnedAPIBaseURL + "/sequence/open") else { return OpenSequenceSnapshot(isOpen: false, path: "") }
        guard let (data, _) = try? await URLSession.shared.data(from: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let dataObject = json["data"] as? [String: Any] else {
            return OpenSequenceSnapshot(isOpen: false, path: "")
        }
        let sequence = dataObject["sequence"] as? [String: Any]
        let path = string(sequence?["path"] ?? sequence?["file"])
        return OpenSequenceSnapshot(isOpen: bool(dataObject["isOpen"]), path: path)
    }

    nonisolated private static func isPathWithinShowFolder(_ candidatePath: String, _ showFolderPath: String) -> Bool {
        let candidate = normalizePath(candidatePath)
        let root = normalizePath(showFolderPath)
        guard !candidate.isEmpty, !root.isEmpty else { return false }
        if candidate == root { return true }
        return candidate.hasPrefix(root + "/")
    }

    nonisolated private static func normalizePath(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\\", with: "/")
            .replacingOccurrences(of: #"/+$"#, with: "", options: .regularExpression)
    }

    nonisolated private static func string(_ value: Any?, fallback: String = "") -> String {
        let text = String(describing: value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? fallback : text
    }

    nonisolated private static func bool(_ value: Any?) -> Bool {
        if let bool = value as? Bool { return bool }
        return String(describing: value ?? "").lowercased() == "true"
    }

    nonisolated private static func int(_ value: Any?) -> Int {
        if let num = value as? NSNumber { return num.intValue }
        return Int(String(describing: value ?? "")) ?? 0
    }
}

private struct SequenceSessionSnapshot {
    let overallState: PendingWorkState
    let contextSummary: String
    let readinessSummary: String
    let timingDependencySummary: String
    let technicalWarnings: [String]
    let validationIssues: [SequenceValidationIssueModel]
    let timingReview: SequenceTimingReviewSummaryModel
    let banners: [WorkflowBannerModel]
    let effectiveSequencePath: String
    let hasLiveSequence: Bool
    let planOnlyMode: Bool
    let activeSequenceName: String
    let activeSequencePathSummary: String
}

private struct OpenSequenceSnapshot: Sendable {
    let isOpen: Bool
    let path: String
}
