import Foundation
import Testing
@testable import XLightsDesignerMacOS

private final class ProjectRelinkNotificationCapture: @unchecked Sendable {
    var object: String?
}

struct ProjectServiceTests {
    @Test func createProjectStoresExpectedFileName() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        let project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        #expect(project.projectName == name)
        #expect(project.projectFilePath.hasSuffix("/\(name)/\(name).xdproj"))
    }

    @Test func openProjectAcceptsProjectFolder() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        let project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        let folder = URL(fileURLWithPath: project.projectFilePath).deletingLastPathComponent().path
        let reopened = try service.openProject(filePath: folder)
        #expect(reopened.projectFilePath == project.projectFilePath)
        #expect(reopened.projectName == project.projectName)
    }

    @Test func createProjectMigratesDurableProjectKnowledgeFromExistingProject() throws {
        let service = try makeService()
        let sourceName = "App Test Project \(UUID().uuidString.prefix(6))"
        var source = try service.createProject(
            draft: ProjectDraftModel(
                projectName: sourceName,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        source.snapshot["projectBrief"] = AnyCodable([
            "document": "Warm community show with a clear central focal area.",
            "updatedAt": "2026-05-01T00:00:00Z"
        ])
        source.snapshot["appDesignIntent"] = AnyCodable([
            "goal": "Keep the mature display style but start a new project cleanly."
        ])
        source.snapshot["projectConcept"] = AnyCodable("Neighborhood holiday display")
        source.snapshot["sequencePathInput"] = AnyCodable("/tmp/show/OldSong/OldSong.xsq")
        source.snapshot["audioPathInput"] = AnyCodable("/tmp/show/Audio/OldSong.mp3")
        source.snapshot["recentSequences"] = AnyCodable(["/tmp/show/OldSong/OldSong.xsq"])
        source.snapshot["proposed"] = AnyCodable([["summary": "Generated proposal should not migrate"]])
        source = try service.saveProject(source)
        let sourceDir = URL(fileURLWithPath: source.projectFilePath).deletingLastPathComponent()
        let markerFile = sourceDir.appendingPathComponent("diagnostics/marker.txt")
        try FileManager.default.createDirectory(at: markerFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("marker".utf8).write(to: markerFile)
        let proposalFile = sourceDir.appendingPathComponent("artifacts/proposals/proposal.json")
        try FileManager.default.createDirectory(at: proposalFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(#"{"artifactType":"proposal_bundle_v1"}"#.utf8).write(to: proposalFile)
        let modelIndexFile = sourceDir.appendingPathComponent("display/model-index.json")
        try FileManager.default.createDirectory(at: modelIndexFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data(#"{"artifactType":"target_metadata_index_v1"}"#.utf8).write(to: modelIndexFile)
        let metadataFile = sourceDir.appendingPathComponent("layout/layout-metadata.json")
        try FileManager.default.createDirectory(at: metadataFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        let metadataJSON = """
        {
          "version": 1,
          "tags": [
            { "id": "tag-1", "name": "Focal", "description": "Primary display target" }
          ],
          "targetTags": {
            "Tree": ["tag-1"]
          },
          "preferencesByTargetId": {
            "Tree": { "rolePreference": "focal" }
          },
          "visualHintDefinitions": []
        }
        """
        try Data(metadataJSON.utf8).write(to: metadataFile)
        let targetBehaviorFile = sourceDir.appendingPathComponent("display/target-behavior.json")
        try FileManager.default.createDirectory(at: targetBehaviorFile.deletingLastPathComponent(), withIntermediateDirectories: true)
        let targetBehaviorJSON = """
        {
          "artifactType": "project_target_behavior_learning_v1",
          "artifactVersion": "1.0",
          "records": [
            { "recordId": "tbl1:test", "targetId": "Tree", "effectName": "On", "stats": { "sampleCount": 2 } }
          ]
        }
        """
        try Data(targetBehaviorJSON.utf8).write(to: targetBehaviorFile)
        let discoveryFile = sourceDir.appendingPathComponent("display/discovery.json")
        let discoveryJSON = """
        {
          "status": "readyForProposal",
          "scope": "full-display",
          "candidateProps": [],
          "insights": [],
          "proposedTags": []
        }
        """
        try Data(discoveryJSON.utf8).write(to: discoveryFile)

        let migratedName = "App Test Project \(UUID().uuidString.prefix(6)) Migrated"
        let migrated = try service.createProject(
            draft: ProjectDraftModel(
                projectName: migratedName,
                showFolder: "/tmp/new-show",
                mediaPath: "",
                migrateMetadata: true,
                migrationSourceProjectPath: sourceDir.path
            )
        )
        let migratedDir = URL(fileURLWithPath: migrated.projectFilePath).deletingLastPathComponent()
        let migratedMarker = migratedDir.appendingPathComponent("diagnostics/marker.txt")
        let migratedMetadata = migratedDir.appendingPathComponent("display/metadata.json")
        let migratedTargetBehavior = migratedDir.appendingPathComponent("display/target-behavior.json")
        let migratedDiscovery = migratedDir.appendingPathComponent("display/discovery.json")
        let migratedProposal = migratedDir.appendingPathComponent("artifacts/proposals/proposal.json")
        let migratedModelIndex = migratedDir.appendingPathComponent("display/model-index.json")
        let migratedBrief = migrated.snapshot["projectBrief"]?.value as? [String: Any]
        let migratedIntent = migrated.snapshot["appDesignIntent"]?.value as? [String: Any]

        #expect(migrated.projectName == migratedName)
        #expect(migrated.showFolder == "/tmp/new-show")
        #expect(FileManager.default.fileExists(atPath: migrated.projectFilePath))
        #expect(FileManager.default.fileExists(atPath: migratedMetadata.path))
        #expect(FileManager.default.fileExists(atPath: migratedTargetBehavior.path))
        #expect(FileManager.default.fileExists(atPath: migratedDiscovery.path))
        #expect(!FileManager.default.fileExists(atPath: migratedMarker.path))
        #expect(!FileManager.default.fileExists(atPath: migratedProposal.path))
        #expect(!FileManager.default.fileExists(atPath: migratedModelIndex.path))
        #expect(try String(contentsOf: migratedMetadata).contains("\"Tree\""))
        #expect(try String(contentsOf: migratedTargetBehavior).contains("\"tbl1:test\""))
        #expect(try String(contentsOf: migratedDiscovery).contains("readyForProposal"))
        #expect(migratedBrief?["document"] as? String == "Warm community show with a clear central focal area.")
        #expect(migratedIntent?["goal"] as? String == "Keep the mature display style but start a new project cleanly.")
        #expect(migrated.snapshot["projectConcept"]?.value as? String == "Neighborhood holiday display")
        #expect(migrated.snapshot["sequencePathInput"]?.value as? String == "")
        #expect(migrated.snapshot["audioPathInput"]?.value as? String == "")
        #expect((migrated.snapshot["recentSequences"]?.value as? [Any])?.isEmpty == true)
        #expect(migrated.snapshot["proposed"] == nil)
        #expect(URL(fileURLWithPath: migrated.projectFilePath).lastPathComponent == "\(migratedName).xdproj")
    }

    @Test func migrationSourceMustLiveUnderProjectsRoot() throws {
        let service = try makeService()
        let tempRoot = FileManager.default.temporaryDirectory.appendingPathComponent("xld-invalid-migration-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tempRoot, withIntermediateDirectories: true)
        let invalidSource = tempRoot.appendingPathComponent("Outside Project", isDirectory: true)
        try FileManager.default.createDirectory(at: invalidSource, withIntermediateDirectories: true)
        let invalidProjectFile = invalidSource.appendingPathComponent("Outside Project.xdproj")
        try Data("{}".utf8).write(to: invalidProjectFile)

        #expect(throws: ProjectServiceError.self) {
            try service.createProject(
                draft: ProjectDraftModel(
                    projectName: "App Test Project \(UUID().uuidString.prefix(6)) Invalid",
                    showFolder: "/tmp/new-show",
                    mediaPath: "",
                    migrateMetadata: true,
                    migrationSourceProjectPath: invalidSource.path
                )
            )
        }
    }

    @Test func saveProjectPersistsProjectBriefInSnapshot() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        var project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )

        project.snapshot["projectBrief"] = AnyCodable([
            "document": "Warm neighborhood show with a strong central focal area that feels welcoming and cohesive across songs, with the tree and character zone staying visually connected.",
            "updatedAt": "2026-04-09T00:00:00Z"
        ])

        let saved = try service.saveProject(project)
        let reopened = try service.openProject(filePath: saved.projectFilePath)
        let brief = reopened.snapshot["projectBrief"]?.value as? [String: Any]

        #expect(brief?["document"] as? String == "Warm neighborhood show with a strong central focal area that feels welcoming and cohesive across songs, with the tree and character zone staying visually connected.")
    }

    @Test func saveProjectPreservesProjectIdentityWhenShowFolderChanges() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        var project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: "/tmp/show",
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        let originalID = project.id
        let originalFilePath = project.projectFilePath

        project.showFolder = "/tmp/new-show"

        let saved = try service.saveProject(project)
        let reopened = try service.openProject(filePath: originalFilePath)

        #expect(saved.id == originalID)
        #expect(reopened.id == originalID)
        #expect(saved.projectFilePath == originalFilePath)
        #expect(reopened.showFolder == "/tmp/new-show")
    }

    @MainActor
    @Test func projectScreenRelinksShowFolderWithoutChangingProjectIdentity() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        let showRoot = FileManager.default.temporaryDirectory.appendingPathComponent("xld-project-relink-show-\(UUID().uuidString)", isDirectory: true)
        let oldShowFolder = showRoot.appendingPathComponent("OldShow", isDirectory: true)
        let newShowFolder = showRoot.appendingPathComponent("NewShow", isDirectory: true)
        let oldSequencePath = oldShowFolder.appendingPathComponent("OldSong/OldSong.xsq")
        let newSequencePath = newShowFolder.appendingPathComponent("OldSong/OldSong.xsq")
        let oldAudioPath = oldShowFolder.appendingPathComponent("Audio/OldSong.mp3")
        let newAudioPath = newShowFolder.appendingPathComponent("Audio/OldSong.mp3")
        try FileManager.default.createDirectory(at: oldSequencePath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: newSequencePath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: oldAudioPath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: newAudioPath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("<sequence/>".utf8).write(to: oldSequencePath)
        try Data("<sequence/>".utf8).write(to: newSequencePath)
        try Data("audio".utf8).write(to: oldAudioPath)
        try Data("audio".utf8).write(to: newAudioPath)
        let project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: oldShowFolder.path,
                mediaPath: oldAudioPath.deletingLastPathComponent().path,
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        let workspace = ProjectWorkspace(sessionStore: ProjectServiceTestSessionStore())
        var projectWithSequenceState = project
        try LocalProjectSequenceStore().upsertActiveSequence(
            project: &projectWithSequenceState,
            sequencePath: oldSequencePath.path,
            audioPath: oldAudioPath.path
        )
        projectWithSequenceState.snapshot["sequencePathInput"] = AnyCodable(oldSequencePath.path)
        projectWithSequenceState.snapshot["recentSequences"] = AnyCodable([oldSequencePath.path])
        projectWithSequenceState.snapshot["audioPathInput"] = AnyCodable(oldAudioPath.path)
        projectWithSequenceState.snapshot["sequenceMediaFile"] = AnyCodable(oldAudioPath.path)
        projectWithSequenceState.snapshot["proposed"] = AnyCodable([
            ["summary": "Existing proposal row"]
        ])
        projectWithSequenceState.snapshot["flags"] = AnyCodable([
            "proposalStale": false,
            "hasDraftProposal": true
        ])
        projectWithSequenceState.snapshot["sequenceAgentRuntime"] = AnyCodable([
            "timingTrackProvenance": [
                "track-1": ["trackName": "XD: Song Structure"]
            ]
        ])
        workspace.setProject(projectWithSequenceState)
        let model = ProjectScreenViewModel(
            workspace: workspace,
            projectService: service,
            fileSelectionService: ProjectServiceTestFileSelectionService(folderPath: newShowFolder.path),
            sessionStore: ProjectServiceTestSessionStore()
        )
        let relinkNotificationCapture = ProjectRelinkNotificationCapture()
        let observer = NotificationCenter.default.addObserver(
            forName: .projectShowFolderDidRelink,
            object: nil,
            queue: nil
        ) { notification in
            relinkNotificationCapture.object = notification.object as? String
        }
        defer {
            NotificationCenter.default.removeObserver(observer)
        }

        model.chooseShowFolderForActiveProject()

        let active = try #require(workspace.activeProject)
        let relink = active.snapshot["showFolderRelink"]?.value as? [String: Any]
        let flags = active.snapshot["flags"]?.value as? [String: Any]
        let runtime = active.snapshot["sequenceAgentRuntime"]?.value as? [String: Any]
        let displayRelink = runtime?["displayRelink"] as? [String: Any]
        let timingTrackProvenance = runtime?["timingTrackProvenance"] as? [String: Any]
        let recentSequences = active.snapshot["recentSequences"]?.value as? [String]
        let projectSequences = active.snapshot["projectSequences"]?.value as? [[String: Any]]
        let activeSequenceID = try #require(projectSequences?.first?["sequenceId"] as? String)
        let sequenceRecordURL = URL(fileURLWithPath: active.projectFilePath)
            .deletingLastPathComponent()
            .appendingPathComponent("sequences/\(activeSequenceID)/sequence.json")
        let sequenceRecord = try JSONDecoder().decode(ProjectSequenceDocument.self, from: Data(contentsOf: sequenceRecordURL))
        #expect(active.id == project.id)
        #expect(active.projectFilePath == project.projectFilePath)
        #expect(active.showFolder == newShowFolder.path)
        #expect(active.mediaPath == newAudioPath.deletingLastPathComponent().path)
        #expect(active.snapshot["mediaPath"]?.value as? String == newAudioPath.deletingLastPathComponent().path)
        #expect(active.snapshot["audioPathInput"]?.value as? String == newAudioPath.path)
        #expect(active.snapshot["sequenceMediaFile"]?.value as? String == newAudioPath.path)
        #expect(active.snapshot["sequencePathInput"]?.value as? String == newSequencePath.path)
        #expect(recentSequences == [newSequencePath.path])
        #expect(projectSequences?.first?["sequencePath"] as? String == newSequencePath.path)
        #expect(projectSequences?.first?["availabilityStatus"] as? String == "available")
        #expect(sequenceRecord.sequenceId == activeSequenceID)
        #expect(sequenceRecord.sequencePath == newSequencePath.path)
        #expect(sequenceRecord.showFolderAtLastUse == newShowFolder.path)
        #expect(sequenceRecord.mediaPath == newAudioPath.path)
        #expect(sequenceRecord.availabilityStatus == "available")
        #expect(sequenceRecord.priorSequencePaths == [oldSequencePath.path])
        #expect((active.snapshot["proposed"]?.value as? [[String: Any]])?.count == 1)
        #expect(relink?["previousShowFolder"] as? String == oldShowFolder.path)
        #expect(relink?["showFolder"] as? String == newShowFolder.path)
        #expect(flags?["proposalStale"] as? Bool == true)
        #expect(flags?["hasDraftProposal"] as? Bool == true)
        #expect(displayRelink?["previousShowFolder"] as? String == oldShowFolder.path)
        #expect(displayRelink?["showFolder"] as? String == newShowFolder.path)
        #expect((timingTrackProvenance?["track-1"] as? [String: Any])?["trackName"] as? String == "XD: Song Structure")
        #expect(relinkNotificationCapture.object == active.projectFilePath)
        #expect(workspace.projectBanner?.id == "show-folder-relinked")
    }

    @MainActor
    @Test func projectScreenRelinkClearsOldShowAudioWhenNoCounterpartExists() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        let showRoot = FileManager.default.temporaryDirectory.appendingPathComponent("xld-project-relink-audio-\(UUID().uuidString)", isDirectory: true)
        let oldShowFolder = showRoot.appendingPathComponent("OldShow", isDirectory: true)
        let newShowFolder = showRoot.appendingPathComponent("NewShow", isDirectory: true)
        let oldAudioPath = oldShowFolder.appendingPathComponent("Audio/MissingInNewShow.mp3")
        try FileManager.default.createDirectory(at: oldAudioPath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: newShowFolder, withIntermediateDirectories: true)
        try Data("audio".utf8).write(to: oldAudioPath)
        let project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: oldShowFolder.path,
                mediaPath: oldAudioPath.deletingLastPathComponent().path,
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        var projectWithAudio = project
        projectWithAudio.snapshot["audioPathInput"] = AnyCodable(oldAudioPath.path)
        projectWithAudio.snapshot["sequenceMediaFile"] = AnyCodable(oldAudioPath.path)
        let workspace = ProjectWorkspace(sessionStore: ProjectServiceTestSessionStore())
        workspace.setProject(projectWithAudio)
        let model = ProjectScreenViewModel(
            workspace: workspace,
            projectService: service,
            fileSelectionService: ProjectServiceTestFileSelectionService(folderPath: newShowFolder.path),
            sessionStore: ProjectServiceTestSessionStore()
        )

        model.chooseShowFolderForActiveProject()

        let active = try #require(workspace.activeProject)
        #expect(active.showFolder == newShowFolder.path)
        #expect(active.mediaPath == "")
        #expect(active.snapshot["mediaPath"]?.value as? String == "")
        #expect(active.snapshot["audioPathInput"]?.value as? String == "")
        #expect(active.snapshot["sequenceMediaFile"]?.value as? String == "")
    }

    @MainActor
    @Test func projectScreenRelinkMarksMissingSequenceRecordUnavailable() throws {
        let service = try makeService()
        let name = "App Test Project \(UUID().uuidString.prefix(6))"
        let showRoot = FileManager.default.temporaryDirectory.appendingPathComponent("xld-project-relink-sequence-\(UUID().uuidString)", isDirectory: true)
        let oldShowFolder = showRoot.appendingPathComponent("OldShow", isDirectory: true)
        let newShowFolder = showRoot.appendingPathComponent("NewShow", isDirectory: true)
        let oldSequencePath = oldShowFolder.appendingPathComponent("MissingInNewShow/MissingInNewShow.xsq")
        try FileManager.default.createDirectory(at: oldSequencePath.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: newShowFolder, withIntermediateDirectories: true)
        try Data("<sequence/>".utf8).write(to: oldSequencePath)
        var project = try service.createProject(
            draft: ProjectDraftModel(
                projectName: name,
                showFolder: oldShowFolder.path,
                mediaPath: "",
                migrateMetadata: false,
                migrationSourceProjectPath: ""
            )
        )
        try LocalProjectSequenceStore().upsertActiveSequence(project: &project, sequencePath: oldSequencePath.path, audioPath: nil)
        project.snapshot["sequencePathInput"] = AnyCodable(oldSequencePath.path)
        let workspace = ProjectWorkspace(sessionStore: ProjectServiceTestSessionStore())
        workspace.setProject(project)
        let model = ProjectScreenViewModel(
            workspace: workspace,
            projectService: service,
            fileSelectionService: ProjectServiceTestFileSelectionService(folderPath: newShowFolder.path),
            sessionStore: ProjectServiceTestSessionStore()
        )

        model.chooseShowFolderForActiveProject()

        let active = try #require(workspace.activeProject)
        let rows = try #require(active.snapshot["projectSequences"]?.value as? [[String: Any]])
        let row = try #require(rows.first)
        let sequenceID = try #require(row["sequenceId"] as? String)
        let sequenceRecordURL = URL(fileURLWithPath: active.projectFilePath)
            .deletingLastPathComponent()
            .appendingPathComponent("sequences/\(sequenceID)/sequence.json")
        let sequenceRecord = try JSONDecoder().decode(ProjectSequenceDocument.self, from: Data(contentsOf: sequenceRecordURL))

        #expect(active.showFolder == newShowFolder.path)
        #expect(active.snapshot["sequencePathInput"]?.value as? String == oldSequencePath.path)
        #expect(row["sequencePath"] as? String == oldSequencePath.path)
        #expect(row["availabilityStatus"] as? String == "unavailable")
        #expect(row["isActive"] as? Bool == true)
        #expect(sequenceRecord.sequencePath == oldSequencePath.path)
        #expect(sequenceRecord.showFolderAtLastUse == newShowFolder.path)
        #expect(sequenceRecord.availabilityStatus == "unavailable")
        #expect(model.screenModel.hints.contains { $0.id == "sequence-unavailable" && $0.text.contains("was not found in the linked show folder") })
    }

    private func makeService() throws -> LocalProjectService {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("xld-project-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        return LocalProjectService(projectsRootPath: root.path)
    }
}

private struct ProjectServiceTestSessionStore: ProjectSessionStore {
    func loadLastProjectPath() -> String? { nil }
    func saveLastProjectPath(_ path: String?) {}
}

@MainActor
private struct ProjectServiceTestFileSelectionService: FileSelectionService {
    let folderPath: String?

    func chooseAudioFile() -> String? { nil }
    func chooseFolder(prompt: String) -> String? { folderPath }
    func chooseProjectFolder() -> String? { nil }
}
