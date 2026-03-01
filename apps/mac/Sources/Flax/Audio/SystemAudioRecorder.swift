// Adapted from Ambi project (reference only). Flax-specific version.
import CoreAudio
import AVFoundation

class SystemAudioRecorder: NSObject {
    private var tapID: AudioObjectID = kAudioObjectUnknown
    private var aggregateDeviceID: AudioObjectID = kAudioObjectUnknown
    private var ioProcID: AudioDeviceIOProcID?
    private var audioConverter: AVAudioConverter?
    private var nativeFormat: AVAudioFormat?
    private var whisperFormat: AVAudioFormat?

    private var sampleAccumulator: [Float] = []
    private let bufferLock = NSLock()
    private var processingTimer: Timer?
    private var _isPaused = false

    var isRecording = false
    var processingInterval: TimeInterval = 30.0
    var transcriptionCallback: ((Data) -> Void)?
    var onAudioLevelChanged: ((Float) -> Void)?

    enum Err: Error {
        case unavailable, tapCreation, tapUID, aggregateDevice, formatSetup, ioProc, start
    }

    // MARK: - Permission

    static func hasPermission() -> Bool {
        UserDefaults.standard.bool(forKey: "flax.systemAudioPermissionGranted")
    }

    /// Creates a test tap to trigger the TCC Screen Recording prompt.
    /// Must be called off the main thread. Returns true if granted.
    static func requestPermission() -> Bool {
        guard #available(macOS 14.2, *) else { return false }
        let tapDesc = CATapDescription(__stereoGlobalTapButExcludeProcesses: [])
        tapDesc.name = "FlaxPermissionCheck"
        var testTapID: AudioObjectID = kAudioObjectUnknown
        let status = AudioHardwareCreateProcessTap(tapDesc, &testTapID)
        let granted = status == kAudioHardwareNoError
        if granted { AudioHardwareDestroyProcessTap(testTapID) }
        UserDefaults.standard.set(granted, forKey: "flax.systemAudioPermissionGranted")
        return granted
    }

    // MARK: - Lifecycle

    func start() throws {
        guard #available(macOS 14.2, *) else { throw Err.unavailable }

        let tapDesc = CATapDescription(__stereoGlobalTapButExcludeProcesses: [])
        tapDesc.name = "FlaxSystemAudioTap"
        var newTapID: AudioObjectID = kAudioObjectUnknown
        guard AudioHardwareCreateProcessTap(tapDesc, &newTapID) == kAudioHardwareNoError
        else { throw Err.tapCreation }
        tapID = newTapID

        var uidAddr = AudioObjectPropertyAddress(
            mSelector: kAudioTapPropertyUID,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain)
        var uidSize = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
        var tapUIDUnmanaged: Unmanaged<CFString>? = nil
        AudioObjectGetPropertyData(tapID, &uidAddr, 0, nil, &uidSize, &tapUIDUnmanaged)
        guard let tapUID = tapUIDUnmanaged?.takeRetainedValue() as String?
        else { throw Err.tapUID }

        let aggUID = UUID().uuidString
        let aggDesc: NSDictionary = [
            kAudioAggregateDeviceNameKey: "FlaxSystemAudio",
            kAudioAggregateDeviceUIDKey: aggUID,
            kAudioAggregateDeviceIsPrivateKey: true,
            kAudioAggregateDeviceTapListKey: [[kAudioSubTapUIDKey: tapUID]],
            kAudioAggregateDeviceTapAutoStartKey: true,
        ]
        var newAggID: AudioObjectID = kAudioObjectUnknown
        guard AudioHardwareCreateAggregateDevice(aggDesc, &newAggID) == kAudioHardwareNoError
        else { throw Err.aggregateDevice }
        aggregateDeviceID = newAggID

        var fmtAddr = AudioObjectPropertyAddress(
            mSelector: kAudioTapPropertyFormat,
            mScope: kAudioObjectPropertyScopeGlobal,
            mElement: kAudioObjectPropertyElementMain)
        var asbd = AudioStreamBasicDescription()
        var fmtSize = UInt32(MemoryLayout<AudioStreamBasicDescription>.stride)
        AudioObjectGetPropertyData(tapID, &fmtAddr, 0, nil, &fmtSize, &asbd)

        guard let inFmt  = AVAudioFormat(streamDescription: &asbd),
              let outFmt = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                         sampleRate: 16000, channels: 1, interleaved: false),
              let conv   = AVAudioConverter(from: inFmt, to: outFmt)
        else { throw Err.formatSetup }
        nativeFormat   = inFmt
        whisperFormat  = outFmt
        audioConverter = conv

        var newProcID: AudioDeviceIOProcID?
        let ioStatus = AudioDeviceCreateIOProcIDWithBlock(&newProcID, aggregateDeviceID, nil) {
            [weak self] _, inInputData, _, _, _ in
            guard let self else { return }
            self.handleIOBuffer(inInputData)
        }
        guard ioStatus == kAudioHardwareNoError, let procID = newProcID
        else { throw Err.ioProc }
        ioProcID = procID

        guard AudioDeviceStart(aggregateDeviceID, ioProcID) == kAudioHardwareNoError
        else { throw Err.start }

        isRecording = true
        _isPaused = false
        DispatchQueue.main.async { self.startProcessingTimer() }
    }

    func stop() {
        processingTimer?.invalidate()
        processingTimer = nil
        processAccumulatedAudio()

        if aggregateDeviceID != kAudioObjectUnknown {
            AudioDeviceStop(aggregateDeviceID, ioProcID)
            if let procID = ioProcID {
                AudioDeviceDestroyIOProcID(aggregateDeviceID, procID)
                ioProcID = nil
            }
            AudioHardwareDestroyAggregateDevice(aggregateDeviceID)
            aggregateDeviceID = kAudioObjectUnknown
        }
        if tapID != kAudioObjectUnknown {
            if #available(macOS 14.2, *) { AudioHardwareDestroyProcessTap(tapID) }
            tapID = kAudioObjectUnknown
        }

        isRecording = false
        bufferLock.lock(); sampleAccumulator.removeAll(); bufferLock.unlock()
        audioConverter = nil; nativeFormat = nil; whisperFormat = nil
    }

    func pause() {
        _isPaused = true
        processingTimer?.invalidate()
        processAccumulatedAudio()
    }

    func resume() {
        _isPaused = false
        startProcessingTimer()
    }

    func drainBuffer() -> Data? {
        bufferLock.lock()
        let samples = sampleAccumulator
        sampleAccumulator.removeAll()
        bufferLock.unlock()
        guard !samples.isEmpty else { return nil }
        let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(samples.count))
        guard rms > 0.004 else { return nil }
        return samples.withUnsafeBufferPointer { Data(buffer: $0) }
    }

    func flushBuffer() {
        processAccumulatedAudio()
        bufferLock.lock(); sampleAccumulator.removeAll(); bufferLock.unlock()
    }

    // MARK: - Internal

    private func startProcessingTimer() {
        processingTimer?.invalidate()
        processingTimer = Timer.scheduledTimer(
            withTimeInterval: processingInterval, repeats: true
        ) { [weak self] _ in self?.processAccumulatedAudio() }
    }

    private func processAccumulatedAudio() {
        bufferLock.lock()
        let samples = sampleAccumulator
        sampleAccumulator.removeAll()
        bufferLock.unlock()
        guard !samples.isEmpty else { return }
        let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(samples.count))
        guard rms > 0.004 else { return }
        let data = samples.withUnsafeBufferPointer { Data(buffer: $0) }
        transcriptionCallback?(data)
    }

    private func handleIOBuffer(_ inputData: UnsafePointer<AudioBufferList>) {
        guard !_isPaused,
              let inFmt = nativeFormat, let outFmt = whisperFormat,
              let conv = audioConverter else { return }

        guard let inputBuf = AVAudioPCMBuffer(pcmFormat: inFmt,
                                              bufferListNoCopy: inputData,
                                              deallocator: nil) else { return }

        let outCapacity = AVAudioFrameCount(
            Double(inputBuf.frameLength) * 16000.0 / inFmt.sampleRate) + 64
        guard let outputBuf = AVAudioPCMBuffer(pcmFormat: outFmt,
                                               frameCapacity: outCapacity) else { return }

        conv.convert(to: outputBuf, error: nil) { _, outStatus in
            outStatus.pointee = .haveData
            return inputBuf
        }

        guard let channelData = outputBuf.floatChannelData?[0] else { return }
        let samples = Array(UnsafeBufferPointer(start: channelData,
                                                count: Int(outputBuf.frameLength)))
        bufferLock.lock(); sampleAccumulator.append(contentsOf: samples); bufferLock.unlock()

        if !samples.isEmpty {
            let rms = sqrt(samples.map { $0 * $0 }.reduce(0, +) / Float(samples.count))
            DispatchQueue.main.async { [weak self] in self?.onAudioLevelChanged?(min(rms * 10, 1.0)) }
        }
    }

    deinit {
        if aggregateDeviceID != kAudioObjectUnknown {
            AudioDeviceStop(aggregateDeviceID, ioProcID)
            if let procID = ioProcID {
                AudioDeviceDestroyIOProcID(aggregateDeviceID, procID)
            }
            AudioHardwareDestroyAggregateDevice(aggregateDeviceID)
        }
        if tapID != kAudioObjectUnknown {
            if #available(macOS 14.2, *) { AudioHardwareDestroyProcessTap(tapID) }
        }
    }
}
