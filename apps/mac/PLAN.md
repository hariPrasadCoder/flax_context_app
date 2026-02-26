# Flax Mac App — Implementation Plan

## What it does

A native macOS menubar app that silently records meetings and uses the transcript to propose document updates in the Flax web editor. The user reviews AI-proposed diffs before anything changes — the Mac app never edits documents directly.

---

## High-level flow

```
Meeting happens
    │
    ▼
CATapDescription (system audio) + AVAudioEngine (mic)
    │
    ▼
WhisperKit — local on-device transcription (no audio leaves the Mac)
    │
    ▼
Transcript + current doc content → Claude API (claude-sonnet-4-6)
    │
    ▼
AI returns proposed block-level diffs
    │
    ▼
Diffs pushed to Flax server → web editor shows "Review changes" panel
    │
    ▼
User accepts / rejects each change
```

---

## Architecture

### Components

| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Menubar UI | SwiftUI + `MenuBarExtra` | Show recording state, list recent meetings, open web app |
| Audio capture | `AVAudioEngine` (mic) + `CATapDescription` / `SCStream` (system audio) | Capture both mic and app audio in real time |
| Transcription | WhisperKit (local) | Convert audio → text, on-device, no API key needed |
| Evolution engine | Claude API via URLSession | Turn transcript + doc → proposed diffs |
| Server sync | HTTP to Flax server (`/api/block-history`) | Push AI-proposed history entries into the web editor |
| Persistence | SQLite via GRDB (or plain JSON files) | Store recordings, transcripts, meeting metadata locally |

### Process boundaries

```
┌─────────────────────────────────────┐
│  Flax.app (menubar)                 │
│                                     │
│  AudioCaptureService                │
│    ├─ SCStream (system audio)       │
│    └─ AVAudioEngine (mic)           │
│         │                           │
│  TranscriptionService (WhisperKit)  │
│         │                           │
│  EvolutionService (Claude API)      │
│         │                           │
│  SyncService (HTTP → Flax server)   │
└─────────────────────────────────────┘
         │
         ▼
  Flax server  →  Web editor
  (block_history table)
```

---

## UI / UX

Inspired by Granola — minimal, stays out of the way.

### Menubar icon states
- **Grey microphone** — idle
- **Amber pulsing dot** — recording
- **Blue spinner** — transcribing / evolving

### Menubar popover (click the icon)

```
┌─────────────────────────────────┐
│  ● Recording  [Stop]            │  ← when recording
│  ─────────────────────────────  │
│  Recent meetings                │
│  ┌───────────────────────────┐  │
│  │ 📅 Design sync · 2h ago   │  │
│  │    "Updated 3 blocks"      │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ 📅 Standup · Yesterday    │  │
│  │    "2 pending reviews"     │  │
│  └───────────────────────────┘  │
│  ─────────────────────────────  │
│  [Open Flax]   [Settings]       │
└─────────────────────────────────┘
```

### Meeting detail sheet (click a meeting row)
- Transcript (scrollable, read-only)
- List of proposed changes with accept/reject toggle
- "Apply accepted changes" button → pushes to server

### Settings
- Which mic to use
- Whether to capture system audio (requires screen recording permission)
- Which Flax workspace URL to sync to
- Claude API key

---

## Permissions required

| Permission | Why |
|-----------|-----|
| Microphone (`NSMicrophoneUsageDescription`) | Record meeting audio |
| Screen Recording (`NSScreenCaptureUsageDescription`) | CATapDescription requires this to tap system audio |
| Network (`com.apple.security.network.client`) | Claude API + Flax server |

---

## Key technical decisions

### Audio capture
- **System audio**: `SCStream` with `CATapDescription` (macOS 14.2+). Captures audio from any running app without recording the screen. Requires Screen Recording permission but does NOT record pixels.
- **Mic**: `AVAudioEngine` with `AVAudioInputNode`. Runs in parallel on a separate node.
- **Mix**: Merge both streams into a single 16kHz mono PCM buffer for WhisperKit.

### Transcription
- **WhisperKit** (Swift package, runs on Apple Silicon Neural Engine).
- Model: `whisper-large-v3-turbo` for balance of speed and accuracy. Download on first launch (~600 MB).
- Chunked streaming: transcribe every ~30s of audio so results appear during the meeting, not just at the end.

### Document evolution (Claude API)
- Prompt includes: transcript chunk + relevant document blocks (current content).
- Claude returns structured JSON: `[{ blockId, action: "edit"|"add"|"delete", proposedContent, reason }]`.
- Use `claude-sonnet-4-6` with `max_tokens: 4096`.
- Each proposed change is inserted into `block_history` as `source: "meeting"` with the meeting title and reason — exactly matching the existing schema.

### Server sync
- The Mac app POSTs to `POST /api/block-history/:docId` for each proposed change.
- The entry carries `source: "meeting"`, `meeting_title`, and `reason` fields.
- The web editor already renders these with the "Meeting" badge — no server changes needed for the basic flow.
- For real-time push (user sees changes appear live), a WebSocket or SSE endpoint on the Flax server will be added in Phase 2.

### Document selection
- On first sync, the Mac app shows a picker: "Which document should this meeting evolve?" (fetches `GET /api/projects` to list docs).
- Selection is remembered per calendar event / recurring meeting title.

---

## Phases

### Phase 1 — Core recording + transcript (no AI yet)
- [ ] Xcode project: SwiftUI app with `MenuBarExtra`
- [ ] Audio capture service (`SCStream` + `AVAudioEngine`)
- [ ] WhisperKit integration, chunked transcription
- [ ] Local persistence: save recordings + transcripts to `~/Library/Application Support/Flax/`
- [ ] Menubar UI: idle / recording / transcribing states
- [ ] Popover: show recent meetings + transcripts

### Phase 2 — AI evolution
- [ ] Settings: Claude API key, Flax workspace URL
- [ ] EvolutionService: build prompt, call Claude API, parse structured response
- [ ] Meeting detail sheet: show proposed changes with accept/reject per block
- [ ] SyncService: POST accepted changes to Flax server
- [ ] Web editor: "pending review" state for meeting-sourced changes (amber badge in history panel)

### Phase 3 — Live sync
- [ ] WebSocket / SSE on Flax server for real-time push
- [ ] Changes appear in the web editor as they're proposed (streaming)
- [ ] Collab-aware: if another user is editing the same block, queue the change instead of applying immediately

### Phase 4 — Smart meeting matching
- [ ] Calendar integration (EventKit) to auto-label recordings with meeting title
- [ ] Remember document ↔ meeting mapping
- [ ] Recurring meeting recognition: auto-pick the right doc

---

## Swift packages to add

```swift
// Package.swift dependencies
.package(url: "https://github.com/argmaxinc/WhisperKit", from: "0.9.0"),
.package(url: "https://github.com/groue/GRDB.swift", from: "6.0.0"),  // optional, for SQLite
```

---

## Data structures

### Local meeting record
```swift
struct Meeting: Codable, Identifiable {
    let id: UUID
    let title: String
    let startedAt: Date
    let endedAt: Date?
    let audioFileURL: URL          // raw recording
    let transcript: String?        // populated after transcription
    let proposedChanges: [ProposedChange]
    let docId: String?             // linked Flax document
}

struct ProposedChange: Codable, Identifiable {
    let id: UUID
    let blockId: String
    let action: ChangeAction       // edit | add | delete
    let beforeContent: String?
    let proposedContent: String
    let reason: String
    var accepted: Bool?            // nil = pending, true/false = decided
}

enum ChangeAction: String, Codable {
    case edit, add, delete
}
```

### Claude prompt shape (Evolution API call)
```
System: You are helping evolve a technical document based on a meeting transcript.
        Return ONLY valid JSON — an array of proposed block changes.
        Schema: [{ "blockId": string, "action": "edit"|"add"|"delete",
                   "proposedContent": string, "reason": string }]

User:   ## Current document blocks
        [{ "id": "abc123", "content": "..." }, ...]

        ## Meeting transcript
        [transcript text]

        Propose only meaningful, factual updates. Do not rewrite style.
```

---

## Open questions (decide before Phase 2)

1. **Conflict resolution**: If two AI changes target the same block in the same meeting, which wins? → Probably show both as separate entries and let the user pick.
2. **Audio privacy**: Should recordings be auto-deleted after transcription? Add a setting.
3. **Offline mode**: If Flax server is unreachable, queue changes locally and sync when back online.
4. **Meeting boundaries**: How to detect meeting start/end automatically? Options: calendar events (EventKit), audio activity threshold, or manual "Record" button only.
