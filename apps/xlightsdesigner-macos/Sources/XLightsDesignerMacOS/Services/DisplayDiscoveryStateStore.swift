import Foundation

protocol DisplayDiscoveryStateStore: Sendable {
    func load(for project: ActiveProjectModel) throws -> DisplayDiscoveryDocument
    func summary(for project: ActiveProjectModel?) -> DisplayDiscoverySummaryModel
    func clear(for project: ActiveProjectModel?) throws
    func upsertInsight(_ insight: DisplayDiscoveryInsightModel, for project: ActiveProjectModel?) throws
    func deleteInsight(subject: String, category: String, for project: ActiveProjectModel?) throws
    func recordConversationTurn(
        project: ActiveProjectModel,
        status: DisplayDiscoveryStatus,
        scope: String,
        candidateProps: [DisplayDiscoveryCandidateModel],
        insights: [DisplayDiscoveryInsightModel],
        unresolvedBranches: [String],
        resolvedBranches: [String],
        tagProposals: [DisplayDiscoveryTagProposalModel],
        userMessage: AssistantMessageModel,
        assistantMessage: AssistantMessageModel
    ) throws
    func upsertTagProposals(_ proposals: [DisplayDiscoveryTagProposalModel], for project: ActiveProjectModel?) throws
    func clearTagProposals(for project: ActiveProjectModel?) throws
}

struct LocalDisplayDiscoveryStateStore: DisplayDiscoveryStateStore {
    func load(for project: ActiveProjectModel) throws -> DisplayDiscoveryDocument {
        let fileURL = storageURL(for: project)
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            return DisplayDiscoveryDocument()
        }
        let data = try Data(contentsOf: fileURL)
        return try JSONDecoder().decode(DisplayDiscoveryDocument.self, from: data)
    }

    func summary(for project: ActiveProjectModel?) -> DisplayDiscoverySummaryModel {
        guard let project, let document = try? load(for: project) else {
            return .empty
        }
        return DisplayDiscoverySummaryModel(
            status: document.status,
            scope: document.scope,
            startedAt: document.startedAt ?? "",
            updatedAt: document.updatedAt ?? "",
            transcriptCount: document.transcript.count,
            candidateProps: document.candidateProps,
            insights: document.insights,
            unresolvedBranches: document.unresolvedBranches,
            resolvedBranches: document.resolvedBranches,
            proposedTags: document.proposedTags
        )
    }

    func clear(for project: ActiveProjectModel?) throws {
        guard let project else { return }
        let fileURL = storageURL(for: project)
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        try FileManager.default.removeItem(at: fileURL)
    }

    func upsertInsight(_ insight: DisplayDiscoveryInsightModel, for project: ActiveProjectModel?) throws {
        guard let project else { return }
        var document = (try? load(for: project)) ?? DisplayDiscoveryDocument()
        document.insights = mergeInsights(existing: document.insights, incoming: [insight])
        document.updatedAt = ISO8601DateFormatter().string(from: Date())
        if document.status == .notStarted {
            document.status = .inProgress
        }
        try save(document, for: project)
    }

    func deleteInsight(subject: String, category: String, for project: ActiveProjectModel?) throws {
        guard let project else { return }
        var document = try load(for: project)
        let normalizedCategory = normalizedCategoryKey(category)
        document.insights.removeAll {
            $0.subject.caseInsensitiveCompare(subject) == .orderedSame &&
            normalizedCategoryKey($0.category) == normalizedCategory
        }
        document.updatedAt = ISO8601DateFormatter().string(from: Date())
        try save(document, for: project)
    }

    func recordConversationTurn(
        project: ActiveProjectModel,
        status: DisplayDiscoveryStatus,
        scope: String,
        candidateProps: [DisplayDiscoveryCandidateModel],
        insights: [DisplayDiscoveryInsightModel],
        unresolvedBranches: [String],
        resolvedBranches: [String],
        tagProposals: [DisplayDiscoveryTagProposalModel],
        userMessage: AssistantMessageModel,
        assistantMessage: AssistantMessageModel
    ) throws {
        var document = (try? load(for: project)) ?? DisplayDiscoveryDocument()
        let timestamp = assistantMessage.timestamp
        if document.startedAt == nil {
            document.startedAt = userMessage.timestamp
        }
        document.status = status
        document.scope = scope
        document.updatedAt = timestamp
        if !candidateProps.isEmpty {
            document.candidateProps = candidateProps
        }
        if !insights.isEmpty {
            document.insights = mergeInsights(existing: document.insights, incoming: insights)
        }
        if !unresolvedBranches.isEmpty {
            var mergedBranches = document.unresolvedBranches
            for branch in unresolvedBranches where !mergedBranches.contains(branch) {
                mergedBranches.append(branch)
            }
            document.unresolvedBranches = mergedBranches
        }
        if !resolvedBranches.isEmpty {
            let resolved = Set(resolvedBranches.map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }.filter { !$0.isEmpty })
            if !resolved.isEmpty {
                document.unresolvedBranches.removeAll { resolved.contains($0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()) }
                var mergedResolved = document.resolvedBranches
                for branch in resolvedBranches where !mergedResolved.contains(branch) {
                    mergedResolved.append(branch)
                }
                document.resolvedBranches = mergedResolved
            }
        }
        if !tagProposals.isEmpty {
            document.proposedTags = mergeTagProposals(existing: document.proposedTags, incoming: tagProposals)
        }
        appendIfNeeded(entry: userMessage, into: &document.transcript)
        appendIfNeeded(entry: assistantMessage, into: &document.transcript)
        try save(document, for: project)
    }

    func upsertTagProposals(_ proposals: [DisplayDiscoveryTagProposalModel], for project: ActiveProjectModel?) throws {
        guard let project, !proposals.isEmpty else { return }
        var document = (try? load(for: project)) ?? DisplayDiscoveryDocument()
        let timestamp = ISO8601DateFormatter().string(from: Date())
        if document.startedAt == nil {
            document.startedAt = timestamp
        }
        document.status = .readyForProposal
        document.updatedAt = timestamp
        document.proposedTags = mergeTagProposals(existing: document.proposedTags, incoming: proposals)
        try save(document, for: project)
    }

    func clearTagProposals(for project: ActiveProjectModel?) throws {
        guard let project else { return }
        var document = try load(for: project)
        document.proposedTags = []
        try save(document, for: project)
    }

    private func mergeInsights(
        existing: [DisplayDiscoveryInsightModel],
        incoming: [DisplayDiscoveryInsightModel]
    ) -> [DisplayDiscoveryInsightModel] {
        var merged = existing
        for insight in incoming {
            let normalizedIncomingCategory = normalizedCategoryKey(insight.category)
            if let index = merged.firstIndex(where: {
                $0.subject.caseInsensitiveCompare(insight.subject) == .orderedSame &&
                normalizedCategoryKey($0.category) == normalizedIncomingCategory
            }) {
                merged[index] = insight
            } else {
                merged.append(insight)
            }
        }
        return merged
    }

    private func mergeTagProposals(
        existing: [DisplayDiscoveryTagProposalModel],
        incoming: [DisplayDiscoveryTagProposalModel]
    ) -> [DisplayDiscoveryTagProposalModel] {
        var merged = existing
        for proposal in incoming {
            if let index = merged.firstIndex(where: { $0.tagName.caseInsensitiveCompare(proposal.tagName) == .orderedSame }) {
                merged[index] = proposal
            } else {
                merged.append(proposal)
            }
        }
        return merged
    }

    private func appendIfNeeded(entry: AssistantMessageModel, into transcript: inout [DisplayDiscoveryTranscriptEntry]) {
        guard !entry.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if transcript.last?.id == entry.id { return }
        transcript.append(DisplayDiscoveryTranscriptEntry(
            id: entry.id,
            role: entry.role,
            text: entry.text,
            timestamp: entry.timestamp,
            handledBy: entry.handledBy
        ))
    }

    private func normalizedCategoryKey(_ value: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let replaced = trimmed.replacingOccurrences(
            of: "[^a-z0-9]+",
            with: "_",
            options: .regularExpression
        )
        return replaced.trimmingCharacters(in: CharacterSet(charactersIn: "_"))
    }

    private func storageURL(for project: ActiveProjectModel) -> URL {
        let projectDir = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent()
        return projectDir.appendingPathComponent("layout/display-discovery.json", isDirectory: false)
    }

    private func save(_ document: DisplayDiscoveryDocument, for project: ActiveProjectModel) throws {
        let fileURL = storageURL(for: project)
        try FileManager.default.createDirectory(at: fileURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        let data = try encoder.encode(document)
        try data.write(to: fileURL, options: .atomic)
    }
}
