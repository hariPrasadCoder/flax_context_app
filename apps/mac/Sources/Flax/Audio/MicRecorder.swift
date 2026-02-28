// Adapted from Ambi project (reference only). Flax-specific version.
import Foundation
import AVFoundation

class MicRecorder: NSObject, ObservableObject {
    private var audioEngine: AVAudioEngine?
    private var audioBuffer: [Float] = []
    private let bufferLock = NSLock()
    private let transcriptionCallback: (Data) -> Void
    private var processingTimer: Timer?
    private var hasRequestedPermission = false
    private var isSetup = false

    @Published var isRecording = false
    @Published var isPaused = false

    var onPermissionDenied: (() -> Void)?
    var onAudioLevelChanged: ((Float) -> Void)?

    private let sampleRate: Double = 16000
    private let processingInterval: TimeInterval

    init(processingInterval: TimeInterval = 15.0, transcriptionCallback: @escaping (Data) -> Void) {
        self.processingInterval = processingInterval
        self.transcriptionCallback = transcriptionCallback
        super.init()
    }

    // MARK: - Public

    func startRecording() {
        guard !isRecording else { return }
        checkPermission { [weak self] granted in
            guard let self, granted else {
                DispatchQueue.main.async { self?.onPermissionDenied?() }
                return
            }
            DispatchQueue.main.async { self.setupAndStart() }
        }
    }

    func stopRecording() {
        processingTimer?.invalidate()
        processingTimer = nil
        processAccumulatedAudio()

        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil

        isRecording = false
        isPaused = false
        isSetup = false

        bufferLock.lock(); audioBuffer.removeAll(); bufferLock.unlock()
    }

    func pauseRecording() {
        guard isRecording, !isPaused else { return }
        isPaused = true
        processingTimer?.invalidate()
        processAccumulatedAudio()
    }

    func resumeRecording() {
        guard isRecording, isPaused else { return }
        isPaused = false
        startProcessingTimer()
    }

    /// Returns remaining buffered audio as Data (ready for Whisper) and clears the buffer.
    /// Returns nil if the buffer is silent or empty.
    func drainBuffer() -> Data? {
        bufferLock.lock()
        let samples = audioBuffer
        audioBuffer.removeAll()
        bufferLock.unlock()
        guard !samples.isEmpty else { return nil }
        let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(samples.count))
        guard rms > 0.004 else { return nil }
        return samples.withUnsafeBufferPointer { Data(buffer: $0) }
    }

    func flushBuffer() {
        processAccumulatedAudio()
        bufferLock.lock(); audioBuffer.removeAll(); bufferLock.unlock()
    }

    // MARK: - Permission

    static func checkAuthorization() -> AVAuthorizationStatus {
        AVCaptureDevice.authorizationStatus(for: .audio)
    }

    static func requestAccess() async -> Bool {
        await AVCaptureDevice.requestAccess(for: .audio)
    }

    private func checkPermission(completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            completion(true)
        case .notDetermined:
            guard !hasRequestedPermission else { completion(false); return }
            hasRequestedPermission = true
            AVCaptureDevice.requestAccess(for: .audio) { completion($0) }
        default:
            completion(false)
        }
    }

    // MARK: - Internal

    private func setupAndStart() {
        guard !isSetup else { resumeRecording(); return }

        audioEngine = AVAudioEngine()
        guard let engine = audioEngine else { return }

        let inputNode = engine.inputNode
        let inputFormat = inputNode.outputFormat(forBus: 0)

        guard let outputFormat = AVAudioFormat(
            commonFormat: .pcmFormatFloat32,
            sampleRate: sampleRate, channels: 1, interleaved: false
        ),
        let converter = AVAudioConverter(from: inputFormat, to: outputFormat)
        else { return }

        inputNode.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { [weak self] buffer, _ in
            guard let self, !self.isPaused else { return }
            self.processInputBuffer(buffer, converter: converter, outputFormat: outputFormat)
        }

        do {
            try engine.start()
            isRecording = true
            isPaused = false
            isSetup = true
            startProcessingTimer()
        } catch {
            print("MicRecorder: engine start failed: \(error)")
            isRecording = false
        }
    }

    private func processInputBuffer(
        _ buffer: AVAudioPCMBuffer,
        converter: AVAudioConverter,
        outputFormat: AVAudioFormat
    ) {
        let frameCount = AVAudioFrameCount(Double(buffer.frameLength) * sampleRate / buffer.format.sampleRate)
        guard let converted = AVAudioPCMBuffer(pcmFormat: outputFormat, frameCapacity: frameCount)
        else { return }

        var error: NSError?
        converter.convert(to: converted, error: &error) { _, status in
            status.pointee = .haveData
            return buffer
        }
        guard error == nil, let channelData = converted.floatChannelData?[0] else { return }
        let samples = Array(UnsafeBufferPointer(start: channelData, count: Int(converted.frameLength)))

        bufferLock.lock(); audioBuffer.append(contentsOf: samples); bufferLock.unlock()

        if !samples.isEmpty {
            let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(samples.count))
            DispatchQueue.main.async { [weak self] in self?.onAudioLevelChanged?(min(rms * 10, 1.0)) }
        }
    }

    private func startProcessingTimer() {
        processingTimer?.invalidate()
        processingTimer = Timer.scheduledTimer(
            withTimeInterval: processingInterval, repeats: true
        ) { [weak self] _ in self?.processAccumulatedAudio() }
    }

    private func processAccumulatedAudio() {
        guard isRecording, !isPaused else { return }
        bufferLock.lock()
        let samples = audioBuffer
        audioBuffer.removeAll()
        bufferLock.unlock()
        guard !samples.isEmpty else { return }
        let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(samples.count))
        guard rms > 0.004 else { return }
        let data = samples.withUnsafeBufferPointer { Data(buffer: $0) }
        transcriptionCallback(data)
    }

    deinit { stopRecording() }
}
