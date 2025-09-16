import * as path from "path";
import type AIMeetingNotesPlugin from "../main";
import { applyTemplate, parseArguments } from "../utils/commandLine";
import { VaultFileManager } from "../utils/vault";
import { CommandExecutionError, runCommand } from "./CommandRunner";
import type { TranscriptionResult } from "./TranscriptionService";

export interface SummarizationResult {
  summary: string;
  actionItems: string[];
  rawOutput: string;
  summaryVaultPath?: string;
  summaryAbsolutePath?: string;
}

export class SummarizationService {
  constructor(private readonly plugin: AIMeetingNotesPlugin, private readonly fileManager: VaultFileManager) {}

  async summarise(transcription: TranscriptionResult): Promise<SummarizationResult> {
    const settings = this.plugin.settings;

    if (!settings.summarizationCommand) {
      return this.heuristicSummary(transcription.transcriptText);
    }

    const transcriptsFolder = this.fileManager.getNormalizedPath(settings.transcriptsFolder);
    await this.fileManager.ensureFolder(transcriptsFolder);

    const transcriptAbsolutePath = transcription.transcriptAbsolutePath;
    const transcriptFileName = path.basename(transcription.transcriptVaultPath);
    const baseName = transcriptFileName.replace(/\.[^/.]+$/, "");

    const outputExtension = settings.summarizationOutputExtension.replace(/^\./, "") || "md";
    const summariesAbsoluteDir = transcriptsFolder === "."
      ? this.fileManager.getVaultRoot()
      : this.fileManager.getAbsolutePath(transcriptsFolder);
    const summaryFileName = `${baseName}-summary.${outputExtension}`;
    const summaryVaultPath = transcriptsFolder === "."
      ? summaryFileName
      : `${transcriptsFolder}/${summaryFileName}`;
    const summaryAbsolutePath = path.join(summariesAbsoluteDir, summaryFileName);

    const replacements = {
      transcriptFile: transcriptAbsolutePath,
      outputDir: summariesAbsoluteDir,
      baseName,
      outputFile: summaryAbsolutePath,
    };

    const argsTemplate = settings.summarizationArgs ?? "";
    const argsString = applyTemplate(argsTemplate, replacements);
    const args = argsString.length > 0 ? parseArguments(argsString) : [];

    const timeoutMs = Math.max(0, settings.commandTimeoutSeconds || 0) * 1000;
    try {
      const commandResult = await runCommand(settings.summarizationCommand, args, {
        cwd: settings.cliWorkingDirectory || undefined,
        timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
      });

      let output = "";
      try {
        output = await this.fileManager.readText(summaryVaultPath);
      } catch (error) {
        output = commandResult.stdout.trim();
        if (!output) {
          throw error;
        }
        await this.fileManager.writeText(summaryVaultPath, output);
      }

      const parsed = this.parseSummaryOutput(output || commandResult.stdout);
      return {
        ...parsed,
        rawOutput: commandResult.stdout,
        summaryVaultPath,
        summaryAbsolutePath,
      };
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        throw new Error(`${error.message}\nSTDOUT: ${error.stdout}\nSTDERR: ${error.stderr}`);
      }
      throw error;
    }
  }

  private heuristicSummary(transcript: string): SummarizationResult {
    const cleaned = transcript.trim();
    if (!cleaned) {
      return { summary: "", actionItems: [], rawOutput: "" };
    }

    const sentences = cleaned
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .slice(0, 5);
    const summary = sentences.join(" ");

    const actionItems = this.extractActionItems(cleaned);

    return {
      summary,
      actionItems,
      rawOutput: summary,
    };
  }

  private parseSummaryOutput(output: string): { summary: string; actionItems: string[] } {
    const trimmed = output.trim();
    if (!trimmed) {
      return { summary: "", actionItems: [] };
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") {
        return { summary: parsed, actionItems: [] };
      }
      const summary = typeof parsed.summary === "string" ? parsed.summary : trimmed;
      const actionItems = Array.isArray(parsed.actionItems)
        ? parsed.actionItems.map((item: unknown) => String(item).trim()).filter(Boolean)
        : Array.isArray(parsed.action_items)
          ? parsed.action_items.map((item: unknown) => String(item).trim()).filter(Boolean)
          : [];
      return { summary, actionItems };
    } catch (error) {
      // Not JSON; fall through to markdown/heuristic parsing.
    }

    const lines = trimmed.split(/\r?\n/);
    const summaryLines: string[] = [];
    const actionItems: string[] = [];
    let inSummarySection = false;
    let inActionSection = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (/^#+\s*summary/i.test(line)) {
        inSummarySection = true;
        inActionSection = false;
        continue;
      }
      if (/^#+\s*action/i.test(line) || /^action items?:/i.test(line)) {
        inSummarySection = false;
        inActionSection = true;
        continue;
      }
      if (inActionSection) {
        if (line.length === 0) {
          continue;
        }
        actionItems.push(this.cleanBullet(line));
        continue;
      }
      if (inSummarySection) {
        summaryLines.push(line);
      }
    }

    if (summaryLines.length === 0) {
      summaryLines.push(...lines.filter((line) => line.trim().length > 0).slice(0, 8));
    }

    if (actionItems.length === 0) {
      actionItems.push(...this.extractActionItems(trimmed));
    }

    return {
      summary: summaryLines.join("\n").trim(),
      actionItems,
    };
  }

  private extractActionItems(text: string): string[] {
    const lines = text.split(/\r?\n/);
    const actionCandidates = lines.filter((line) => /\b(action|todo|follow up|follow-up|next steps?)\b/i.test(line));

    if (actionCandidates.length === 0) {
      const bulletMatches = text.match(/^-\s+.+/gim);
      if (bulletMatches) {
        actionCandidates.push(...bulletMatches);
      }
    }

    return actionCandidates
      .map((line) => this.cleanBullet(line))
      .filter((line, index, array) => line.length > 0 && array.indexOf(line) === index);
  }

  private cleanBullet(line: string): string {
    return line.replace(/^[-*+]\s*/, "").replace(/^\[.\]\s*/, "").trim();
  }
}
