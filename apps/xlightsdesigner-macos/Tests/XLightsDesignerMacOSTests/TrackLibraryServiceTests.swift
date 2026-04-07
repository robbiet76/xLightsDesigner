import Foundation
import Testing
@testable import XLightsDesignerMacOS

@Test func localTrackLibraryServiceMapsStoredTrackRecord() throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
    let libraryDir = root.appendingPathComponent("library/tracks", isDirectory: true)
    try FileManager.default.createDirectory(at: libraryDir, withIntermediateDirectories: true)

    let payload = """
    {
      "track": {
        "title": "Carol Of The Bells",
        "artist": "",
        "displayName": "Carol Of The Bells",
        "identity": {
          "contentFingerprint": "abc123"
        },
        "verification": {
          "status": "unverified",
          "titlePresent": true,
          "artistPresent": false
        },
        "naming": {
          "recommendedFileName": "Carol Of The Bells.mp3",
          "shouldRename": true,
          "shouldRetag": false
        },
        "sourceMedia": {
          "path": "/tmp/carol.mp3"
        }
      },
      "analysis": {
        "availableProfiles": ["deep"]
      },
      "timingTracks": [
        { "name": "XD: Song Structure" },
        { "name": "XD: Beats" },
        { "name": "XD: Bars" }
      ]
    }
    """.data(using: .utf8)!

    let fileURL = libraryDir.appendingPathComponent("carol-of-the-bells.json")
    try payload.write(to: fileURL)

    let service = LocalTrackLibraryService(libraryDirectory: libraryDir)
    let rows = try service.loadLibraryRows()

    #expect(rows.count == 1)
    #expect(rows[0].id == "abc123")
    #expect(rows[0].status == .needsReview)
    #expect(rows[0].actionSummaryText == "Verify track info")
    #expect(rows[0].availableTimingsSummary == "Song Structure, Beats, Bars")
  }
