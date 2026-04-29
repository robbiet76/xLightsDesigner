import Foundation

@MainActor
func xldWaitUntil(timeout: TimeInterval = 1.0, _ condition: () -> Bool) async throws {
    let deadline = Date().addingTimeInterval(timeout)
    while !condition(), Date() < deadline {
        try await Task.sleep(for: .milliseconds(10))
    }
}
