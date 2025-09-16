import { Notice, Plugin, TFile } from 'obsidian';
import { MeetingAudioRecorder } from './recorder';
import { DEFAULT_SETTINGS, MeetingNotesSettingTab, MeetingNotesSettings } from './settings';
import { notifyWithConsoleFallback, summariseTranscript, transcribeAudio } from './ai';
import { saveRecordingToVault, writeMeetingNote } from './note-writer';

export default class MeetingNotesPlugin extends Plugin {
        settings: MeetingNotesSettings;
        private recorder: MeetingAudioRecorder = new MeetingAudioRecorder();
        private statusBarItem: HTMLElement | null = null;
        private processing = false;

        async onload(): Promise<void> {
                await this.loadSettings();

                this.statusBarItem = this.addStatusBarItem();
                this.updateStatusBar('Idle');

                this.addRibbonIcon('mic', 'Toggle meeting recording', () => {
                        void this.toggleRecording();
                });

                this.addCommand({
                        id: 'start-meeting-recording',
                        name: 'Start meeting recording',
                        callback: () => {
                                void this.startRecording();
                        }
                });

                this.addCommand({
                        id: 'stop-meeting-recording',
                        name: 'Stop meeting recording and generate notes',
                        callback: () => {
                                void this.stopRecordingAndProcess();
                        }
                });

                this.addCommand({
                        id: 'cancel-meeting-recording',
                        name: 'Cancel active meeting recording',
                        callback: () => {
                                void this.cancelRecording();
                        }
                });

                this.addSettingTab(new MeetingNotesSettingTab(this.app, this));
        }

        onunload(): void {
                void this.recorder.cancel();
        }

        private updateStatusBar(status: string): void {
                if (this.statusBarItem) {
                        this.statusBarItem.setText(`Meeting Notes: ${status}`);
                }
        }

        private async toggleRecording(): Promise<void> {
                if (this.processing) {
                        new Notice('Processing current recording. Please wait...');
                        return;
                }
                if (this.recorder.isRecording) {
                        await this.stopRecordingAndProcess();
                } else {
                        await this.startRecording();
                }
        }

        private async startRecording(): Promise<void> {
                if (this.processing) {
                        new Notice('Cannot start a new recording while processing.');
                        return;
                }
                if (this.recorder.isRecording) {
                        new Notice('Recording is already active.');
                        return;
                }

                try {
                        await this.recorder.start(this.settings.includeSystemAudio);
                        notifyWithConsoleFallback('Recording started. Use the command palette or ribbon icon to stop.', 'info');
                        this.updateStatusBar('Recording');
                } catch (error) {
                        console.error('Failed to start recording', error);
                        new Notice('Failed to start recording. Check microphone permissions.');
                }
        }

        private async stopRecordingAndProcess(): Promise<void> {
                if (!this.recorder.isRecording) {
                        new Notice('No active recording to stop.');
                        return;
                }
                if (this.processing) {
                        new Notice('Already processing a recording.');
                        return;
                }

                this.processing = true;
                this.updateStatusBar('Processing');
                notifyWithConsoleFallback('Stopping recording and processing audio...', 'info');

                try {
                        const recording = await this.recorder.stop();
                        const audioPath = await saveRecordingToVault(this.app, this.settings, recording);

                        notifyWithConsoleFallback('Transcribing audio with Whisper...', 'info');
                        const transcript = await transcribeAudio(recording.blob, this.settings);

                        let summary: string | undefined;
                        try {
                                notifyWithConsoleFallback('Summarising transcript with local LLM...', 'info');
                                summary = await summariseTranscript(transcript, this.settings);
                        } catch (summaryError) {
                                console.error('Failed to summarise transcript', summaryError);
                                new Notice('Summarisation failed. The transcript will be saved without an AI summary.');
                        }

                        const noteFile = await writeMeetingNote(this.app, this.settings, {
                                transcript,
                                summary,
                                audioPath,
                                recording
                        });

                        if (this.settings.autoOpenNote) {
                                await this.openFileInWorkspace(noteFile);
                        }

                        notifyWithConsoleFallback(`Meeting note created: ${noteFile.basename}`, 'info');
                } catch (error) {
                        console.error('Failed to process recording', error);
                        new Notice(`Failed to process recording: ${(error as Error).message}`);
                } finally {
                        this.processing = false;
                        this.updateStatusBar('Idle');
                }
        }

        private async cancelRecording(): Promise<void> {
                if (!this.recorder.isRecording) {
                        new Notice('There is no recording to cancel.');
                        return;
                }

                await this.recorder.cancel();
                this.updateStatusBar('Idle');
                notifyWithConsoleFallback('Recording cancelled.', 'info');
        }

        async loadSettings(): Promise<void> {
                this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        }

        async saveSettings(): Promise<void> {
                await this.saveData(this.settings);
        }

        private async openFileInWorkspace(file: TFile): Promise<void> {
                const leaf = this.app.workspace.getLeaf(true);
                await leaf.openFile(file);
        }
}

export type { MeetingNotesSettings };
