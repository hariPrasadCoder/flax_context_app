import AVFoundation

/// Lightweight mic-level monitor used for smart meeting detection.
/// Does NOT record or transcribe — just measures RMS to detect sustained audio activity.
class AudioLevelMonitor {
    private var audioEngine: AVAudioEngine?
    private var checkTimer: Timer?
    private var sustainedSeconds: TimeInterval = 0

    var onMeetingDetected: (() -> Void)?
    var onAudioLevelChanged: ((Float) -> Void)?

    /// How long sustained audio must be present before triggering detection (default: 30s)
    var requiredDuration: TimeInterval = 30
    /// RMS threshold above which audio is considered "active"
    var detectionThreshold: Float = 0.02

    private var currentLevel: Float = 0

    func start() {
        guard AVCaptureDevice.authorizationStatus(for: .audio) == .authorized else { return }
        audioEngine = AVAudioEngine()
        guard let engine = audioEngine else { return }

        let inputNode = engine.inputNode
        let format = inputNode.outputFormat(forBus: 0)

        inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            guard let self else { return }
            guard let channelData = buffer.floatChannelData?[0] else { return }
            let samples = UnsafeBufferPointer(start: channelData, count: Int(buffer.frameLength))
            let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(samples.count))
            DispatchQueue.main.async {
                self.currentLevel = min(rms * 10, 1.0)
                self.onAudioLevelChanged?(self.currentLevel)
            }
        }

        try? engine.start()

        checkTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.tick()
        }
    }

    func stop() {
        checkTimer?.invalidate()
        checkTimer = nil
        sustainedSeconds = 0

        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine = nil
    }

    private func tick() {
        if currentLevel > detectionThreshold {
            sustainedSeconds += 1
            if sustainedSeconds >= requiredDuration {
                sustainedSeconds = 0
                onMeetingDetected?()
            }
        } else {
            sustainedSeconds = max(0, sustainedSeconds - 2)
        }
    }
}
