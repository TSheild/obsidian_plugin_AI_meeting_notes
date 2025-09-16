import { App, PluginSettingTab, Setting } from "obsidian";
import type AIMeetingNotesPlugin from "./main";

export interface AIMeetingNotesSettings {
  recordingsFolder: string;
  transcriptsFolder: string;
  notesFolder: string;
  captureSystemAudioByDefault: boolean;
  transcriptionCommand: string;
  transcriptionArgs: string;
  transcriptionOutputExtension: string;
  summarizationCommand: string;
  summarizationArgs: string;
  summarizationOutputExtension: string;
  openNoteAfterCreation: boolean;
  autoEmbedAudio: boolean;
  includeTranscriptInNote: boolean;
  cliWorkingDirectory: string;
  commandTimeoutSeconds: number;
}

export const DEFAULT_SETTINGS: AIMeetingNotesSettings = {
  recordingsFolder: "AI Meeting Notes/Recordings",
  transcriptsFolder: "AI Meeting Notes/Transcripts",
  notesFolder: "AI Meeting Notes/Notes",
  captureSystemAudioByDefault: true,
  transcriptionCommand: "",
  transcriptionArgs:
    "--model base.en --language en --output_txt --output_dir {{outputDir}} {{audioFile}}",
  transcriptionOutputExtension: "txt",
  summarizationCommand: "",
  summarizationArgs:
    "--prompt-file {{transcriptFile}} --output {{outputFile}}",
  summarizationOutputExtension: "md",
  openNoteAfterCreation: true,
  autoEmbedAudio: true,
  includeTranscriptInNote: true,
  cliWorkingDirectory: "",
  commandTimeoutSeconds: 300,
};

export class AIMeetingNotesSettingTab extends PluginSettingTab {
  private plugin: AIMeetingNotesPlugin;

  constructor(app: App, plugin: AIMeetingNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl("h2", { text: "AI Meeting Notes" });
    containerEl.createEl("p", {
      text:
        "Configure how audio is recorded and how your local transcription and summarisation tools are invoked.",
    });

    new Setting(containerEl)
      .setName("Recordings folder")
      .setDesc("Vault-relative folder where raw audio files will be stored.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.recordingsFolder)
          .setValue(this.plugin.settings.recordingsFolder)
          .onChange(async (value) => {
            this.plugin.settings.recordingsFolder = value.trim() || DEFAULT_SETTINGS.recordingsFolder;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Transcripts folder")
      .setDesc("Vault-relative folder where generated transcript files will be saved.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.transcriptsFolder)
          .setValue(this.plugin.settings.transcriptsFolder)
          .onChange(async (value) => {
            this.plugin.settings.transcriptsFolder = value.trim() || DEFAULT_SETTINGS.transcriptsFolder;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Meeting notes folder")
      .setDesc("Vault-relative folder where the final meeting note will be created.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.notesFolder)
          .setValue(this.plugin.settings.notesFolder)
          .onChange(async (value) => {
            this.plugin.settings.notesFolder = value.trim() || DEFAULT_SETTINGS.notesFolder;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Capture system audio by default")
      .setDesc("When enabled, the plugin will request permission to capture speaker output as well as the microphone.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.captureSystemAudioByDefault)
          .onChange(async (value) => {
            this.plugin.settings.captureSystemAudioByDefault = value;
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Transcription" });

    new Setting(containerEl)
      .setName("Transcription command")
      .setDesc(
        "Path to the executable that performs speech-to-text (for example the whisper.cpp CLI). Leave empty to disable automatic transcription.",
      )
      .addText((text) =>
        text
          .setPlaceholder("/usr/local/bin/whisper")
          .setValue(this.plugin.settings.transcriptionCommand)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionCommand = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Transcription arguments")
      .setDesc(
        "Arguments passed to the transcription command. The placeholders {{audioFile}}, {{outputDir}} and {{baseName}} will be replaced automatically.",
      )
      .addTextArea((textArea) =>
        textArea
          .setPlaceholder(DEFAULT_SETTINGS.transcriptionArgs)
          .setValue(this.plugin.settings.transcriptionArgs)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionArgs = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Transcription output extension")
      .setDesc("File extension (without dot) that the transcription command produces, e.g. txt or json.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.transcriptionOutputExtension)
          .setValue(this.plugin.settings.transcriptionOutputExtension)
          .onChange(async (value) => {
            const cleaned = value.trim() || DEFAULT_SETTINGS.transcriptionOutputExtension;
            this.plugin.settings.transcriptionOutputExtension = cleaned.replace(/^\./, "");
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Summarisation" });

    new Setting(containerEl)
      .setName("Summarisation command")
      .setDesc(
        "Path to the executable for your local LLM that produces a summary and action items. Leave empty to fall back to a simple heuristic summary.",
      )
      .addText((text) =>
        text
          .setPlaceholder("/usr/local/bin/llm")
          .setValue(this.plugin.settings.summarizationCommand)
          .onChange(async (value) => {
            this.plugin.settings.summarizationCommand = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Summarisation arguments")
      .setDesc(
        "Arguments passed to the summarisation command. Available placeholders: {{transcriptFile}}, {{outputDir}}, {{baseName}}, {{outputFile}}.",
      )
      .addTextArea((textArea) =>
        textArea
          .setPlaceholder(DEFAULT_SETTINGS.summarizationArgs)
          .setValue(this.plugin.settings.summarizationArgs)
          .onChange(async (value) => {
            this.plugin.settings.summarizationArgs = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Summarisation output extension")
      .setDesc("Extension (without dot) for the file produced by the summarisation command. Defaults to md.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.summarizationOutputExtension)
          .setValue(this.plugin.settings.summarizationOutputExtension)
          .onChange(async (value) => {
            const cleaned = value.trim() || DEFAULT_SETTINGS.summarizationOutputExtension;
            this.plugin.settings.summarizationOutputExtension = cleaned.replace(/^\./, "");
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Meeting note" });

    new Setting(containerEl)
      .setName("Open note after creation")
      .setDesc("Automatically open the generated meeting note when processing finishes.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openNoteAfterCreation)
          .onChange(async (value) => {
            this.plugin.settings.openNoteAfterCreation = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Embed audio in note")
      .setDesc("Insert an embedded player pointing to the recorded audio file in the generated note.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoEmbedAudio)
          .onChange(async (value) => {
            this.plugin.settings.autoEmbedAudio = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Include transcript in note")
      .setDesc("Append the raw transcript to the bottom of the generated note.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeTranscriptInNote)
          .onChange(async (value) => {
            this.plugin.settings.includeTranscriptInNote = value;
            await this.plugin.saveSettings();
          }),
      );

    containerEl.createEl("h3", { text: "Advanced" });

    new Setting(containerEl)
      .setName("CLI working directory")
      .setDesc("Optional directory from which transcription and summarisation commands are executed.")
      .addText((text) =>
        text
          .setPlaceholder("Leave empty to use the vault root")
          .setValue(this.plugin.settings.cliWorkingDirectory)
          .onChange(async (value) => {
            this.plugin.settings.cliWorkingDirectory = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Command timeout (seconds)")
      .setDesc("Maximum number of seconds to wait for transcription or summarisation commands before aborting.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.commandTimeoutSeconds.toString())
          .setValue(String(this.plugin.settings.commandTimeoutSeconds))
          .onChange(async (value) => {
            const parsed = Number(value);
            if (!Number.isNaN(parsed) && parsed > 0) {
              this.plugin.settings.commandTimeoutSeconds = Math.round(parsed);
              await this.plugin.saveSettings();
            }
          }),
      );
  }
}
