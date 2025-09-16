# AI Meeting Notes for Obsidian

AI Meeting Notes turns Obsidian into a personal meeting assistant. Record both microphone input and (optionally) your computer's speaker output, transcribe the audio with a locally installed Whisper-compatible tool, and summarise the conversation with the local LLM of your choice. The plugin stores the raw audio, transcript, and generated meeting note inside your vault.

## Features

- One-click modal to start and stop meeting recordings from within Obsidian.
- Capture microphone audio and, when permitted by the OS, system audio via screen/audio capture.
- Persist raw audio files and generated transcripts to configurable folders inside the vault.
- Invoke locally installed AI tools via command-line hooks for transcription (e.g. [whisper.cpp](https://github.com/ggerganov/whisper.cpp)) and summarisation (e.g. llama.cpp-based binaries).
- Automatic creation of a meeting note with summary, action items, transcript preview, and embedded audio playback.
- Heuristic fallback summarisation when no LLM command is configured.

## Requirements

- Obsidian desktop (the plugin relies on filesystem access and local command execution).
- A transcription CLI capable of accepting an audio file and writing a text transcript (tested with Whisper-compatible tools).
- Optionally, a local LLM CLI capable of reading a transcript and producing a summary and action items.
- Node.js 16+ for development/building.

## Installation (development)

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the development watcher:
   ```bash
   npm run dev
   ```
3. Link the plugin into your vault by copying `manifest.json`, `styles.css`, and the generated `main.js` into `<Vault>/.obsidian/plugins/ai-meeting-notes/`.
4. Enable **AI Meeting Notes** from *Settings → Community plugins*.

For production builds run:
```bash
npm run build
```

## Configuration

Open *Settings → AI Meeting Notes* to configure the plugin.

### Storage paths

- **Recordings folder**: Vault-relative folder for raw audio files (default: `AI Meeting Notes/Recordings`).
- **Transcripts folder**: Vault-relative folder for generated transcripts (default: `AI Meeting Notes/Transcripts`).
- **Meeting notes folder**: Vault-relative folder for the final Markdown notes (default: `AI Meeting Notes/Notes`).

### Transcription command

Provide the executable path and arguments for your transcription tool. Arguments support template placeholders:

- `{{audioFile}}`: Absolute path to the recorded audio file.
- `{{outputDir}}`: Absolute path to the transcript output directory.
- `{{baseName}}`: File stem of the recording (without extension).

Example (whisper.cpp):
```
Transcription command: /usr/local/bin/whisper
Transcription arguments: --model base.en --language en --output_txt --output_dir {{outputDir}} {{audioFile}}
Transcription output extension: txt
```

### Summarisation command

If you have a local LLM CLI, configure it similarly. Available placeholders:

- `{{transcriptFile}}`: Absolute path to the generated transcript.
- `{{outputDir}}`: Absolute path to the transcript directory.
- `{{baseName}}`: Transcript file stem.
- `{{outputFile}}`: Suggested absolute path for the summary output.

The summariser should produce a Markdown or JSON file containing a summary and action items. If no summarisation command is configured, the plugin derives a lightweight summary and action items directly from the transcript.

### Other options

- **Capture system audio by default**: Request permission to include speaker output when recording (desktop platforms only; user approval required by the OS).
- **Open note after creation**: Automatically open the generated meeting note when processing completes.
- **Embed audio in note**: Include an embedded audio player in the created note.
- **Include transcript in note**: Append the full transcript in a collapsible `<details>` block.
- **CLI working directory / timeout**: Advanced configuration for command execution.

## Usage

1. Use the ribbon microphone icon or the *Open AI meeting recorder* command palette entry to open the recording modal.
2. Choose whether to capture system audio and click **Start recording**.
3. Conduct the meeting. When finished, click **Stop & process**.
4. The plugin saves the audio, runs the configured transcription and summarisation commands, and creates a meeting note summarising the discussion alongside identified action items and the full transcript.

Processing progress is displayed in the modal. When finished, click **Open meeting note** to jump directly to the generated Markdown file.

## Command placeholders summary

| Placeholder | Description |
| ----------- | ----------- |
| `{{audioFile}}` | Absolute path to the recorded audio file (e.g. `/path/to/vault/AI Meeting Notes/Recordings/meeting-20240101-120000.webm`). |
| `{{outputDir}}` | Absolute path to the transcript directory configured in settings. |
| `{{baseName}}` | Recording base name (filename without extension). |
| `{{transcriptFile}}` | Absolute path to the generated transcript file. |
| `{{outputFile}}` | Suggested absolute path for the summariser output (e.g. summary Markdown). |

## Safety and privacy

- All processing happens locally. The plugin never sends audio or transcript data over the network.
- Commands are executed exactly as configured. Ensure you trust any executable paths you configure.
- Audio capture is subject to operating system permissions; you will be prompted when the plugin first attempts to record microphone or system audio.

## Development notes

- Source code lives in `src/` and is bundled into `main.js` with esbuild.
- Run `npm run dev` during development for incremental builds. Use `npm run build` for release builds (includes TypeScript type checking).
- The plugin is marked desktop-only because it requires filesystem access and local command execution.

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
