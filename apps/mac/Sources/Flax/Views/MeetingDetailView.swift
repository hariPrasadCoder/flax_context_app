import SwiftUI

struct MeetingDetailView: View {
    let meeting: Meeting
    @EnvironmentObject var appState: AppState

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    Divider()
                        .background(FlaxTheme.border)
                    transcriptSection(proxy: proxy)
                    Spacer(minLength: 40)
                }
                .padding(40)
                .id("top")
            }
        }
        .background(FlaxTheme.white)
        .navigationTitle(meeting.title)
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(meeting.title)
                .font(.system(.title2, design: .serif).bold())
                .foregroundStyle(FlaxTheme.textPrimary)

            HStack(spacing: 16) {
                Label(meeting.startTimeString, systemImage: "clock")

                if meeting.isOngoing {
                    Label("Ongoing", systemImage: "mic.fill")
                        .foregroundStyle(FlaxTheme.amber)
                } else {
                    Label(meeting.formattedDuration, systemImage: "timer")
                }

                Label(meeting.source.label, systemImage: sourceIcon)
            }
            .font(.flaxMonoXs)
            .foregroundStyle(FlaxTheme.textFaint)
        }
    }

    // MARK: - Transcript

    private func transcriptSection(proxy: ScrollViewProxy) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Transcript")
                    .font(.flaxMonoXs)
                    .foregroundStyle(FlaxTheme.textFaint)
                    .textCase(.uppercase)
                    .tracking(1)

                if meeting.isOngoing {
                    Spacer()
                    // Live recording indicator
                    HStack(spacing: 5) {
                        Circle()
                            .fill(FlaxTheme.amber)
                            .frame(width: 5, height: 5)
                        Text("Live")
                            .font(.flaxMonoXs)
                            .foregroundStyle(FlaxTheme.amber)
                    }
                }
            }

            if meeting.transcript.isEmpty {
                Group {
                    if meeting.isOngoing {
                        if appState.modelStatus != .ready {
                            HStack(spacing: 6) {
                                ProgressView().scaleEffect(0.6)
                                Text(appState.modelStatus.label)
                            }
                            .font(.flaxMonoSm)
                            .foregroundStyle(FlaxTheme.textFaint)
                        } else {
                            Text("Listening...")
                                .font(.flaxMonoSm)
                                .foregroundStyle(FlaxTheme.textFaint)
                                .italic()
                        }
                    } else {
                        Text("No transcript recorded.")
                            .font(.flaxMonoSm)
                            .foregroundStyle(FlaxTheme.textFaint)
                            .italic()
                    }
                }
            } else {
                Text(meeting.transcript)
                    .font(.flaxMonoSm)
                    .foregroundStyle(FlaxTheme.textPrimary)
                    .textSelection(.enabled)
                    .lineSpacing(6)
                    .id("transcript-end")
            }
        }
    }

    // MARK: - Proposed changes (Phase 2 stub)

    private var proposedChangesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Proposed document changes")
                .font(.flaxMonoXs)
                .foregroundStyle(FlaxTheme.textFaint)
                .textCase(.uppercase)
                .tracking(1)

            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .foregroundStyle(FlaxTheme.textFaint)
                Text("AI-proposed changes will appear here in Phase 2, after the meeting ends.")
                    .font(.flaxMonoSm)
                    .foregroundStyle(FlaxTheme.textFaint)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(FlaxTheme.beige)
            .cornerRadius(FlaxTheme.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: FlaxTheme.radiusMd)
                    .stroke(FlaxTheme.border, lineWidth: 1)
            )
        }
    }

    private var sourceIcon: String {
        switch meeting.source {
        case .calendar:      return "calendar"
        case .audioDetected: return "waveform"
        case .manual:        return "mic"
        }
    }
}
