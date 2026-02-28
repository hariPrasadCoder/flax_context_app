import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Settings")
                    .font(.flaxSerif)
                    .foregroundStyle(FlaxTheme.textPrimary)
                Spacer()
                Button { dismiss() } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(FlaxTheme.textMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(16)

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    settingsSection("Audio") {
                        permissionRow(
                            title: "Microphone",
                            granted: appState.hasMicPermission,
                            action: { Task { await appState.requestMicPermission() } }
                        )
                        Divider().padding(.horizontal, 14)
                        Toggle(isOn: $appState.captureSystemAudio) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Capture system audio")
                                    .font(.flaxMonoSm)
                                    .foregroundStyle(FlaxTheme.textPrimary)
                                Text("Records Zoom, Meet, Slack — requires Screen Recording permission")
                                    .font(.flaxMonoXs)
                                    .foregroundStyle(FlaxTheme.textFaint)
                            }
                        }
                        .toggleStyle(.switch)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)

                        if appState.captureSystemAudio && !appState.hasSystemAudioPermission {
                            Button("Grant Screen Recording Permission") {
                                Task { await appState.requestSystemAudioPermission() }
                            }
                            .font(.flaxMonoSm)
                            .buttonStyle(FlaxButtonStyle())
                            .padding(.horizontal, 14)
                            .padding(.bottom, 10)
                        }
                    }

                    settingsSection("Flax") {
                        labeledField("Workspace URL", binding: $appState.flaxWorkspaceURL,
                                     placeholder: "http://localhost:3000",
                                     note: "Used to sync meetings to your documents (Phase 2)")
                    }

                    settingsSection("AI (Phase 2)") {
                        labeledField("Claude API Key", binding: $appState.claudeAPIKey,
                                     placeholder: "sk-ant-...",
                                     note: "Required for AI-powered document evolution",
                                     secure: true)
                    }

                    settingsSection("Model") {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Whisper model")
                                    .font(.flaxMonoSm)
                                    .foregroundStyle(FlaxTheme.textPrimary)
                                Text("large-v3-turbo · ~600 MB · Apple Silicon optimised")
                                    .font(.flaxMonoXs)
                                    .foregroundStyle(FlaxTheme.textFaint)
                            }
                            Spacer()
                            Text(appState.modelStatus.label)
                                .font(.flaxMonoXs)
                                .foregroundStyle(statusColor)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                    }
                }
            }
        }
        .frame(width: 400, height: 480)
        .background(FlaxTheme.cream)
    }

    // MARK: - Helpers

    @ViewBuilder
    private func settingsSection(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title.uppercased())
                .font(.flaxMonoXs)
                .foregroundStyle(FlaxTheme.textFaint)
                .padding(.horizontal, 14)
                .padding(.top, 16)
                .padding(.bottom, 6)

            VStack(spacing: 0) {
                content()
            }
            .background(FlaxTheme.white)
            .cornerRadius(FlaxTheme.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: FlaxTheme.radiusMd)
                    .stroke(FlaxTheme.border, lineWidth: 1)
            )
            .padding(.horizontal, 14)
        }
    }

    @ViewBuilder
    private func permissionRow(title: String, granted: Bool, action: @escaping () -> Void) -> some View {
        HStack {
            Text(title)
                .font(.flaxMonoSm)
                .foregroundStyle(FlaxTheme.textPrimary)
            Spacer()
            if granted {
                Label("Granted", systemImage: "checkmark.circle.fill")
                    .font(.flaxMonoXs)
                    .foregroundStyle(FlaxTheme.success)
            } else {
                Button("Grant Access", action: action)
                    .font(.flaxMonoXs)
                    .buttonStyle(FlaxButtonStyle())
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    @ViewBuilder
    private func labeledField(
        _ label: String,
        binding: Binding<String>,
        placeholder: String,
        note: String,
        secure: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.flaxMonoSm)
                .foregroundStyle(FlaxTheme.textPrimary)
            Group {
                if secure {
                    SecureField(placeholder, text: binding)
                } else {
                    TextField(placeholder, text: binding)
                }
            }
            .font(.flaxMonoSm)
            .textFieldStyle(.plain)
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(FlaxTheme.cream)
            .cornerRadius(FlaxTheme.radiusMd)
            .overlay(
                RoundedRectangle(cornerRadius: FlaxTheme.radiusMd)
                    .stroke(FlaxTheme.border, lineWidth: 1)
            )
            Text(note)
                .font(.flaxMonoXs)
                .foregroundStyle(FlaxTheme.textFaint)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var statusColor: Color {
        switch appState.modelStatus {
        case .ready:    return FlaxTheme.success
        case .failed:   return FlaxTheme.error
        default:        return FlaxTheme.textMuted
        }
    }
}
