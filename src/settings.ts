import { App, PluginSettingTab, Setting } from "obsidian";
import type MeetingNotesPlugin from "./main";

export type AudioFormat = "webm" | "ogg";

export interface MeetingNotesSettings {
  recordingsFolder: string;
  transcriptsFolder: string;
  notesFolder: string;
  includeSystemAudio: boolean;
  audioFormat: AudioFormat;
  whisperCommand: string;
  whisperArgs: string;
  whisperOutputFormat: string;
  whisperModel: string;
  summarizerCommand: string;
  summarizerArgs: string;
  summaryPrompt: string;
  includeTranscriptInNote: boolean;
  autoOpenNote: boolean;
}

export const DEFAULT_SUMMARY_PROMPT = [
  "You are an assistant that creates detailed meeting minutes from transcripts.",
  "Use the transcript below to craft a Markdown document with clearly labeled sections.",
  "Provide concise bullet lists and capture who said what when relevant.",
  "",
  "Transcript:",
  "{{transcript}}",
  "",
  "Write Markdown with the following structure:",
  "## Summary",
  "- key bullet points that capture the overall discussion",
  "",
  "## Action Items",
  "- bullet list of tasks, include owners and due dates when mentioned; if none, write '- None'",
  "",
  "## Decisions",
  "- bullet list of decisions made; if none, write '- None'",
].join("\n");

export const DEFAULT_SETTINGS: MeetingNotesSettings = {
  recordingsFolder: "AI Meeting Notes/Audio",
  transcriptsFolder: "AI Meeting Notes/Transcripts",
  notesFolder: "AI Meeting Notes/Summaries",
  includeSystemAudio: true,
  audioFormat: "webm",
  whisperCommand: "whisper",
  whisperArgs: '--model {{model}} --output_dir "{{outputDir}}" --output_format txt "{{audioFilePath}}"',
  whisperOutputFormat: "txt",
  whisperModel: "base",
  summarizerCommand: "ollama",
  summarizerArgs: "run llama3",
  summaryPrompt: DEFAULT_SUMMARY_PROMPT,
  includeTranscriptInNote: true,
  autoOpenNote: true,
};

export class MeetingNotesSettingTab extends PluginSettingTab {
  plugin: MeetingNotesPlugin;

  constructor(app: App, plugin: MeetingNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "AI Meeting Notes" });

    new Setting(containerEl)
      .setName("Record system audio")
      .setDesc("Attempt to capture system audio output in addition to the microphone.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeSystemAudio)
          .onChange(async (value) => {
            this.plugin.settings.includeSystemAudio = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Audio format")
      .setDesc("Choose the container format used for recordings.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("webm", "WebM (Opus)")
          .addOption("ogg", "Ogg (Opus)")
          .setValue(this.plugin.settings.audioFormat)
          .onChange(async (value) => {
            this.plugin.settings.audioFormat = value as AudioFormat;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Recordings folder")
      .setDesc("Vault folder where raw audio files are stored.")
      .addText((text) =>
        text
          .setPlaceholder("AI Meeting Notes/Audio")
          .setValue(this.plugin.settings.recordingsFolder)
          .onChange(async (value) => {
            this.plugin.settings.recordingsFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Transcripts folder")
      .setDesc("Vault folder where Whisper outputs transcripts.")
      .addText((text) =>
        text
          .setPlaceholder("AI Meeting Notes/Transcripts")
          .setValue(this.plugin.settings.transcriptsFolder)
          .onChange(async (value) => {
            this.plugin.settings.transcriptsFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Notes folder")
      .setDesc("Vault folder where final meeting notes are saved.")
      .addText((text) =>
        text
          .setPlaceholder("AI Meeting Notes/Summaries")
          .setValue(this.plugin.settings.notesFolder)
          .onChange(async (value) => {
            this.plugin.settings.notesFolder = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Transcription (Whisper)" });

    new Setting(containerEl)
      .setName("Whisper command")
      .setDesc("Executable used to run transcription (e.g., whisper or whisper.cpp).")
      .addText((text) =>
        text
          .setPlaceholder("whisper")
          .setValue(this.plugin.settings.whisperCommand)
          .onChange(async (value) => {
            this.plugin.settings.whisperCommand = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Whisper model")
      .setDesc("Model argument passed to Whisper (e.g., tiny, base, small).")
      .addText((text) =>
        text
          .setPlaceholder("base")
          .setValue(this.plugin.settings.whisperModel)
          .onChange(async (value) => {
            this.plugin.settings.whisperModel = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Whisper arguments template")
      .setDesc("Arguments passed to the transcription command. Use placeholders like {{audioFilePath}} and {{outputDir}}.")
      .addTextArea((text) =>
        text
          .setPlaceholder('--model {{model}} --output_dir "{{outputDir}}" --output_format txt "{{audioFilePath}}"')
          .setValue(this.plugin.settings.whisperArgs)
          .onChange(async (value) => {
            this.plugin.settings.whisperArgs = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Whisper output format")
      .setDesc("File extension produced by the transcription command (e.g., txt, json).")
      .addText((text) =>
        text
          .setPlaceholder("txt")
          .setValue(this.plugin.settings.whisperOutputFormat)
          .onChange(async (value) => {
            this.plugin.settings.whisperOutputFormat = value.trim() || "txt";
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Summarizer" });

    new Setting(containerEl)
      .setName("Summarizer command")
      .setDesc("Executable used for generating meeting notes (e.g., ollama).")
      .addText((text) =>
        text
          .setPlaceholder("ollama")
          .setValue(this.plugin.settings.summarizerCommand)
          .onChange(async (value) => {
            this.plugin.settings.summarizerCommand = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Summarizer arguments")
      .setDesc("Arguments passed to the summarizer command. Use placeholders like {{title}}.")
      .addText((text) =>
        text
          .setPlaceholder("run llama3")
          .setValue(this.plugin.settings.summarizerArgs)
          .onChange(async (value) => {
            this.plugin.settings.summarizerArgs = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Summary prompt")
      .setDesc("Template prompt sent to the summarizer. {{transcript}} will be replaced with the transcript text.")
      .addTextArea((text) => {
        text
          .setPlaceholder(DEFAULT_SUMMARY_PROMPT)
          .setValue(this.plugin.settings.summaryPrompt)
          .onChange(async (value) => {
            this.plugin.settings.summaryPrompt = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 8;
      });

    new Setting(containerEl)
      .setName("Include transcript in note")
      .setDesc("Append the full transcript to the generated meeting note.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeTranscriptInNote)
          .onChange(async (value) => {
            this.plugin.settings.includeTranscriptInNote = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Open note after creation")
      .setDesc("Automatically open the generated note in a new pane.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoOpenNote)
          .onChange(async (value) => {
            this.plugin.settings.autoOpenNote = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
