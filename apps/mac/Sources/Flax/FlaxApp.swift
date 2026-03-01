import SwiftUI
import AppKit

@main
struct FlaxApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var appState = AppState.shared

    var body: some Scene {
        // Main window — sidebar + transcript detail
        WindowGroup {
            MainWindowView()
                .environmentObject(appState)
                .preferredColorScheme(.light)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unifiedCompact)
        .commands {
            CommandGroup(replacing: .newItem) {}
        }

        // Menubar icon — quick recording control
        MenuBarExtra {
            MenuBarView()
                .environmentObject(appState)
        } label: {
            menuBarLabel
        }
        .menuBarExtraStyle(.window)
    }

    @ViewBuilder
    private var menuBarLabel: some View {
        HStack(spacing: 3) {
            Text("F")
                .font(.system(size: 13, weight: .bold, design: .serif))

            if appState.recordingState == .recording {
                Circle()
                    .fill(Color(red: 0.72, green: 0.495, blue: 0.18))
                    .frame(width: 5, height: 5)
            } else if appState.recordingState == .awaitingConfirmation {
                Circle()
                    .fill(Color(red: 0.72, green: 0.495, blue: 0.18).opacity(0.6))
                    .frame(width: 5, height: 5)
            }
        }
    }
}

// MARK: - App Delegate

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Force light (Aqua) appearance at AppKit level — overrides system dark mode
        // for the entire app including title bar, sidebar material, and window chrome.
        NSApp.appearance = NSAppearance(named: .aqua)

        Task {
            await AppState.shared.initialize()
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        AppState.shared.cleanup()
    }

    // Keep running when main window is closed — menubar icon stays active
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}
