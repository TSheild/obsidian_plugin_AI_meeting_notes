import { App, Modal, Notice, Setting } from "obsidian";
import type AIMeetingNotesPlugin from "../main";
import type { RecordingLifecycleState } from "../types";

export class RecordingModal extends Modal {
  private captureSystemAudio: boolean;
  private isRecording = false;
  private statusEl!: HTMLDivElement;
  private logEl!: HTMLUListElement;
  private startButton!: HTMLButtonElement;
  private stopButton!: HTMLButtonElement;
  private resultEl: HTMLDivElement | null = null;

  private readonly statusHandler = (state: RecordingLifecycleState) => this.handleStatus(state);

  constructor(app: App, private readonly plugin: AIMeetingNotesPlugin) {
    super(app);
    this.captureSystemAudio = plugin.settings.captureSystemAudioByDefault;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ai-meeting-modal");

    contentEl.createEl("h2", { text: "AI Meeting Recorder" });
    contentEl.createEl("p", {
      text: "Record microphone and speaker audio, transcribe it locally, and capture meeting notes automatically.",
    });

    new Setting(contentEl)
      .setName("Capture system audio")
      .setDesc("Include speaker output alongside the microphone input when recording.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.captureSystemAudio)
          .onChange((value) => {
            this.captureSystemAudio = value;
          }),
      );

    const buttonRow = contentEl.createDiv({ cls: "ai-meeting-modal__buttons" });
    this.startButton = buttonRow.createEl("button", { text: "Start recording", cls: "ai-meeting-button" });
    this.stopButton = buttonRow.createEl("button", { text: "Stop & process", cls: "ai-meeting-button" });
    this.stopButton.disabled = true;

    this.startButton.addEventListener("click", () => this.handleStart());
    this.stopButton.addEventListener("click", () => this.handleStop());

    this.statusEl = contentEl.createDiv({ cls: "ai-meeting-modal__status" });
    this.statusEl.setText("Ready to record.");

    contentEl.createEl("h3", { text: "Activity" });
    this.logEl = contentEl.createEl("ul", { cls: "ai-meeting-modal__log" });
  }

  private async handleStart(): Promise<void> {
    this.startButton.disabled = true;
    if (this.resultEl) {
      this.resultEl.empty();
    }
    this.appendLog("Requesting recording permissions…");
    try {
      await this.plugin.startRecordingSession({ captureSystemAudio: this.captureSystemAudio }, this.statusHandler);
      this.stopButton.disabled = false;
      this.isRecording = true;
      this.appendLog("Recording started.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.statusEl.setText(`Failed to start recording: ${message}`);
      this.appendLog(`Error: ${message}`);
      new Notice(`Unable to start recording: ${message}`);
      this.startButton.disabled = false;
    }
  }

  private async handleStop(): Promise<void> {
    if (!this.isRecording) {
      new Notice("No active recording to stop.");
      return;
    }
    this.stopButton.disabled = true;
    this.appendLog("Stopping recording…");
    try {
      await this.plugin.stopRecordingSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.statusEl.setText(`Failed to process recording: ${message}`);
      this.appendLog(`Error: ${message}`);
      new Notice(`Processing failed: ${message}`);
      this.startButton.disabled = false;
      this.isRecording = false;
    }
  }

  private handleStatus(state: RecordingLifecycleState): void {
    switch (state.state) {
      case "idle":
        this.statusEl.setText(state.message ?? "Ready to record.");
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        break;
      case "recording":
        this.statusEl.setText(state.message ?? "Recording in progress…");
        this.appendLog(`Recording started at ${state.startedAt.toLocaleTimeString()}.`);
        this.startButton.disabled = true;
        this.stopButton.disabled = false;
        this.isRecording = true;
        break;
      case "processing":
        this.statusEl.setText(state.message ?? `Processing (${state.step})…`);
        this.appendLog(state.message ?? `Processing step: ${state.step}`);
        this.startButton.disabled = true;
        this.stopButton.disabled = true;
        this.isRecording = false;
        break;
      case "completed":
        this.statusEl.setText(state.message);
        this.appendLog(state.message);
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        this.isRecording = false;
        this.renderResult(state.notePath, state.summary.summary, state.summary.actionItems);
        break;
      case "error":
        this.statusEl.setText(`Error: ${state.message}`);
        this.appendLog(`Error: ${state.message}`);
        this.startButton.disabled = false;
        this.stopButton.disabled = true;
        this.isRecording = false;
        break;
      default:
        break;
    }
  }

  private renderResult(notePath: string, summary: string, actionItems: string[]): void {
    if (!this.resultEl) {
      this.resultEl = this.contentEl.createDiv({ cls: "ai-meeting-modal__result" });
    }
    this.resultEl.empty();
    this.resultEl.createEl("h3", { text: "Summary" });
    this.resultEl.createEl("p", { text: summary || "No summary available." });

    const actionHeading = this.resultEl.createEl("h4", { text: "Action items" });
    actionHeading.addClass("ai-meeting-modal__result-heading");
    if (actionItems.length === 0) {
      this.resultEl.createEl("p", { text: "No action items were identified." });
    } else {
      const list = this.resultEl.createEl("ul");
      for (const item of actionItems) {
        list.createEl("li", { text: item });
      }
    }

    const openButton = this.resultEl.createEl("button", { text: "Open meeting note", cls: "ai-meeting-button" });
    openButton.addEventListener("click", (event) => {
      event.preventDefault();
      this.plugin.openNote(notePath);
    });
  }

  private appendLog(message: string): void {
    if (!this.logEl) {
      return;
    }
    const item = this.logEl.createEl("li");
    item.setText(`${new Date().toLocaleTimeString()}: ${message}`);
    const items = this.logEl.querySelectorAll("li");
    if (items.length > 50) {
      const first = this.logEl.querySelector("li");
      first?.remove();
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
