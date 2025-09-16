import { Notice, Plugin, TFile } from "obsidian";
import { AudioRecorder, RecordingResult } from "./audio/recorder";
import { summarizeTranscript } from "./ai/summarizer";
import { transcribeAudio } from "./ai/transcription";
import { AudioFormat, DEFAULT_SETTINGS, MeetingNotesSettingTab, MeetingNotesSettings } from "./settings";
import { CommandExecutionError, splitCommandLine } from "./utils/command";
import { absolutePathToVaultPath, ensureFolder, getAbsolutePath, joinVaultPath, saveBinaryFile, saveTextFile } from "./utils/files";
import { formatDateForFile, formatDateTimeISO } from "./utils/time";
import { formatTemplate } from "./utils/template";
import * as path from "path";

export default class MeetingNotesPlugin extends Plugin {
  settings: MeetingNotesSettings = DEFAULT_SETTINGS;

  private recorder: AudioRecorder = new AudioRecorder();

  private statusBarEl: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.setStatus("Idle");

    this.addRibbonIcon("mic", "AI Meeting Notes: start or stop recording", async () => {
      await this.toggleRecording();
    });

    this.addCommand({
      id: "ai-meeting-notes-start-recording",
      name: "Start meeting recording",
      callback: async () => {
        await this.startRecording();
      },
    });

    this.addCommand({
      id: "ai-meeting-notes-stop-recording",
      name: "Stop meeting recording",
      callback: async () => {
        await this.stopRecording();
      },
    });

    this.addSettingTab(new MeetingNotesSettingTab(this.app, this));
  }

  onunload() {
    void this.recorder.cancel();
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async toggleRecording() {
    if (this.recorder.isRecording()) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording() {
    if (this.recorder.isRecording()) {
      new Notice("AI Meeting Notes is already recording.");
      return;
    }

    try {
      await this.recorder.start({
        includeSystemAudio: this.settings.includeSystemAudio,
        mimeType: this.getMimeType(this.settings.audioFormat),
      });
      this.setStatus("Recording…", true);
      new Notice("AI Meeting Notes recording started.");
    } catch (error) {
      this.handleError("Failed to start recording", error);
      this.setStatus("Idle");
    }
  }

  private async stopRecording() {
    if (!this.recorder.isRecording()) {
      new Notice("AI Meeting Notes is not recording.");
      return;
    }

    this.setStatus("Finishing recording…");
    let result: RecordingResult;
    try {
      result = await this.recorder.stop();
    } catch (error) {
      this.handleError("Failed to stop recording", error);
      this.setStatus("Idle");
      return;
    }

    try {
      await this.processRecording(result);
      new Notice("AI meeting notes created.");
    } catch (error) {
      this.handleError("Failed to process recording", error);
    } finally {
      this.setStatus("Idle");
    }
  }

  private async processRecording(result: RecordingResult) {
    const baseName = formatDateForFile(result.startedAt);
    const title = `Meeting ${baseName}`;
    const audioFileName = `${title}.${this.settings.audioFormat}`;
    await ensureFolder(this.app, this.settings.recordingsFolder);
    const audioVaultPath = joinVaultPath(this.settings.recordingsFolder, audioFileName);
    const audioBuffer = await result.blob.arrayBuffer();
    await saveBinaryFile(this.app, audioVaultPath, audioBuffer);

    const audioAbsolutePath = getAbsolutePath(this.app, audioVaultPath);
    if (!audioAbsolutePath) {
      throw new Error("Unable to resolve a filesystem path for the audio file. This feature requires the desktop app.");
    }

    await ensureFolder(this.app, this.settings.transcriptsFolder);
    const transcriptsAbsolutePath = getAbsolutePath(this.app, this.settings.transcriptsFolder || ".");
    if (!transcriptsAbsolutePath) {
      throw new Error("Unable to resolve transcripts folder path. This feature requires the desktop app.");
    }

    const templateValues = {
      audioFilePath: audioAbsolutePath,
      audioDir: path.dirname(audioAbsolutePath),
      outputDir: transcriptsAbsolutePath,
      model: this.settings.whisperModel,
      fileName: audioFileName,
      baseName: title,
      title,
      startedAt: formatDateTimeISO(result.startedAt),
      endedAt: formatDateTimeISO(result.endedAt),
      durationMinutes: Math.max(1, Math.round(result.durationMs / 60000)),
    };

    const whisperArgsText = formatTemplate(this.settings.whisperArgs, templateValues);
    const whisperArgs = splitCommandLine(whisperArgsText).filter((arg) => arg.length > 0);
    if (!whisperArgs.some((arg) => arg === audioAbsolutePath || arg.includes(audioAbsolutePath))) {
      whisperArgs.push(audioAbsolutePath);
    }

    this.setStatus("Transcribing audio…");
    const transcription = await transcribeAudio({
      command: this.settings.whisperCommand,
      args: whisperArgs,
      audioFilePath: audioAbsolutePath,
      outputDir: transcriptsAbsolutePath,
      outputFormat: this.settings.whisperOutputFormat || "txt",
    });

    const transcriptVaultPath =
      absolutePathToVaultPath(this.app, transcription.transcriptFilePath) ??
      joinVaultPath(this.settings.transcriptsFolder, `${title}.${this.settings.whisperOutputFormat}`);

    const promptValues = {
      ...templateValues,
      transcript: transcription.transcript,
      transcriptPath: transcription.transcriptFilePath,
    };

    const summarizerArgsText = formatTemplate(this.settings.summarizerArgs, promptValues);
    const summarizerArgs = splitCommandLine(summarizerArgsText).filter((arg) => arg.length > 0);

    const prompt = formatTemplate(this.settings.summaryPrompt, promptValues);

    let summaryMarkdown: string;
    this.setStatus("Creating meeting summary…");
    try {
      summaryMarkdown = await summarizeTranscript({
        command: this.settings.summarizerCommand,
        args: summarizerArgs,
        prompt,
      });
    } catch (error) {
      console.error("Summarizer failed", error);
      new Notice("Summarizer command failed. Saving transcript without AI summary.");
      summaryMarkdown = "*Summary unavailable. See console for details.*";
    }

    this.setStatus("Saving results…");

    const noteContent = this.composeNote({
      title,
      audioVaultPath,
      transcriptVaultPath,
      summaryMarkdown,
      transcript: transcription.transcript,
      startedAt: result.startedAt,
      durationMs: result.durationMs,
    });

    await ensureFolder(this.app, this.settings.notesFolder);
    const noteFileName = `${title}.md`;
    const noteVaultPath = joinVaultPath(this.settings.notesFolder, noteFileName);
    const noteFile = await saveTextFile(this.app, noteVaultPath, noteContent);

    if (this.settings.autoOpenNote) {
      await this.openFile(noteFile);
    }
  }

  private composeNote(params: {
    title: string;
    audioVaultPath: string;
    transcriptVaultPath: string;
    summaryMarkdown: string;
    transcript: string;
    startedAt: Date;
    durationMs: number;
  }): string {
    const durationText = this.formatDuration(params.durationMs);
    const createdIso = formatDateTimeISO(params.startedAt);
    const resources: string[] = [`- [[${params.audioVaultPath}|Audio recording]]`];
    if (params.transcriptVaultPath) {
      resources.push(`- [[${params.transcriptVaultPath}|Transcript]]`);
    }

    const summaryContent = params.summaryMarkdown.trim().length > 0 ? params.summaryMarkdown.trim() : "*No summary generated.*";

    const sections = [
      "---",
      `created: ${createdIso}`,
      `audio: [[${params.audioVaultPath}]]`,
      `transcript: [[${params.transcriptVaultPath}]]`,
      "---",
      `# ${params.title}`,
      `**Recorded:** ${params.startedAt.toLocaleString()} (${durationText})`,
      "## Resources",
      resources.join("\n"),
      summaryContent,
    ];

    if (this.settings.includeTranscriptInNote) {
      sections.push("## Transcript");
      sections.push(params.transcript.trim());
    }

    return sections.join("\n\n").trimEnd() + "\n";
  }

  private getMimeType(format: AudioFormat): string {
    if (format === "ogg") {
      return "audio/ogg;codecs=opus";
    }
    return "audio/webm;codecs=opus";
  }

  private setStatus(message: string, isRecording: boolean = false) {
    if (!this.statusBarEl) {
      return;
    }
    this.statusBarEl.setText(`AI Meeting Notes: ${message}`);
    this.statusBarEl.toggleClass("ai-meeting-notes-recording", isRecording);
  }

  private formatDuration(durationMs: number): string {
    const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
    }
    return `${seconds}s`;
  }

  private async openFile(file: TFile) {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
  }

  private handleError(message: string, error: unknown) {
    console.error(message, error);
    if (error instanceof CommandExecutionError) {
      const details = error.stderr || error.stdout || error.message;
      new Notice(`${message}: ${details}`);
      return;
    }
    if (error instanceof Error) {
      new Notice(`${message}: ${error.message}`);
      return;
    }
    new Notice(`${message}.`);
  }
}
