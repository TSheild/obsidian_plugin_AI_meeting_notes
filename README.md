# AI Meeting Notes (Obsidian plugin)

AI Meeting Notes captures both microphone and system audio directly from Obsidian, forwards the recording to your local speech-to-text model (for example Whisper), and then sends the transcript to a local language model to produce meeting summaries and action items. The processed notes can be appended automatically to the current file and are also displayed in an interactive modal for quick review.

> **Privacy first:** the plugin never ships audio or text to a remote service. You remain in control by pointing the plugin at transcription and summarization endpoints running on your own machine or trusted network.

## Key features

- 🎙️ Record microphone and (optionally) system/speaker audio in a single click.
- 🤖 Send the captured audio to a local transcription service (Whisper, faster-whisper, Whisper.cpp, etc.).
- 🧠 Summarize the resulting transcript with your local LLM to extract highlights and action items.
- 📝 Append the generated notes to the active document and review them inside an Obsidian modal.
- ⚙️ Customise headings, transcript inclusion, and authentication tokens for the local services.

## Requirements

AI Meeting Notes expects two HTTP services to be available on your machine or LAN:

1. **Transcription service** – accepts a `multipart/form-data` POST request containing the audio file under the `file` field and returns JSON with at least a `text` property. Examples:
   - [`whisper.cpp`](https://github.com/ggerganov/whisper.cpp) running with the HTTP server (`./main -m models/ggml-base.en.bin --host 127.0.0.1 --port 5001 --convert`)
   - [`faster-whisper`](https://github.com/guillaumekln/faster-whisper) served through [`faster-whisper-server`](https://github.com/guillaumekln/faster-whisper/tree/main/examples/http_server)

2. **Summarisation service** – accepts a JSON POST payload containing `{ "transcript": "...", "metadata": { ... } }` and responds with JSON containing `summary` and `actionItems` (or similar keys such as `action_items`, `tasks`, `todos`). You can build this endpoint on top of:
   - [`llama.cpp`](https://github.com/ggerganov/llama.cpp) or [`Ollama`](https://ollama.ai) exposed through a tiny HTTP wrapper
   - [`LM Studio`](https://lmstudio.ai) or other local LLM runtimes capable of receiving prompts via HTTP

Both endpoints can require bearer tokens; configure those in the plugin settings if needed.

The plugin is marked as **desktop only** because capturing system audio is not available on mobile.

## Configuration

Open **Settings → Community plugins → AI Meeting Notes** after enabling the plugin. The following options are available:

- **Transcription endpoint** – URL of your local Whisper (or equivalent) HTTP server.
- **Transcription Authorization header** – optional bearer token value sent as the `Authorization` header.
- **Summarisation endpoint** – URL of the local LLM endpoint that turns transcripts into summaries/action items.
- **Summarisation Authorization header** – optional bearer token value for the summariser.
- **Capture microphone audio** – include microphone input in the recording.
- **Capture system audio** – use screen audio capture to include speaker/system output. Obsidian will prompt you to pick a screen/window; choose any option that exposes "Share audio".
- **Automatically append to active note** – when enabled, the generated markdown is appended to the current editor automatically.
- **Include transcript in notes** – toggle the verbatim transcript section.
- **Summary / Action items / Transcript headings** – customise the headings inserted into the markdown output.

## Workflow

1. Start a recording via the ribbon icon or the command palette command **Start meeting recording**.
2. Speak normally; optionally share audio from video-conferencing apps so it is captured.
3. Stop the recording using the same ribbon icon or the command **Stop meeting recording**.
4. The plugin sends the audio to your local transcription service, then forwards the transcript to your summarisation endpoint.
5. Review the generated summary and action items in the modal. Use the **Copy markdown** button or insert the notes into the active file from there (this happens automatically if the relevant setting is enabled).

If the summarisation endpoint is unavailable, the plugin falls back to a lightweight heuristic summary and flags this in the modal.

## Commands

| Command | Description |
| --- | --- |
| `AI Meeting Notes: Start meeting recording` | Begin capturing audio using the configured sources. |
| `AI Meeting Notes: Stop meeting recording` | Stop capturing audio and process the recording. |
| `AI Meeting Notes: Toggle meeting recording` | Convenience toggle that starts or stops recording depending on the current state. |

## Development

```bash
npm install
npm run dev   # build in watch mode
npm run build # type-check and create production bundle
```

The plugin source lives under `src/` and is bundled into `main.js` with esbuild. Release artefacts (`main.js`, `manifest.json`, `styles.css`) are created at the repository root.

## Manual installation

1. Build the plugin with `npm run build`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into your vault at `Vault/.obsidian/plugins/ai-meeting-notes/`.
3. Reload Obsidian and enable **AI Meeting Notes** under **Settings → Community plugins**.

## Disclaimer

Capturing system audio is subject to operating system support and permissions. If the browser/Electron runtime denies access you will receive a notice and only microphone audio will be recorded. Always inform meeting participants before recording.
