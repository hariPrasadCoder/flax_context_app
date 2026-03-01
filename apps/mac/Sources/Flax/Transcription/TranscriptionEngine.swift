// Adapted from Ambi project (reference only). Flax-specific version.
import Foundation
import WhisperKit

actor TranscriptionEngine {
    private var whisperKit: WhisperKit?
    private(set) var isModelLoaded = false
    private(set) var loadError: String?
    private var currentModelName = ""

    // base.en (~140 MB) is the reliable cross-version default.
    // Switch to "large-v3-turbo" (~600 MB) in Settings for best accuracy.
    static let defaultModel = "base.en"

    func loadModel(
        named modelName: String = TranscriptionEngine.defaultModel,
        progress: ((Double, String) -> Void)? = nil
    ) async {
        guard modelName != currentModelName || !isModelLoaded else { return }
        currentModelName = modelName
        isModelLoaded = false
        loadError = nil
        whisperKit = nil

        progress?(0.0, "Checking model...")

        do {
            let modelFolder = try await WhisperKit.download(
                variant: modelName,
                progressCallback: { p in
                    let fraction = min(p.fractionCompleted, 1.0)
                    progress?(fraction * 0.85, "Downloading... \(Int(fraction * 100))%")
                }
            )

            progress?(0.87, "Loading model...")
            whisperKit = try await WhisperKit(
                modelFolder: modelFolder.path,
                verbose: false,
                logLevel: .none,
                prewarm: false,
                load: true,
                download: false
            )

            progress?(0.95, "Warming up...")
            try await whisperKit?.prewarmModels()

            isModelLoaded = true
            loadError = nil
            progress?(1.0, "Ready")
        } catch {
            loadError = error.localizedDescription
            isModelLoaded = false
            progress?(0, "Failed: \(error.localizedDescription)")
        }
    }

    func transcribe(audioData: Data) async -> String? {
        guard let whisper = whisperKit, isModelLoaded else { return nil }

        let samples = audioData.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
        guard !samples.isEmpty else { return nil }

        do {
            let result = try await whisper.transcribe(audioArray: samples)
            let text = result.map { $0.text }.joined(separator: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return filter(text)
        } catch {
            return nil
        }
    }

    // MARK: - Internal

    private func filter(_ text: String) -> String? {
        let hallucinations: Set<String> = [
            "thank you.", "thanks for watching.", "subscribe to my channel.",
            "like and subscribe.", "see you in the next video.", "thank you for watching.",
            "[music]", "(music)", "♪", "...", "[blank_audio]", "[silence]",
            "(silence)", "[ silence ]", "[ Silence ]",
        ]
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if hallucinations.contains(trimmed.lowercased()) { return nil }
        let meaningful = trimmed.filter { $0.isLetter || $0.isNumber }
        if meaningful.count < 2 { return nil }
        return trimmed
    }

    func availableModels() -> [(id: String, name: String, size: String)] {
        [
            ("tiny.en",          "Tiny (English)",      "~75 MB"),
            ("base.en",          "Base (English)",      "~140 MB"),
            ("small.en",         "Small (English)",     "~460 MB"),
            ("large-v3-turbo",   "Large v3 Turbo",      "~600 MB"),
        ]
    }
}
