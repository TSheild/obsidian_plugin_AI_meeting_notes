import { Notice, Plugin, TFile } from "obsidian";
import { RecorderController } from "./audio/RecorderController";
import { MeetingNoteService } from "./services/MeetingNoteService";
import { SummarizationService } from "./services/SummarizationService";
import { TranscriptionService } from "./services/TranscriptionService";
import {
  AIMeetingNotesSettingTab,
  AIMeetingNotesSettings,
  DEFAULT_SETTINGS,
} from "./settings";
import type { RecordingOptions, RecordingLifecycleState } from "./types";
import { VaultFileManager } from "./utils/vault";
import { RecordingModal } from "./ui/RecordingModal";

interface ActiveSession {
  recorder: RecorderController;
  options: RecordingOptions;
  startedAt: Date;
  statusCallback?: (state: RecordingLifecycleState) => void;
}

export default class AIMeetingNotesPlugin extends Plugin {
  settings: AIMeetingNotesSettings;
  private fileManager!: VaultFileManager;
  private transcriptionService!: TranscriptionService;
  private summarizationService!: SummarizationService;
  private meetingNoteService!: MeetingNoteService;
  private activeSession: ActiveSession | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.fileManager = new VaultFileManager(this.app);
    this.transcriptionService = new TranscriptionService(this, this.fileManager);
    this.summarizationService = new SummarizationService(this, this.fileManager);
    this.meetingNoteService = new MeetingNoteService(this, this.fileManager);

    this.addRibbonIcon("microphone", "AI Meeting Notes", () => {
      this.openRecordingModal();
    });

    this.addCommand({
      id: "ai-meeting-notes-open-modal",
      name: "Open AI meeting recorder",
      callback: () => this.openRecordingModal(),
    });

    this.addCommand({
      id: "ai-meeting-notes-stop-recording",
      name: "Stop active recording and process",
      callback: async () => {
        if (!this.activeSession) {
          new Notice("No active recording session.");
          return;
        }
        try {
          await this.stopRecordingSession();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          new Notice(`Failed to finish recording: ${message}`);
        }
      },
    });

    this.addSettingTab(new AIMeetingNotesSettingTab(this.app, this));
  }

  onunload(): void {
    if (this.activeSession) {
      this.activeSession.recorder.cancel();
      this.activeSession = null;
    }
  }

  openRecordingModal(): void {
    new RecordingModal(this.app, this).open();
  }

  async startRecordingSession(
    options: RecordingOptions,
    statusCallback: (state: RecordingLifecycleState) => void,
  ): Promise<void> {
    if (this.activeSession) {
      throw new Error("A recording session is already in progress.");
    }

    const recorder = new RecorderController();

    try {
      await recorder.start({ captureSystemAudio: options.captureSystemAudio, mimeType: "audio/webm;codecs=opus" });
      await recorder.begin();
    } catch (error) {
      recorder.cancel();
      throw error instanceof Error ? error : new Error(String(error));
    }

    const startedAt = recorder.getStartTime() ?? new Date();
    this.activeSession = { recorder, options, startedAt, statusCallback };

    if (!this.settings.transcriptionCommand) {
      new Notice("Transcription command is not configured. Processing will fail until it is set in settings.");
    }

    statusCallback({ state: "recording", startedAt, message: "Recording in progress…" });
  }

  async stopRecordingSession(): Promise<void> {
    if (!this.activeSession) {
      throw new Error("There is no active recording session to stop.");
    }

    const session = this.activeSession;
    this.activeSession = null;

    try {
      session.statusCallback?.({ state: "processing", step: "stopping", message: "Finalising recording…" });
      const blob = await session.recorder.stop();
      const endedAt = new Date();

      session.statusCallback?.({ state: "processing", step: "saving", message: "Saving audio file…" });
      const audioVaultPath = await this.persistAudio(blob, session.startedAt);

      session.statusCallback?.({ state: "processing", step: "transcribing", message: "Running transcription…" });
      const transcription = await this.transcriptionService.transcribe(audioVaultPath);

      session.statusCallback?.({ state: "processing", step: "summarising", message: "Generating summary…" });
      const summary = await this.summarizationService.summarise(transcription);

      session.statusCallback?.({ state: "processing", step: "writing-note", message: "Creating meeting note…" });
      const baseName = this.deriveBaseName(audioVaultPath);
      const notePath = await this.meetingNoteService.createMeetingNote({
        baseName,
        audioVaultPath,
        transcription,
        summary,
        startedAt: session.startedAt,
        endedAt,
      });

      session.statusCallback?.({
        state: "completed",
        message: `Meeting note saved to ${notePath}`,
        notePath,
        transcription,
        summary,
      });
      new Notice(`Meeting note created: ${notePath}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      session.statusCallback?.({ state: "error", message: err.message, error: err });
      throw err;
    }
  }

  async openNote(notePath: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(notePath);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(true).openFile(file);
    } else {
      new Notice(`Unable to open note at ${notePath}`);
    }
  }

  private async persistAudio(blob: Blob, startedAt: Date): Promise<string> {
    const recordingsFolder = this.fileManager.getNormalizedPath(this.settings.recordingsFolder);
    await this.fileManager.ensureFolder(recordingsFolder);

    const timestamp = this.formatTimestamp(startedAt);
    const fileName = `${this.sanitizeBaseName(`meeting-${timestamp}`)}.webm`;
    const vaultPath = recordingsFolder === "." ? fileName : `${recordingsFolder}/${fileName}`;

    const arrayBuffer = await blob.arrayBuffer();
    await this.fileManager.writeBinary(vaultPath, arrayBuffer);
    return vaultPath;
  }

  private deriveBaseName(vaultPath: string): string {
    const parts = vaultPath.split("/");
    const fileName = parts[parts.length - 1] ?? vaultPath;
    return this.sanitizeBaseName(fileName.replace(/\.[^/.]+$/, ""));
  }

  private sanitizeBaseName(value: string): string {
    return value.replace(/[^a-zA-Z0-9-_]/g, "-");
  }

  private formatTimestamp(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hours = `${date.getHours()}`.padStart(2, "0");
    const minutes = `${date.getMinutes()}`.padStart(2, "0");
    const seconds = `${date.getSeconds()}`.padStart(2, "0");
    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
