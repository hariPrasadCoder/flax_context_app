import SwiftUI
import AVFoundation

// MARK: - State Machine

enum RecordingState: Equatable {
    case idle
    case awaitingConfirmation
    case recording
    case finishing
}

enum ModelStatus: Equatable {
    case notLoaded
    case downloading(Double)
    case loading
    case ready
    case failed(String)

    var label: String {
        switch self {
        case .notLoaded:            return "Not loaded"
        case .downloading(let p):   return "Downloading \(Int(p * 100))%"
        case .loading:              return "Loading model..."
        case .ready:                return "Ready"
        case .failed(let e):        return "Error: \(e)"
        }
    }

    var isReady: Bool { self == .ready }
}

// MARK: - AppState

@MainActor
class AppState: ObservableObject {
    static let shared = AppState()

    // MARK: Recording
    @Published var recordingState: RecordingState = .idle
    @Published var currentMeeting: Meeting?
    @Published var liveTranscript: String = ""
    @Published var currentAudioLevel: Float = 0
    @Published var pendingTitle: String?

    // MARK: History
    @Published var meetings: [Meeting] = []
    @Published var selectedMeeting: Meeting?

    // MARK: Model
    @Published var modelStatus: ModelStatus = .notLoaded

    // MARK: Permissions
    @Published var hasMicPermission = false
    @Published var hasSystemAudioPermission = false

    // MARK: Settings (persisted)
    @AppStorage("flax.captureSystemAudio") var captureSystemAudio = true
    @AppStorage("flax.flaxWorkspaceURL")   var flaxWorkspaceURL  = "http://localhost:3000"
    @AppStorage("flax.claudeAPIKey")       var claudeAPIKey      = ""
    // base.en (~140 MB) is the reliable default; user can switch to large-v3-turbo in Settings
    @AppStorage("flax.whisperModel")       var whisperModel      = "base.en"

    // MARK: Services
    private var micRecorder: MicRecorder?
    private var systemAudioRecorder: SystemAudioRecorder?
    private var audioLevelMonitor: AudioLevelMonitor?
    private var calendarMonitor: CalendarMonitor?
    private var transcriptionEngine: TranscriptionEngine?

    private init() {}

    // MARK: - Boot

    func initialize() async {
        loadMeetings()
        hasMicPermission          = MicRecorder.checkAuthorization() == .authorized
        hasSystemAudioPermission  = SystemAudioRecorder.hasPermission()

        await loadWhisperModel()
        startDetection()
    }

    func loadWhisperModel() async {
        transcriptionEngine = TranscriptionEngine()
        modelStatus = .downloading(0)

        await transcriptionEngine?.loadModel(named: whisperModel) { progress, _ in
            Task { @MainActor in
                self.modelStatus = progress < 0.86 ? .downloading(progress) : .loading
            }
        }

        if let engine = transcriptionEngine {
            let loaded = await engine.isModelLoaded
            let err    = await engine.loadError
            modelStatus = loaded ? .ready : .failed(err ?? "Unknown error")
        }
    }

    func retryModelLoad() async {
        await loadWhisperModel()
    }

    // MARK: - Smart Detection

    func startDetection() {
        guard recordingState == .idle else { return }

        if hasMicPermission {
            let monitor = AudioLevelMonitor()
            monitor.requiredDuration = 30
            monitor.onMeetingDetected = { [weak self] in
                Task { @MainActor in
                    guard self?.recordingState == .idle else { return }
                    self?.pendingTitle = nil
                    self?.recordingState = .awaitingConfirmation
                }
            }
            monitor.onAudioLevelChanged = { [weak self] level in
                Task { @MainActor in self?.currentAudioLevel = level }
            }
            monitor.start()
            audioLevelMonitor = monitor
        }

        let cal = CalendarMonitor()
        cal.onMeetingAboutToStart = { [weak self] title in
            Task { @MainActor in
                guard self?.recordingState == .idle else { return }
                self?.pendingTitle = title
                self?.recordingState = .awaitingConfirmation
            }
        }
        cal.start()
        calendarMonitor = cal
    }

    private func stopDetection() {
        audioLevelMonitor?.stop(); audioLevelMonitor = nil
        calendarMonitor?.stop();   calendarMonitor   = nil
    }

    // MARK: - Recording Control

    func startMeeting(title: String, source: Meeting.RecordingSource = .manual) {
        guard recordingState == .idle || recordingState == .awaitingConfirmation else { return }
        stopDetection()

        let meeting = Meeting(
            title: title.isEmpty ? "Meeting" : title,
            source: source,
            startedAt: Date()
        )
        currentMeeting  = meeting
        selectedMeeting = meeting   // auto-open in main window
        liveTranscript  = ""
        recordingState  = .recording

        // Mic recorder — audio captured regardless of model status; transcription
        // will process chunks as soon as the model is ready.
        let mic = MicRecorder { [weak self] data in
            Task { await self?.processAudio(data) }
        }
        mic.onAudioLevelChanged = { [weak self] level in
            Task { @MainActor in self?.currentAudioLevel = level }
        }
        mic.onPermissionDenied = { [weak self] in
            Task { @MainActor in self?.hasMicPermission = false }
        }
        mic.startRecording()
        micRecorder = mic

        if captureSystemAudio && hasSystemAudioPermission {
            let sys = SystemAudioRecorder()
            sys.transcriptionCallback = { [weak self] data in
                Task { await self?.processAudio(data) }
            }
            sys.onAudioLevelChanged = { [weak self] level in
                Task { @MainActor in self?.currentAudioLevel = max(self?.currentAudioLevel ?? 0, level) }
            }
            try? sys.start()
            systemAudioRecorder = sys
        }
    }

    func stopMeeting() {
        guard currentMeeting != nil else { return }
        Task { await _stopMeetingAsync() }
    }

    private func _stopMeetingAsync() async {
        guard var meeting = currentMeeting else { return }
        recordingState = .finishing

        // Drain remaining buffered audio BEFORE stopping the recorders.
        // This captures the final chunk that the periodic timer hasn't fired yet.
        let lastMicData = micRecorder?.drainBuffer()
        let lastSysData = systemAudioRecorder?.drainBuffer()

        micRecorder?.stopRecording();  micRecorder = nil
        systemAudioRecorder?.stop();   systemAudioRecorder = nil

        // Await the final transcription so it lands in liveTranscript before we save.
        if let data = lastMicData, let text = await transcriptionEngine?.transcribe(audioData: data) {
            liveTranscript += (liveTranscript.isEmpty ? "" : " ") + text
        }
        if let data = lastSysData, let text = await transcriptionEngine?.transcribe(audioData: data) {
            liveTranscript += (liveTranscript.isEmpty ? "" : " ") + text
        }

        meeting.endedAt    = Date()
        meeting.transcript = liveTranscript
        currentMeeting     = nil

        meetings.insert(meeting, at: 0)
        selectedMeeting = meeting
        saveMeetings()

        recordingState    = .idle
        pendingTitle      = nil
        currentAudioLevel = 0

        startDetection()
    }

    func dismissConfirmation() {
        recordingState = .idle
        pendingTitle   = nil
    }

    // MARK: - Permissions

    func requestMicPermission() async {
        hasMicPermission = await MicRecorder.requestAccess()
    }

    func requestSystemAudioPermission() async {
        hasSystemAudioPermission = await Task.detached {
            SystemAudioRecorder.requestPermission()
        }.value
    }

    // MARK: - Audio Processing

    private func processAudio(_ audioData: Data) async {
        guard let engine = transcriptionEngine,
              recordingState == .recording || recordingState == .finishing
        else { return }

        // Wait until model is ready — the engine's transcribe() guards on isModelLoaded internally
        if let text = await engine.transcribe(audioData: audioData) {
            liveTranscript += (liveTranscript.isEmpty ? "" : " ") + text
            currentMeeting?.transcript = liveTranscript
            if selectedMeeting?.id == currentMeeting?.id {
                selectedMeeting?.transcript = liveTranscript
            }
        }
    }

    // MARK: - Persistence

    private var meetingsFileURL: URL {
        let support = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0].appendingPathComponent("Flax")
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
        return support.appendingPathComponent("meetings.json")
    }

    private func saveMeetings() {
        guard let data = try? JSONEncoder().encode(meetings) else { return }
        try? data.write(to: meetingsFileURL)
    }

    private func loadMeetings() {
        guard let data = try? Data(contentsOf: meetingsFileURL),
              let saved = try? JSONDecoder().decode([Meeting].self, from: data)
        else { return }
        meetings = saved
    }

    func deleteMeeting(_ meeting: Meeting) {
        meetings.removeAll { $0.id == meeting.id }
        if selectedMeeting?.id == meeting.id { selectedMeeting = meetings.first }
        saveMeetings()
    }

    func cleanup() {
        stopDetection()
        micRecorder?.stopRecording()
        systemAudioRecorder?.stop()
    }
}
