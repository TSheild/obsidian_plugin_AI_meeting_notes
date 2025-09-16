import { MarkdownView, Notice, Plugin } from "obsidian";
import { MeetingRecorder } from "./audio/meeting-recorder";
import { MeetingSummaryModal } from "./ui/meeting-summary-modal";
import { MeetingNotesSettingTab, DEFAULT_SETTINGS, MeetingNotesSettings } from "./settings";
import { TranscriptionService } from "./services/transcription-service";
import { SummarizationService } from "./services/summarization-service";
import { createMeetingNotesContent } from "./utils/notes";
import { MeetingNotesContent, RecordingResult, TranscriptionResult } from "./types";

export default class AIMeetingNotesPlugin extends Plugin {
  settings: MeetingNotesSettings = DEFAULT_SETTINGS;
  private recorder: MeetingRecorder | null = null;
  private statusBarEl?: HTMLElement;
  private ribbonIconEl?: HTMLElement;
  private state: "idle" | "recording" | "processing" = "idle";

  async onload() {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar();

    this.ribbonIconEl = this.addRibbonIcon("lucide-mic", "Start AI meeting recording", () => {
      void this.toggleRecording();
    });
    this.ribbonIconEl.addClass("ai-meeting-notes-ribbon");

    this.addCommand({
      id: "ai-meeting-notes-start",
      name: "Start meeting recording",
      checkCallback: (checking) => {
        if (this.state !== "idle") {
          return false;
        }
        if (!checking) {
          void this.startRecording();
        }
        return true;
      },
    });

    this.addCommand({
      id: "ai-meeting-notes-stop",
      name: "Stop meeting recording",
      checkCallback: (checking) => {
        if (this.state !== "recording") {
          return false;
        }
        if (!checking) {
          void this.stopRecording();
        }
        return true;
      },
    });

    this.addCommand({
      id: "ai-meeting-notes-toggle",
      name: "Toggle meeting recording",
      callback: () => {
        void this.toggleRecording();
      },
    });

    this.addSettingTab(new MeetingNotesSettingTab(this.app, this));
  }

  async onunload() {
    if (this.recorder && this.recorder.isRecording()) {
      try {
        await this.recorder.stop();
      } catch (error) {
        console.error("AI Meeting Notes: failed to stop recorder during unload", error);
      }
    }

    this.recorder = null;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async toggleRecording() {
    if (this.state === "idle") {
      await this.startRecording();
    } else if (this.state === "recording") {
      await this.stopRecording();
    }
  }

  private async startRecording() {
    if (this.state !== "idle") {
      new Notice("A recording session is already active.");
      return;
    }

    this.recorder = new MeetingRecorder({
      onWarning: (message) => new Notice(message, 8000),
      onLog: (message, data) => console.debug(`AI Meeting Notes: ${message}`, data),
    });

    try {
      await this.recorder.start({
        useMicrophone: this.settings.useMicrophone,
        useSystemAudio: this.settings.useSystemAudio,
      });
      this.setState("recording");
      new Notice("AI Meeting Notes recording started.");
    } catch (error) {
      console.error("AI Meeting Notes: unable to start recording", error);
      this.recorder = null;
      new Notice(error instanceof Error ? error.message : "Failed to start recording.");
      this.setState("idle");
    }
  }

  private async stopRecording() {
    if (!this.recorder || !this.recorder.isRecording()) {
      new Notice("No active AI Meeting Notes recording to stop.");
      this.setState("idle");
      return;
    }

    this.setState("processing");

    let recording: RecordingResult;
    try {
      recording = await this.recorder.stop();
    } catch (error) {
      console.error("AI Meeting Notes: failed to stop recording", error);
      new Notice("Stopping the recording failed. See console for details.");
      this.setState("idle");
      return;
    } finally {
      this.recorder = null;
    }

    let transcription: TranscriptionResult;
    try {
      const transcriptionService = new TranscriptionService(this.settings);
      transcription = await transcriptionService.transcribe(recording);
    } catch (error) {
      console.error("AI Meeting Notes: transcription failed", error);
      new Notice(error instanceof Error ? error.message : "Transcription failed.");
      this.setState("idle");
      return;
    }

    let notes: MeetingNotesContent;
    try {
      const summarizationService = new SummarizationService(this.settings);
      const summary = await summarizationService.summarize(transcription, recording);
      notes = createMeetingNotesContent({
        summary,
        transcription,
        recording,
        settings: this.settings,
      });
    } catch (error) {
      console.error("AI Meeting Notes: summarization failed", error);
      new Notice(error instanceof Error ? error.message : "Summarization failed.");
      this.setState("idle");
      return;
    }

    await this.handleMeetingNotes(notes);
    this.setState("idle");
  }

  private async handleMeetingNotes(notes: MeetingNotesContent) {
    if (this.settings.autoAppendToActiveFile) {
      await this.appendToActiveFile(notes);
    }

    const modal = new MeetingSummaryModal(this.app, notes, {
      onInsert: async () => {
        await this.appendToActiveFile(notes);
      },
    });
    modal.open();
  }

  private async appendToActiveFile(notes: MeetingNotesContent) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
      new Notice("No active Markdown note to append meeting notes.");
      return;
    }

    const editor = view.editor;
    const lastLine = editor.lastLine();
    const lastLineLength = editor.getLine(lastLine).length;
    const insertion = this.buildInsertion(editor.getValue(), notes.markdown);

    editor.replaceRange(insertion, { line: lastLine, ch: lastLineLength });
  }

  private buildInsertion(existing: string, markdown: string): string {
    if (existing.length === 0) {
      return `${markdown}\n`;
    }

    if (existing.endsWith("\n\n")) {
      return `${markdown}\n`;
    }

    if (existing.endsWith("\n")) {
      return `\n${markdown}\n`;
    }

    return `\n\n${markdown}\n`;
  }

  private setState(state: "idle" | "recording" | "processing") {
    this.state = state;
    this.updateStatusBar();
    this.updateRibbonTooltip();
    this.updateRibbonAppearance();
  }

  private updateStatusBar() {
    if (!this.statusBarEl) {
      return;
    }

    switch (this.state) {
      case "recording":
        this.statusBarEl.setText("AI Notes: Recording…");
        break;
      case "processing":
        this.statusBarEl.setText("AI Notes: Processing…");
        break;
      default:
        this.statusBarEl.setText("AI Notes: Idle");
        break;
    }
  }

  private updateRibbonTooltip() {
    if (!this.ribbonIconEl) {
      return;
    }

    const tooltip =
      this.state === "recording"
        ? "Stop AI meeting recording"
        : this.state === "processing"
        ? "Processing meeting audio"
        : "Start AI meeting recording";
    this.ribbonIconEl.setAttribute("aria-label", tooltip);
    this.ribbonIconEl.setAttribute("data-tooltip", tooltip);
  }

  private updateRibbonAppearance() {
    if (!this.ribbonIconEl) {
      return;
    }

    this.ribbonIconEl.classList.toggle("ai-meeting-notes-recording", this.state === "recording");
    this.ribbonIconEl.classList.toggle("ai-meeting-notes-processing", this.state === "processing");
  }
}
