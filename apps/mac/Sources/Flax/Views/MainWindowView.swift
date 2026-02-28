import SwiftUI

struct MainWindowView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        NavigationSplitView {
            SidebarView()
        } detail: {
            if let meeting = appState.selectedMeeting {
                MeetingDetailView(meeting: meeting)
            } else {
                emptyDetail
            }
        }
        .navigationSplitViewStyle(.balanced)
        .frame(minWidth: 780, minHeight: 520)
        .toolbar { toolbarContent }
        .toolbarBackground(FlaxTheme.cream, for: .windowToolbar)
        .toolbarBackground(.visible, for: .windowToolbar)
    }

    // MARK: - Empty state

    private var emptyDetail: some View {
        VStack(spacing: 16) {
            Image(systemName: "waveform.and.mic")
                .font(.system(size: 44))
                .foregroundStyle(FlaxTheme.border)

            Text("No meeting selected")
                .font(.flaxSerifSm)
                .foregroundStyle(FlaxTheme.textMuted)

            Text("Start recording or select a past meeting from the sidebar.")
                .font(.flaxMonoSm)
                .foregroundStyle(FlaxTheme.textFaint)
                .multilineTextAlignment(.center)

            if appState.modelStatus != .ready {
                modelStatusBadge
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(FlaxTheme.white)
    }

    private var modelStatusBadge: some View {
        HStack(spacing: 8) {
            switch appState.modelStatus {
            case .downloading(let p):
                ProgressView(value: p)
                    .frame(width: 60)
                Text("Downloading Whisper model \(Int(p * 100))%")
            case .loading:
                ProgressView().scaleEffect(0.7)
                Text("Loading model...")
            case .failed(let e):
                Image(systemName: "exclamationmark.triangle")
                    .foregroundStyle(FlaxTheme.error)
                Text(e)
                Button("Retry") { Task { await appState.retryModelLoad() } }
                    .buttonStyle(FlaxButtonStyle())
            default:
                EmptyView()
            }
        }
        .font(.flaxMonoXs)
        .foregroundStyle(FlaxTheme.textMuted)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(FlaxTheme.beige)
        .cornerRadius(FlaxTheme.radiusMd)
        .overlay(RoundedRectangle(cornerRadius: FlaxTheme.radiusMd).stroke(FlaxTheme.border))
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        if appState.recordingState == .recording || appState.recordingState == .finishing {
            // Show meeting title + stop button as separate items so macOS
            // can fully replace them when state changes (single ToolbarItem
            // with dynamic content is unreliable on macOS).
            ToolbarItem(placement: .status) {
                HStack(spacing: 6) {
                    PulsingDot(color: FlaxTheme.amber)
                    Text(appState.currentMeeting?.title ?? "Recording")
                        .font(.flaxMonoSm)
                        .foregroundStyle(FlaxTheme.textPrimary)
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button("Stop") {
                    appState.stopMeeting()
                }
                .foregroundStyle(FlaxTheme.error)
                .font(.flaxMonoSm.bold())
            }
        } else if appState.recordingState == .awaitingConfirmation {
            ToolbarItem(placement: .status) {
                HStack(spacing: 6) {
                    Circle().fill(FlaxTheme.amber).frame(width: 6, height: 6)
                    Text(appState.pendingTitle.map { "Meeting: \($0)" } ?? "Meeting detected")
                        .font(.flaxMonoSm)
                        .foregroundStyle(FlaxTheme.textMuted)
                }
            }
            ToolbarItem(placement: .primaryAction) {
                Button("Record Now") {
                    appState.startMeeting(
                        title: appState.pendingTitle ?? "Meeting",
                        source: appState.pendingTitle != nil ? .calendar : .audioDetected
                    )
                }
                .buttonStyle(FlaxButtonStyle())
            }
            ToolbarItem(placement: .primaryAction) {
                Button("Dismiss") { appState.dismissConfirmation() }
                    .foregroundStyle(FlaxTheme.textFaint)
                    .font(.flaxMonoSm)
            }
        } else {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    appState.startMeeting(title: "Meeting", source: .manual)
                } label: {
                    Label("Record", systemImage: "mic")
                        .font(.flaxMonoSm)
                }
                .buttonStyle(FlaxButtonStyle())
            }
        }
    }
}
