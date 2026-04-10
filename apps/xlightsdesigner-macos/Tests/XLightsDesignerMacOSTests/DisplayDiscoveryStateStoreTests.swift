import Foundation
import Testing
@testable import XLightsDesignerMacOS

struct DisplayDiscoveryStateStoreTests {
    @Test func recordsDiscoveryConversationIntoProjectDisplayFolder() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let projectDir = root.appendingPathComponent("Test Project", isDirectory: true)
        try FileManager.default.createDirectory(at: projectDir, withIntermediateDirectories: true)
        let projectFile = projectDir.appendingPathComponent("Test Project.xdproj", isDirectory: false)
        try Data("{}".utf8).write(to: projectFile)

        let project = ActiveProjectModel(
            id: UUID().uuidString,
            projectName: "Test Project",
            projectFilePath: projectFile.path,
            showFolder: "/tmp/show",
            mediaPath: "",
            appRootPath: root.path,
            createdAt: "2026-04-08T00:00:00Z",
            updatedAt: "2026-04-08T00:00:00Z",
            snapshot: [:]
        )
        let store = LocalDisplayDiscoveryStateStore()
        try store.recordConversationTurn(
            project: project,
            status: .inProgress,
            scope: "groups_models_v1",
            candidateProps: [
                DisplayDiscoveryCandidateModel(name: "Snowman", type: "Prop", reason: "named prop that may have character significance")
            ],
            insights: [
                DisplayDiscoveryInsightModel(
                    subject: "Snowman",
                    subjectType: "model",
                    category: "visual_role",
                    value: "featured character prop",
                    rationale: "User confirmed Snowman is intended as a featured character.",
                    targetNames: ["Snowman"]
                )
            ],
            unresolvedBranches: [
                "Need to understand whether the snowflake families should be treated uniformly or as separate feature branches."
            ],
            resolvedBranches: [],
            tagProposals: [
                DisplayDiscoveryTagProposalModel(
                    tagName: "featured character",
                    tagDescription: "Use for named props that should carry character attention.",
                    rationale: "Snowman was confirmed as a featured character prop.",
                    targetNames: ["Snowman"]
                )
            ],
            userMessage: AssistantMessageModel(
                id: "u1",
                role: .user,
                text: "Help me understand the display.",
                timestamp: "2026-04-08T00:00:00Z",
                handledBy: nil,
                routeDecision: nil,
                displayName: nil
            ),
            assistantMessage: AssistantMessageModel(
                id: "a1",
                role: .assistant,
                text: "I noticed Snowman. Is that a featured character prop?",
                timestamp: "2026-04-08T00:00:01Z",
                handledBy: "designer_dialog",
                routeDecision: "designer_dialog",
                displayName: "Designer"
            )
        )

        let summary = store.summary(for: project)
        #expect(summary.status == .inProgress)
        #expect(summary.transcriptCount == 2)
        #expect(summary.candidateProps.map(\.name) == ["Snowman"])
        #expect(summary.insights.count == 1)
        #expect(summary.insights.first?.subject == "Snowman")
        #expect(summary.unresolvedBranches.count == 1)
        #expect(summary.resolvedBranches.isEmpty)
        #expect(summary.proposedTags.count == 1)
    }
}
