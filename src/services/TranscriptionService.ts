import * as path from "path";
import type AIMeetingNotesPlugin from "../main";
import { applyTemplate, parseArguments } from "../utils/commandLine";
import { VaultFileManager } from "../utils/vault";
import { CommandExecutionError, runCommand } from "./CommandRunner";

export interface TranscriptionResult {
  transcriptText: string;
  transcriptVaultPath: string;
  transcriptAbsolutePath: string;
  rawCommandOutput: string;
}

export class TranscriptionService {
  constructor(private readonly plugin: AIMeetingNotesPlugin, private readonly fileManager: VaultFileManager) {}

  async transcribe(audioVaultPath: string): Promise<TranscriptionResult> {
    const settings = this.plugin.settings;
    if (!settings.transcriptionCommand) {
      throw new Error("Transcription command is not configured in the plugin settings.");
    }

    const transcriptsFolder = this.fileManager.getNormalizedPath(settings.transcriptsFolder);
    await this.fileManager.ensureFolder(transcriptsFolder);

    const audioNormalized = this.fileManager.getNormalizedPath(audioVaultPath);
    const audioAbsolute = this.fileManager.getAbsolutePath(audioNormalized);
    const audioFileName = path.basename(audioNormalized);
    const baseName = audioFileName.replace(/\.[^/.]+$/, "");

    const outputExtension = settings.transcriptionOutputExtension.replace(/^\./, "") || "txt";
    const transcriptsAbsoluteDir = transcriptsFolder === "."
      ? this.fileManager.getVaultRoot()
      : this.fileManager.getAbsolutePath(transcriptsFolder);
    const transcriptFileName = `${baseName}.${outputExtension}`;
    const transcriptVaultPath = transcriptsFolder === "."
      ? transcriptFileName
      : `${transcriptsFolder}/${transcriptFileName}`;
    const transcriptAbsolutePath = path.join(transcriptsAbsoluteDir, transcriptFileName);

    const replacements = {
      audioFile: audioAbsolute,
      outputDir: transcriptsAbsoluteDir,
      baseName,
      audioFileName,
    };

    const argsTemplate = settings.transcriptionArgs ?? "";
    const argsString = applyTemplate(argsTemplate, replacements);
    const args = argsString.length > 0 ? parseArguments(argsString) : [];

    const timeoutMs = Math.max(0, settings.commandTimeoutSeconds || 0) * 1000;
    try {
      const commandResult = await runCommand(settings.transcriptionCommand, args, {
        cwd: settings.cliWorkingDirectory || undefined,
        timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
      });

      let transcriptText: string;
      try {
        // Attempt to read the transcript from disk first.
        transcriptText = await this.fileManager.readText(transcriptVaultPath);
      } catch (error) {
        // If the CLI wrote to stdout instead, persist that output in the expected location.
        if (commandResult.stdout.trim().length === 0) {
          throw error;
        }
        transcriptText = commandResult.stdout.trim();
        await this.fileManager.writeText(transcriptVaultPath, transcriptText);
      }

      return {
        transcriptText,
        transcriptVaultPath,
        transcriptAbsolutePath,
        rawCommandOutput: commandResult.stdout,
      };
    } catch (error) {
      if (error instanceof CommandExecutionError) {
        throw new Error(`${error.message}\nSTDOUT: ${error.stdout}\nSTDERR: ${error.stderr}`);
      }
      throw error;
    }
  }
}
