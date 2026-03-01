import SwiftUI

/// Shown in the menubar popover when a meeting is detected (audio threshold or calendar).
/// Also shown for manual "Record" trigger — user types title and confirms.
struct RecordingConfirmationView: View {
    @EnvironmentObject var appState: AppState
    @State private var titleInput: String = ""
    @FocusState private var titleFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            detectionHeader
            titleField
            actionButtons
        }
        .padding(16)
        .background(FlaxTheme.white)
        .overlay(
            Rectangle()
                .stroke(FlaxTheme.border, lineWidth: 1)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
        )
        .padding(.vertical, 8)
        .onAppear {
            titleInput = appState.pendingTitle ?? ""
            titleFocused = true
        }
    }

    // MARK: - Header

    private var detectionHeader: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(FlaxTheme.amber)
                .frame(width: 7, height: 7)

            Text(appState.pendingTitle != nil ? "Meeting starting" : "Start recording?")
                .font(.flaxSerifSm.bold())
                .foregroundStyle(FlaxTheme.textPrimary)

            Spacer()

            if let source = detectionSource {
                Text(source)
                    .font(.flaxMonoXs)
                    .foregroundStyle(FlaxTheme.textFaint)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(FlaxTheme.beige)
                    .cornerRadius(FlaxTheme.radiusSm)
            }
        }
    }

    private var detectionSource: String? {
        guard appState.pendingTitle != nil else { return nil }
        return "Calendar"
    }

    // MARK: - Title field

    private var titleField: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Meeting title")
                .font(.flaxMonoXs)
                .foregroundStyle(FlaxTheme.textMuted)

            TextField("e.g. Weekly standup", text: $titleInput)
                .font(.flaxMonoSm)
                .textFieldStyle(.plain)
                .focused($titleFocused)
                .padding(.horizontal, 8)
                .padding(.vertical, 6)
                .background(FlaxTheme.cream)
                .cornerRadius(FlaxTheme.radiusMd)
                .overlay(
                    RoundedRectangle(cornerRadius: FlaxTheme.radiusMd)
                        .stroke(FlaxTheme.border, lineWidth: 1)
                )
                .onSubmit { confirmRecording() }
        }
    }

    // MARK: - Buttons

    private var actionButtons: some View {
        HStack(spacing: 8) {
            Button("Not Now") {
                appState.dismissConfirmation()
            }
            .buttonStyle(FlaxButtonStyle())
            .foregroundStyle(FlaxTheme.textMuted)

            Spacer()

            Button {
                confirmRecording()
            } label: {
                HStack(spacing: 6) {
                    Circle()
                        .fill(FlaxTheme.amber)
                        .frame(width: 6, height: 6)
                    Text("Start Recording")
                        .font(.flaxMonoSm.bold())
                }
            }
            .buttonStyle(FlaxButtonStyle())
            .disabled(appState.modelStatus != .ready)
        }
    }

    // MARK: - Action

    private func confirmRecording() {
        let title = titleInput.trimmingCharacters(in: .whitespacesAndNewlines)
        let source: Meeting.RecordingSource = appState.pendingTitle != nil ? .calendar : .manual
        appState.startMeeting(
            title: title.isEmpty ? (appState.pendingTitle ?? "Meeting") : title,
            source: source
        )
    }
}
