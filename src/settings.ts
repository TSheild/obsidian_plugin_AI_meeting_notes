import { App, PluginSettingTab, Setting } from "obsidian";
import type AIMeetingNotesPlugin from "./main";

export interface MeetingNotesSettings {
  transcriptionEndpoint: string;
  transcriptionAuthToken: string;
  summarizationEndpoint: string;
  summarizationAuthToken: string;
  useMicrophone: boolean;
  useSystemAudio: boolean;
  autoAppendToActiveFile: boolean;
  includeTranscriptInNotes: boolean;
  summaryHeading: string;
  actionItemsHeading: string;
  transcriptHeading: string;
}

export const DEFAULT_SETTINGS: MeetingNotesSettings = {
  transcriptionEndpoint: "http://localhost:5001/transcribe",
  transcriptionAuthToken: "",
  summarizationEndpoint: "http://localhost:5002/summarize",
  summarizationAuthToken: "",
  useMicrophone: true,
  useSystemAudio: true,
  autoAppendToActiveFile: false,
  includeTranscriptInNotes: true,
  summaryHeading: "## Meeting Summary",
  actionItemsHeading: "## Action Items",
  transcriptHeading: "## Transcript",
};

export class MeetingNotesSettingTab extends PluginSettingTab {
  plugin: AIMeetingNotesPlugin;

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
        "Configure how the plugin records audio and communicates with your local transcription and summarization services.",
    });

    new Setting(containerEl)
      .setName("Transcription endpoint")
      .setDesc(
        "Local HTTP endpoint that accepts an audio file via POST and returns JSON with a `text` property containing the transcript.",
      )
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:5001/transcribe")
          .setValue(this.plugin.settings.transcriptionEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionEndpoint = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Transcription Authorization header")
      .setDesc(
        "Optional bearer token that will be sent as the Authorization header when calling the transcription endpoint.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Bearer your-token")
          .setValue(this.plugin.settings.transcriptionAuthToken)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionAuthToken = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Summarization endpoint")
      .setDesc(
        "Local HTTP endpoint that receives a transcript via POST JSON and returns JSON with `summary` and `actionItems` fields.",
      )
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:5002/summarize")
          .setValue(this.plugin.settings.summarizationEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.summarizationEndpoint = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Summarization Authorization header")
      .setDesc(
        "Optional bearer token that will be sent as the Authorization header when calling the summarization endpoint.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Bearer your-token")
          .setValue(this.plugin.settings.summarizationAuthToken)
          .onChange(async (value) => {
            this.plugin.settings.summarizationAuthToken = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Capture microphone audio")
      .setDesc("Record audio from the default microphone while a session is active.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.useMicrophone).onChange(async (value) => {
          this.plugin.settings.useMicrophone = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Capture system audio")
      .setDesc("Attempt to capture system / speaker audio using screen audio capture.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.useSystemAudio).onChange(async (value) => {
          this.plugin.settings.useSystemAudio = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Automatically append to active note")
      .setDesc("When enabled, processed meeting notes will be appended to the currently focused Markdown file.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoAppendToActiveFile).onChange(async (value) => {
          this.plugin.settings.autoAppendToActiveFile = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Include transcript in notes")
      .setDesc("Include the full transcript below the summary and action items when writing to a note.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.includeTranscriptInNotes).onChange(async (value) => {
          this.plugin.settings.includeTranscriptInNotes = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Summary heading")
      .setDesc("Markdown heading inserted before the generated summary.")
      .addText((text) =>
        text
          .setPlaceholder("## Meeting Summary")
          .setValue(this.plugin.settings.summaryHeading)
          .onChange(async (value) => {
            this.plugin.settings.summaryHeading = value || "## Meeting Summary";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Action items heading")
      .setDesc("Markdown heading inserted before the action items list.")
      .addText((text) =>
        text
          .setPlaceholder("## Action Items")
          .setValue(this.plugin.settings.actionItemsHeading)
          .onChange(async (value) => {
            this.plugin.settings.actionItemsHeading = value || "## Action Items";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Transcript heading")
      .setDesc("Markdown heading inserted above the transcript when it is included.")
      .addText((text) =>
        text
          .setPlaceholder("## Transcript")
          .setValue(this.plugin.settings.transcriptHeading)
          .onChange(async (value) => {
            this.plugin.settings.transcriptHeading = value || "## Transcript";
            await this.plugin.saveSettings();
          }),
      );
  }
}
