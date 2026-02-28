import SwiftUI

struct MenuBarView: View {
    @EnvironmentObject var appState: AppState
    @State private var showSettings = false

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider().foregroundStyle(FlaxTheme.border)

            // State-driven content
            Group {
                switch appState.recordingState {
                case .awaitingConfirmation:
                    RecordingConfirmationView()
                case .recording, .finishing:
                    RecordingStatusView()
                case .idle:
                    idleContent
                }
            }

            Divider().foregroundStyle(FlaxTheme.border)
            footer
        }
        .frame(width: 340)
        .background(FlaxTheme.cream)
        .sheet(isPresented: $showSettings) {
            SettingsView()
                .environmentObject(appState)
        }
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .center, spacing: 10) {
            Text("Flax")
                .font(.flaxSerif)
                .foregroundStyle(FlaxTheme.textPrimary)

            Spacer()

            modelBadge
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    @ViewBuilder
    private var modelBadge: some View {
        switch appState.modelStatus {
        case .ready:
            Text("Large v3")
                .font(.flaxMonoXs)
                .foregroundStyle(FlaxTheme.textMuted)
                .padding(.horizontal, 6)
                .padding(.vertical, 3)
                .background(FlaxTheme.beige)
                .cornerRadius(FlaxTheme.radiusSm)
                .overlay(
                    RoundedRectangle(cornerRadius: FlaxTheme.radiusSm)
                        .stroke(FlaxTheme.border, lineWidth: 1)
                )

        case .downloading(let p):
            HStack(spacing: 4) {
                ProgressView().scaleEffect(0.6)
                Text("\(Int(p * 100))%")
                    .font(.flaxMonoXs)
                    .foregroundStyle(FlaxTheme.textMuted)
            }

        case .loading:
            HStack(spacing: 4) {
                ProgressView().scaleEffect(0.6)
                Text("Loading")
                    .font(.flaxMonoXs)
                    .foregroundStyle(FlaxTheme.textMuted)
            }

        case .failed:
            Text("Error")
                .font(.flaxMonoXs)
                .foregroundStyle(FlaxTheme.error)

        case .notLoaded:
            EmptyView()
        }
    }

    // MARK: - Idle content

    private var idleContent: some View {
        VStack(spacing: 0) {
            if appState.meetings.isEmpty {
                emptyState
            } else {
                meetingList
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Text("No meetings yet")
                .font(.flaxMonoSm)
                .foregroundStyle(FlaxTheme.textMuted)
            Text("Click Record or wait for auto-detection")
                .font(.flaxMonoXs)
                .foregroundStyle(FlaxTheme.textFaint)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 28)
        .padding(.horizontal, 16)
    }

    private var meetingList: some View {
        VStack(spacing: 0) {
            ForEach(appState.meetings.prefix(5)) { meeting in
                MeetingRowView(meeting: meeting)
                if meeting.id != appState.meetings.prefix(5).last?.id {
                    Divider().padding(.horizontal, 12)
                }
            }
        }
    }

    // MARK: - Footer

    private var footer: some View {
        HStack(spacing: 8) {
            // Manual record trigger
            if appState.recordingState == .idle {
                Button {
                    appState.pendingTitle = nil
                    appState.recordingState = .awaitingConfirmation
                } label: {
                    Label("Record", systemImage: "mic")
                        .font(.flaxMonoSm)
                }
                .buttonStyle(FlaxButtonStyle())
                .disabled(appState.modelStatus != .ready)
            }

            Spacer()

            Button {
                if let url = URL(string: appState.flaxWorkspaceURL) {
                    NSWorkspace.shared.open(url)
                }
            } label: {
                Label("Open Flax", systemImage: "arrow.up.right.square")
                    .font(.flaxMonoSm)
            }
            .buttonStyle(FlaxButtonStyle())

            Button {
                showSettings = true
            } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 13))
            }
            .buttonStyle(FlaxButtonStyle())
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
}

// MARK: - Newspaper button style

struct FlaxButtonStyle: ButtonStyle {
    @State private var isHovered = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(
                RoundedRectangle(cornerRadius: FlaxTheme.radiusMd)
                    .fill(configuration.isPressed
                          ? FlaxTheme.beige
                          : (isHovered ? FlaxTheme.beige.opacity(0.7) : Color.clear))
            )
            .overlay(
                RoundedRectangle(cornerRadius: FlaxTheme.radiusMd)
                    .stroke(FlaxTheme.border, lineWidth: 1)
            )
            .foregroundStyle(FlaxTheme.textPrimary)
            .onHover { isHovered = $0 }
    }
}
