import Foundation

struct Meeting: Codable, Identifiable, Equatable, Hashable {
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    var id: UUID = UUID()
    var title: String
    var source: RecordingSource
    var startedAt: Date
    var endedAt: Date?
    var transcript: String = ""
    /// Linked Flax document ID — populated in Phase 2 when user selects a doc for sync
    var docId: String?

    enum RecordingSource: String, Codable {
        case manual        = "manual"
        case audioDetected = "audioDetected"
        case calendar      = "calendar"

        var label: String {
            switch self {
            case .manual:        return "Manual"
            case .audioDetected: return "Auto-detected"
            case .calendar:      return "Calendar"
            }
        }
    }

    var isOngoing: Bool { endedAt == nil }

    var duration: TimeInterval? {
        guard let end = endedAt else { return nil }
        return end.timeIntervalSince(startedAt)
    }

    var formattedDuration: String {
        guard let d = duration else { return "Ongoing" }
        let mins = Int(d) / 60
        return mins < 1 ? "< 1 min" : "\(mins) min"
    }

    var relativeTime: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: startedAt, relativeTo: Date())
    }

    var startTimeString: String {
        let f = DateFormatter()
        f.dateStyle = .none
        f.timeStyle = .short
        return f.string(from: startedAt)
    }
}
