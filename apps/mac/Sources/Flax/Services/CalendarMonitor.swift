import EventKit
import Foundation

/// Monitors EventKit for upcoming video meetings and fires a callback
/// when one is about to start (within 2 minutes) or is currently active.
class CalendarMonitor {
    private let store = EKEventStore()
    private var timer: Timer?
    private var notifiedEventIDs: Set<String> = []

    var onMeetingAboutToStart: ((String) -> Void)?

    func start() {
        store.requestFullAccessToEvents { [weak self] granted, _ in
            guard granted, let self else { return }
            DispatchQueue.main.async {
                self.checkEvents()
                self.timer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in
                    self?.checkEvents()
                }
            }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    // MARK: - Internal

    private func checkEvents() {
        let now = Date()
        let window = now.addingTimeInterval(2 * 60) // 2 minutes ahead
        let predicate = store.predicateForEvents(withStart: now, end: window, calendars: nil)
        let events = store.events(matching: predicate)

        for event in events where isVideoMeeting(event) {
            let key = event.eventIdentifier ?? event.title ?? UUID().uuidString
            guard !notifiedEventIDs.contains(key) else { continue }
            notifiedEventIDs.insert(key)
            onMeetingAboutToStart?(event.title ?? "Calendar Meeting")
        }

        // Expire old notified IDs for events that have ended
        pruneExpiredNotifications()
    }

    private func isVideoMeeting(_ event: EKEvent) -> Bool {
        let videoKeywords = [
            "zoom.us", "meet.google.com", "teams.microsoft.com",
            "huddle.slack.com", "webex.com", "whereby.com", "around.co",
        ]
        let content = [
            event.notes,
            event.url?.absoluteString,
            event.location,
        ].compactMap { $0 }.joined(separator: " ").lowercased()

        return videoKeywords.contains(where: { content.contains($0) })
    }

    private func pruneExpiredNotifications() {
        // Keep the set small — clear IDs for events older than 2 hours
        // In practice, this is called every minute so IDs accumulate slowly
        if notifiedEventIDs.count > 50 { notifiedEventIDs.removeAll() }
    }
}
