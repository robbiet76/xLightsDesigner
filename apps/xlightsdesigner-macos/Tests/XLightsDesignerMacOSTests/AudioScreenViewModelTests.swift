import Testing
@testable import XLightsDesignerMacOS

@Test func sampleAudioViewModelStartsWithNeedsReviewSelection() {
    let model = AudioScreenViewModel.sample()

    #expect(model.selectedRowID == "carol-bells")
    guard case let .track(track) = model.currentResult else {
        Issue.record("Expected selected track result")
        return
    }

    #expect(track.displayName == "Carol Of The Bells")
    #expect(track.canConfirmIdentity)
}

@Test func confirmingIdentityUpdatesSelectedRowAndResult() {
    let model = AudioScreenViewModel.sample()

    model.updateDraftTitle("Carol Of The Bells")
    model.updateDraftArtist("Trans-Siberian Orchestra")
    model.confirmTrackInfo()

    guard case let .track(track) = model.currentResult else {
        Issue.record("Expected selected track result")
        return
    }

    #expect(track.identityState == .verified)
    #expect(track.status == .complete)
    #expect(track.canConfirmIdentity == false)
    #expect(model.filteredRows.first(where: { $0.id == "carol-bells" })?.artist == "Trans-Siberian Orchestra")
}
