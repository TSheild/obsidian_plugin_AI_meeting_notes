# AI Meeting Notes for Obsidian

AI Meeting Notes is an Obsidian community plugin that captures your meetings, transcribes them with a local Whisper-compatible service, and then produces structured meeting notes with the help of a local large language model. Both the raw audio recording and the generated note are saved in your vault so nothing ever leaves your machine.

## Features

- Record microphone audio and, where supported by the operating system, system audio (speaker output) directly from Obsidian.
- Send the captured audio to a configurable local Whisper API for transcription.
- Summarise the transcript with a configurable local LLM (for example an [Ollama](https://ollama.com/) model).
- Automatically create a meeting note containing:
  - YAML front matter with timestamps, duration and the audio file path.
  - A Markdown summary with sections for key topics, action items and decisions.
  - The full transcript for later review.
- Optional automatic opening of the generated note once processing completes.

## Requirements

The plugin delegates all AI work to services that you run locally:

- **Transcription** – any Whisper-compatible HTTP endpoint that accepts a multipart file upload under the field name `file` and returns JSON containing either a `text`, `transcript` or `result` field. Examples include:
  - [`whisper.cpp` server mode](https://github.com/ggerganov/whisper.cpp#server) (`./server -m models/ggml-base.en.bin`)
  - [OpenAI Whisper API](https://github.com/openai/whisper) front-ends such as [`faster-whisper`](https://github.com/guillaumekln/faster-whisper) servers.
- **Summarisation** – any LLM endpoint that accepts `POST` requests with a JSON payload `{ model, prompt, stream: false }` and returns JSON with either a `response`, `text` or `summary` field. Tested with [Ollama's HTTP API](https://github.com/jmorganca/ollama/blob/main/docs/api.md).

Both endpoints default to `http://localhost` URLs and can be adjusted in the plugin settings.

## Installation

1. Clone or download this repository.
2. Install dependencies and build the plugin:

   ```bash
   npm install
   npm run build
   ```

3. Copy the resulting `main.js`, `manifest.json`, and `styles.css` files to your vault at `<vault>/.obsidian/plugins/ai-meeting-notes/`.
4. Reload Obsidian, enable **AI Meeting Notes** in *Settings → Community plugins*, and adjust the plugin settings to point at your local AI services.

## Usage

1. Ensure your local Whisper service and LLM endpoint are running.
2. In Obsidian, click the microphone ribbon icon or run the command **Start meeting recording** to begin capturing audio.
3. When the meeting ends, click the ribbon icon again or run **Stop meeting recording and generate notes**. The plugin will:
   - Stop the recorder and save the audio file in the configured folder.
   - Upload the audio to the Whisper endpoint for transcription.
   - Send the transcript to the LLM endpoint for a Markdown summary.
   - Create a new note in the configured folder that links to the audio and includes the transcript.
4. Use **Cancel active meeting recording** if you want to discard the current capture without saving anything.

## Configuration

All settings are available under *Settings → Community plugins → AI Meeting Notes*:

- **Recordings folder** – where audio files are stored.
- **Notes folder** – where generated meeting notes are saved.
- **Capture system audio** – attempt to capture speaker/system audio in addition to the microphone (may require sharing system audio via your OS prompt).
- **Transcription endpoint/model/language** – configure the local Whisper service URL and optional parameters.
- **Summarisation endpoint/model/prompt** – configure the LLM endpoint and prompt template (use `{{transcript}}` to inject the transcript).
- **Max transcript length for summary** – prevent sending very long transcripts to models with small context windows.
- **Open note after creation** – automatically open the generated note.
- **Link audio in notes** – insert a Markdown link to the audio file inside the note body.

## Development

The plugin uses TypeScript and esbuild for bundling.

```bash
npm install
npm run dev
```

The `dev` script runs esbuild in watch mode and updates `main.js` as you edit files inside `src/`.

## Privacy

All processing happens locally. The plugin never sends audio or notes over the network—only to the endpoints you configure, which are expected to run on the same machine.

## License

MIT
