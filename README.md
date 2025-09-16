# AI Meeting Notes for Obsidian

AI Meeting Notes turns Obsidian into a fully local meeting assistant. The plugin records both microphone input and system audio, runs the recording through your locally installed Whisper transcription tool, and then summarizes the conversation with a local large language model (LLM) such as Ollama. The result is a Markdown note containing a clean summary, action items, and the complete transcript alongside links to the saved audio file.

## Features

- 📼 **Dual-channel capture** – Records microphone input and (where supported by the OS) system audio output at the same time.
- 📝 **Local transcription** – Calls a user-configurable Whisper CLI (or compatible tool) to turn recordings into text.
- 🤖 **Local meeting notes** – Sends the transcript to a locally hosted LLM process to generate summaries, action items, and decisions.
- 🗂️ **Organized output** – Stores audio, transcripts, and generated notes in folders of your choice and links everything together automatically.
- ⚙️ **Flexible command templates** – Customize the exact command line arguments sent to Whisper and your LLM, including placeholders for file paths and timestamps.
- 🧩 **Obsidian friendly** – Adds status bar feedback, commands for the command palette, and optional automatic opening of the generated note.

## Requirements

Because every workflow is different, the plugin delegates AI workloads to tools you already trust. You will need:

1. **Obsidian desktop** – Capturing system audio and executing local binaries require the desktop app. The plugin is marked as desktop-only.
2. **A Whisper-compatible CLI** – Any executable that accepts an audio file path and produces a transcript (for example `whisper` from OpenAI or `main` from whisper.cpp). Configure the command in the plugin settings.
3. **A local LLM CLI** – An executable that reads a prompt from STDIN and writes Markdown to STDOUT. The defaults target `ollama run llama3` but you can swap in anything that matches this contract.

> ⚠️ The plugin does not bundle machine learning models. Make sure the commands you configure are available on your PATH or referenced with an absolute path.

## Installation

1. Clone or download this repository.
2. Run `npm install` to install development dependencies.
3. Build the plugin with `npm run build`. This creates `main.js` in the project root.
4. Copy `main.js`, `manifest.json`, `styles.css`, and the `data.json` file created by Obsidian (after first run) into your vault under `Vault/.obsidian/plugins/ai-meeting-notes/`.
5. Reload Obsidian and enable **AI Meeting Notes** from *Settings → Community Plugins*.

## Configuration

Open the plugin settings to configure:

- **Record system audio** – Toggle whether to attempt capturing speaker output in addition to your microphone.
- **Audio format** – Choose between WebM or OGG containers for the saved recording.
- **Folder locations** – Set the vault folders used to store recordings, transcripts, and generated meeting notes.
- **Whisper command & arguments** – Provide the executable name/path and an argument template. You can use placeholders such as:
  - `{{audioFilePath}}` – Absolute path to the recorded audio file.
  - `{{outputDir}}` – Absolute path to the transcripts folder.
  - `{{model}}` – The value from the *Whisper model* setting.
  - `{{title}}`, `{{baseName}}`, `{{durationMinutes}}` – Helpful metadata about the session.
- **Summarizer command & arguments** – Similar template for the LLM CLI. Arguments are tokenized using shell-like rules.
- **Summary prompt** – Markdown-aware prompt template delivered to your LLM. The transcript is injected via `{{transcript}}`.
- **Note behavior** – Decide whether to append the full transcript to the generated note and whether to open the note automatically when processing completes.

### Example configuration

- Whisper command: `whisper`
- Whisper arguments: `--model {{model}} --language en --output_dir "{{outputDir}}" --output_format txt "{{audioFilePath}}"`
- Summarizer command: `ollama`
- Summarizer arguments: `run llama3`

With this setup the plugin will write an audio recording to `AI Meeting Notes/Audio/`, ask Whisper to generate a transcript in `AI Meeting Notes/Transcripts/`, and then stream the transcript into Ollama to obtain Markdown meeting notes.

## Usage

1. Start recording by clicking the microphone ribbon icon or running the **Start meeting recording** command.
2. Conduct your meeting. The status bar shows when the plugin is actively recording.
3. Stop recording via the ribbon icon or the **Stop meeting recording** command.
4. Whisper is invoked automatically, followed by the summarizer. When finished, a new Markdown file appears in your configured notes folder containing:
   - Front matter with links to the audio and transcript files.
   - A resources section with quick links.
   - The generated summary, action items, and decisions from your LLM.
   - (Optional) The full transcript appended to the end of the note.

## Development

- `npm run dev` – Watch for changes and rebuild automatically.
- `npm run build` – Type-check the project and produce a production bundle.

Source code lives in the `src/` directory. The TypeScript entry point is `src/main.ts` and is bundled into `main.js` via esbuild.

## Troubleshooting

- **System audio is missing** – Not every operating system or hardware configuration exposes system audio capture. Try disabling the setting to fall back to microphone-only recordings.
- **Command not found** – Provide full paths to your Whisper or LLM executables if they are not on the PATH used by Obsidian.
- **Transcription file not created** – Double-check the `--output_dir` argument and that the configured folder exists inside your vault. The plugin surfaces command stderr in Obsidian notices for easier debugging.

## License

This project is released under the MIT License. See [LICENSE](LICENSE) for details.
