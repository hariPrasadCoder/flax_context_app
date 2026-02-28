import SwiftUI

struct MeetingRowView: View {
    let meeting: Meeting
    @EnvironmentObject var appState: AppState
    @State private var isHovered = false
    @State private var showTranscript = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            rowContent
            if showTranscript && !meeting.transcript.isEmpty {
                transcriptExpanded
            }
        }
        .background(isHovered ? FlaxTheme.beige : Color.clear)
        .onHover { isHovered = $0 }
        .onTapGesture { withAnimation(.easeOut(duration: 0.15)) { showTranscript.toggle() } }
        .contextMenu { contextMenuItems }
    }

    // MARK: - Row

    private var rowContent: some View {
        HStack(alignment: .center, spacing: 10) {
            // Source indicator
            sourceIcon

            VStack(alignment: .leading, spacing: 2) {
                Text(meeting.title)
                    .font(.flaxMonoSm.bold())
                    .foregroundStyle(FlaxTheme.textPrimary)
                    .lineLimit(1)

                HStack(spacing: 6) {
                    Text(meeting.relativeTime)
                        .font(.flaxMonoXs)
                        .foregroundStyle(FlaxTheme.textFaint)

                    Text("·")
                        .foregroundStyle(FlaxTheme.textFaint)

                    Text(meeting.formattedDuration)
                        .font(.flaxMonoXs)
                        .foregroundStyle(FlaxTheme.textFaint)
                }
            }

            Spacer()

            if !meeting.transcript.isEmpty {
                Image(systemName: showTranscript ? "chevron.up" : "chevron.down")
                    .font(.system(size: 10))
                    .foregroundStyle(FlaxTheme.textFaint)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private var sourceIcon: some View {
        switch meeting.source {
        case .calendar:
            Image(systemName: "calendar")
                .font(.system(size: 11))
                .foregroundStyle(FlaxTheme.textFaint)
                .frame(width: 16)
        case .audioDetected:
            Image(systemName: "waveform")
                .font(.system(size: 11))
                .foregroundStyle(FlaxTheme.textFaint)
                .frame(width: 16)
        case .manual:
            Image(systemName: "mic")
                .font(.system(size: 11))
                .foregroundStyle(FlaxTheme.textFaint)
                .frame(width: 16)
        }
    }

    // MARK: - Expanded transcript

    private var transcriptExpanded: some View {
        Text(meeting.transcript)
            .font(.flaxMonoXs)
            .foregroundStyle(FlaxTheme.textMuted)
            .lineLimit(6)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 14)
            .padding(.bottom, 10)
    }

    // MARK: - Context menu

    @ViewBuilder
    private var contextMenuItems: some View {
        Button("Copy Transcript") {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(meeting.transcript, forType: .string)
        }
        .disabled(meeting.transcript.isEmpty)

        Divider()

        Button("Delete", role: .destructive) {
            appState.deleteMeeting(meeting)
        }
    }
}
