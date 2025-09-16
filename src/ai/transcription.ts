import { promises as fs } from "fs";
import * as path from "path";
import { runCommand } from "../utils/command";

export interface TranscriptionConfig {
  command: string;
  args: string[];
  audioFilePath: string;
  outputDir: string;
  outputFormat: string;
}

export interface TranscriptionResult {
  transcript: string;
  transcriptFilePath: string;
}

export async function transcribeAudio(config: TranscriptionConfig): Promise<TranscriptionResult> {
  await runCommand(config.command, config.args);

  const audioFileBase = path.parse(config.audioFilePath).name;
  const transcriptFilePath = path.join(config.outputDir, `${audioFileBase}.${config.outputFormat}`);

  try {
    await fs.access(transcriptFilePath);
  } catch (error) {
    throw new Error(`Transcription output not found at ${transcriptFilePath}`);
  }

  const transcript = await fs.readFile(transcriptFilePath, "utf8");

  return {
    transcript,
    transcriptFilePath,
  };
}
