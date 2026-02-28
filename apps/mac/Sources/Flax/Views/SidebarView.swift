import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 0) {
            // Brand header
            HStack {
                Text("Flax")
                    .font(.flaxSerif)
                    .foregroundStyle(FlaxTheme.textPrimary)
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)

            Divider()
                .background(FlaxTheme.border)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Live recording — shown at the top while active
                    if let current = appState.currentMeeting {
                        sectionLabel("Now")
                        meetingRow(current, isLive: true)
                        Divider()
                            .background(FlaxTheme.border)
                            .padding(.vertical, 4)
                    }

                    // Past meetings
                    if !appState.meetings.isEmpty {
                        sectionLabel("Meetings")
                        ForEach(appState.meetings) { meeting in
                            meetingRow(meeting, isLive: false)
                        }
                    }

                    if appState.currentMeeting == nil && appState.meetings.isEmpty {
                        Text("No meetings yet")
                            .font(.flaxMonoSm)
                            .foregroundStyle(FlaxTheme.textFaint)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 16)
                    }
                }
            }
        }
        .background(FlaxTheme.cream)
        .frame(minWidth: 200, idealWidth: 220)
    }

    // MARK: - Section header

    private func sectionLabel(_ title: String) -> some View {
        Text(title)
            .font(.flaxMonoXs)
            .foregroundStyle(FlaxTheme.textFaint)
            .textCase(.uppercase)
            .tracking(1.5)
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 2)
    }

    // MARK: - Row

    private func meetingRow(_ meeting: Meeting, isLive: Bool) -> some View {
        let isSelected = appState.selectedMeeting?.id == meeting.id

        return Button {
            appState.selectedMeeting = meeting
        } label: {
            HStack(spacing: 0) {
                // Amber selection bar
                Rectangle()
                    .fill(isSelected ? FlaxTheme.amber : Color.clear)
                    .frame(width: 2)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 5) {
                        if isLive {
                            Circle()
                                .fill(FlaxTheme.amber)
                                .frame(width: 5, height: 5)
                        }
                        Text(meeting.title)
                            .font(.flaxMonoSm.bold())
                            .foregroundStyle(FlaxTheme.textPrimary)
                            .lineLimit(1)
                    }

                    HStack(spacing: 4) {
                        Text(isLive ? meeting.startTimeString : meeting.relativeTime)
                        if !isLive && meeting.endedAt != nil {
                            Text("·")
                            Text(meeting.formattedDuration)
                        }
                    }
                    .font(.flaxMonoXs)
                    .foregroundStyle(FlaxTheme.textFaint)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 9)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .background(isSelected ? FlaxTheme.beige : Color.clear)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
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
}
