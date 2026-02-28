import SwiftUI

/// Shown in the menubar popover while a meeting is being recorded.
struct RecordingStatusView: View {
    @EnvironmentObject var appState: AppState
    @State private var elapsed: TimeInterval = 0
    @State private var timer: Timer?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            recordingHeader
            liveTranscriptSection
            stopButton
        }
        .padding(16)
        .onAppear { startTimer() }
        .onDisappear { timer?.invalidate() }
    }

    // MARK: - Header

    private var recordingHeader: some View {
        HStack(spacing: 10) {
            PulsingDot(color: FlaxTheme.amber)

            VStack(alignment: .leading, spacing: 2) {
                Text(appState.currentMeeting?.title ?? "Recording")
                    .font(.flaxSerifSm.bold())
                    .foregroundStyle(FlaxTheme.textPrimary)
                    .lineLimit(1)

                Text(formatElapsed(elapsed))
                    .font(.flaxMonoXs)
                    .foregroundStyle(FlaxTheme.textMuted)
            }

            Spacer()

            // Audio level indicator
            AudioLevelBar(level: appState.currentAudioLevel)
        }
    }

    // MARK: - Live transcript

    private var liveTranscriptSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Live transcript")
                    .font(.flaxMonoXs)
                    .foregroundStyle(FlaxTheme.textFaint)
                Spacer()
            }

            ScrollView {
                Text(appState.liveTranscript.isEmpty
                     ? "Listening..."
                     : appState.liveTranscript)
                    .font(.flaxMonoSm)
                    .foregroundStyle(appState.liveTranscript.isEmpty
                                     ? FlaxTheme.textFaint
                                     : FlaxTheme.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 80)
            .padding(8)
            .background(FlaxTheme.cream)
            .cornerRadius(FlaxTheme.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: FlaxTheme.radiusMd)
                    .stroke(FlaxTheme.border, lineWidth: 1)
            )
        }
    }

    // MARK: - Stop button

    private var stopButton: some View {
        HStack {
            Spacer()
            Button {
                appState.stopMeeting()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 10))
                    Text("Stop Meeting")
                        .font(.flaxMonoSm.bold())
                }
            }
            .buttonStyle(FlaxButtonStyle())
            .foregroundStyle(FlaxTheme.error)
        }
    }

    // MARK: - Timer

    private func startTimer() {
        guard let start = appState.currentMeeting?.startedAt else { return }
        elapsed = Date().timeIntervalSince(start)
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            elapsed = Date().timeIntervalSince(start)
        }
    }

    private func formatElapsed(_ t: TimeInterval) -> String {
        let mins = Int(t) / 60
        let secs = Int(t) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}

// MARK: - Shared UI Components

struct PulsingDot: View {
    let color: Color
    @State private var pulsing = false

    var body: some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.25))
                .frame(width: 20, height: 20)
                .scaleEffect(pulsing ? 1.4 : 1.0)
                .opacity(pulsing ? 0.0 : 0.6)
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 1.2).repeatForever(autoreverses: false)) {
                pulsing = true
            }
        }
    }
}

struct AudioLevelBar: View {
    let level: Float

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<5, id: \.self) { i in
                RoundedRectangle(cornerRadius: 1)
                    .fill(level > Float(i) / 5 ? FlaxTheme.amber : FlaxTheme.border)
                    .frame(width: 3, height: CGFloat(8 + i * 3))
            }
        }
        .animation(.easeOut(duration: 0.1), value: level)
    }
}
