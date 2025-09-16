import { App, PluginSettingTab, Setting } from 'obsidian';
import type MeetingNotesPlugin from './main';

export interface MeetingNotesSettings {
        recordingsFolder: string;
        notesFolder: string;
        includeSystemAudio: boolean;
        transcriptionEndpoint: string;
        transcriptionModel: string;
        transcriptionLanguage: string;
        summarizationEndpoint: string;
        summarizationModel: string;
        summarizationPrompt: string;
        summarizationMaxCharacters: number;
        autoOpenNote: boolean;
        linkAudioInNote: boolean;
}

export const DEFAULT_SETTINGS: MeetingNotesSettings = {
        recordingsFolder: 'Meeting Recordings',
        notesFolder: 'Meeting Notes',
        includeSystemAudio: true,
        transcriptionEndpoint: 'http://localhost:9000/transcribe',
        transcriptionModel: 'base.en',
        transcriptionLanguage: 'en',
        summarizationEndpoint: 'http://localhost:11434/api/generate',
        summarizationModel: 'llama3',
        summarizationPrompt: `You are an assistant that generates concise meeting notes.\n` +
                `Use the transcript to build Markdown with the sections:\n` +
                `## Summary\n- bullet points describing the most important topics\n` +
                `## Action Items\n- bullet list of follow-up tasks with owners if available\n` +
                `## Key Decisions\n- bullet list of decisions, or "None." if there were none.\n` +
                `Only reference information contained in the transcript.\n` +
                `Transcript:\n{{transcript}}`,
        summarizationMaxCharacters: 12000,
        autoOpenNote: true,
        linkAudioInNote: true,
};

export class MeetingNotesSettingTab extends PluginSettingTab {
        constructor(app: App, private readonly plugin: MeetingNotesPlugin) {
                super(app, plugin);
        }

        display(): void {
                const {containerEl} = this;
                containerEl.empty();

                containerEl.createEl('h2', {text: 'AI Meeting Notes'});

                new Setting(containerEl)
                        .setName('Recordings folder')
                        .setDesc('Folder where raw audio recordings will be stored. Created automatically if missing.')
                        .addText((text) => text
                                .setPlaceholder('Meeting Recordings')
                                .setValue(this.plugin.settings.recordingsFolder)
                                .onChange(async (value) => {
                                        this.plugin.settings.recordingsFolder = value.trim();
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Notes folder')
                        .setDesc('Folder where meeting notes will be created.')
                        .addText((text) => text
                                .setPlaceholder('Meeting Notes')
                                .setValue(this.plugin.settings.notesFolder)
                                .onChange(async (value) => {
                                        this.plugin.settings.notesFolder = value.trim();
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Capture system audio')
                        .setDesc('Attempt to include system audio (speakers) in recordings in addition to the microphone.')
                        .addToggle((toggle) => toggle
                                .setValue(this.plugin.settings.includeSystemAudio)
                                .onChange(async (value) => {
                                        this.plugin.settings.includeSystemAudio = value;
                                        await this.plugin.saveSettings();
                                }));

                containerEl.createEl('h3', {text: 'Transcription'});

                new Setting(containerEl)
                        .setName('Transcription endpoint')
                        .setDesc('URL of the local Whisper-compatible service that accepts multipart file uploads and returns JSON with a "text" field.')
                        .addText((text) => text
                                .setPlaceholder('http://localhost:9000/transcribe')
                                .setValue(this.plugin.settings.transcriptionEndpoint)
                                .onChange(async (value) => {
                                        this.plugin.settings.transcriptionEndpoint = value.trim();
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Whisper model')
                        .setDesc('Optional model identifier to send with the transcription request.')
                        .addText((text) => text
                                .setPlaceholder('base.en')
                                .setValue(this.plugin.settings.transcriptionModel)
                                .onChange(async (value) => {
                                        this.plugin.settings.transcriptionModel = value.trim();
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Language hint')
                        .setDesc('Optional BCP-47 language tag to hint to the transcription service (for example "en" or "es").')
                        .addText((text) => text
                                .setPlaceholder('en')
                                .setValue(this.plugin.settings.transcriptionLanguage)
                                .onChange(async (value) => {
                                        this.plugin.settings.transcriptionLanguage = value.trim();
                                        await this.plugin.saveSettings();
                                }));

                containerEl.createEl('h3', {text: 'Summarisation'});

                new Setting(containerEl)
                        .setName('Summarisation endpoint')
                        .setDesc('URL of the local LLM service (for example Ollama) used to build meeting notes.')
                        .addText((text) => text
                                .setPlaceholder('http://localhost:11434/api/generate')
                                .setValue(this.plugin.settings.summarizationEndpoint)
                                .onChange(async (value) => {
                                        this.plugin.settings.summarizationEndpoint = value.trim();
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Summarisation model')
                        .setDesc('Model name to request from the LLM endpoint.')
                        .addText((text) => text
                                .setPlaceholder('llama3')
                                .setValue(this.plugin.settings.summarizationModel)
                                .onChange(async (value) => {
                                        this.plugin.settings.summarizationModel = value.trim();
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Prompt template')
                        .setDesc('Use {{transcript}} as a placeholder for the transcript. The LLM should respond with Markdown.')
                        .addTextArea((text) => text
                                .setValue(this.plugin.settings.summarizationPrompt)
                                .onChange(async (value) => {
                                        this.plugin.settings.summarizationPrompt = value;
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Max transcript length for summary')
                        .setDesc('Limit the number of characters sent to the LLM to avoid context window issues.')
                        .addText((text) => text
                                .setPlaceholder('12000')
                                .setValue(String(this.plugin.settings.summarizationMaxCharacters))
                                .onChange(async (value) => {
                                        const parsed = Number(value);
                                        this.plugin.settings.summarizationMaxCharacters = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : this.plugin.settings.summarizationMaxCharacters;
                                        await this.plugin.saveSettings();
                                        text.setValue(String(this.plugin.settings.summarizationMaxCharacters));
                                }));

                new Setting(containerEl)
                        .setName('Open note after creation')
                        .setDesc('Open the generated note in the current workspace once processing is complete.')
                        .addToggle((toggle) => toggle
                                .setValue(this.plugin.settings.autoOpenNote)
                                .onChange(async (value) => {
                                        this.plugin.settings.autoOpenNote = value;
                                        await this.plugin.saveSettings();
                                }));

                new Setting(containerEl)
                        .setName('Link audio in notes')
                        .setDesc('Insert a link to the saved audio file at the top of generated notes.')
                        .addToggle((toggle) => toggle
                                .setValue(this.plugin.settings.linkAudioInNote)
                                .onChange(async (value) => {
                                        this.plugin.settings.linkAudioInNote = value;
                                        await this.plugin.saveSettings();
                                }));
        }
}
