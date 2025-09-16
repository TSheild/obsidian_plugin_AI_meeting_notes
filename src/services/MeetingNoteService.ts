import { Notice, TFile } from "obsidian";
import type AIMeetingNotesPlugin from "../main";
import { VaultFileManager } from "../utils/vault";
import type { SummarizationResult } from "./SummarizationService";
import type { TranscriptionResult } from "./TranscriptionService";

export interface MeetingNoteContext {
  baseName: string;
  audioVaultPath: string;
  transcription: TranscriptionResult;
  summary: SummarizationResult;
  startedAt: Date;
  endedAt: Date;
}

export class MeetingNoteService {
  constructor(private readonly plugin: AIMeetingNotesPlugin, private readonly fileManager: VaultFileManager) {}

  async createMeetingNote(context: MeetingNoteContext): Promise<string> {
    const settings = this.plugin.settings;

    const notesFolder = this.fileManager.getNormalizedPath(settings.notesFolder);
    await this.fileManager.ensureFolder(notesFolder);

    const fileName = `${context.baseName}.md`;
    const noteVaultPath = notesFolder === "." ? fileName : `${notesFolder}/${fileName}`;

    const content = this.buildNoteContent(context);
    await this.fileManager.writeText(noteVaultPath, content);

    if (settings.openNoteAfterCreation) {
      const file = this.plugin.app.vault.getAbstractFileByPath(noteVaultPath);
      if (file instanceof TFile) {
        await this.plugin.app.workspace.getLeaf(true).openFile(file);
      } else {
        new Notice(`Meeting note saved at ${noteVaultPath}`);
      }
    }

    return noteVaultPath;
  }

  private buildNoteContent(context: MeetingNoteContext): string {
    const { audioVaultPath, transcription, summary, startedAt, endedAt } = context;
    const settings = this.plugin.settings;

    const headerTitle = `Meeting - ${this.formatDate(startedAt)}`;
    const lines: string[] = [`# ${headerTitle}`, ""];

    lines.push(`**Start:** ${this.formatDateTime(startedAt)}`);
    lines.push(`**End:** ${this.formatDateTime(endedAt)}`);
    lines.push(`**Duration:** ${this.formatDuration(startedAt, endedAt)}`);
    lines.push("");

    if (settings.autoEmbedAudio) {
      lines.push(`![[${audioVaultPath}]]`);
    } else {
      lines.push(`Audio: [[${audioVaultPath}]]`);
    }

    lines.push(`Transcript file: [[${transcription.transcriptVaultPath}]]`);
    lines.push("");

    lines.push("## Summary");
    lines.push(summary.summary || "_(No summary provided)_");
    lines.push("");

    lines.push("## Action Items");
    if (summary.actionItems.length === 0) {
      lines.push("- No action items identified.");
    } else {
      for (const item of summary.actionItems) {
        lines.push(`- [ ] ${item}`);
      }
    }
    lines.push("");

    if (settings.includeTranscriptInNote) {
      lines.push("## Transcript");
      lines.push("<details>");
      lines.push("<summary>Show transcript</summary>");
      lines.push("");
      lines.push("<pre><code>");
      lines.push(this.escapeHtml(transcription.transcriptText));
      lines.push("</code></pre>");
      lines.push("");
      lines.push("</details>");
      lines.push("");
    }

    return lines.join("\n");
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  private formatDateTime(date: Date): string {
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  private formatDuration(start: Date, end: Date): string {
    const diffMs = Math.max(0, end.getTime() - start.getTime());
    if (diffMs === 0) {
      return "< 1s";
    }
    const totalSeconds = Math.round(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}m`);
    }
    if (seconds > 0 && parts.length === 0) {
      parts.push(`${seconds}s`);
    }
    return parts.join(" ") || "< 1s";
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
