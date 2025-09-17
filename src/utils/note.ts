import { AudioFormat } from "../settings";
import { formatDateTimeISO } from "./time";

export interface ComposeMeetingNoteParams {
  title: string;
  audioVaultPath: string;
  transcriptVaultPath: string;
  summaryMarkdown: string;
  transcript: string;
  startedAt: Date;
  durationMs: number;
}

export interface ComposeMeetingNoteOptions {
  includeTranscript: boolean;
}

export function composeMeetingNote(
  params: ComposeMeetingNoteParams,
  options: ComposeMeetingNoteOptions,
): string {
  const durationText = formatDurationText(params.durationMs);
  const createdIso = formatDateTimeISO(params.startedAt);
  const resources: string[] = [`- [[${params.audioVaultPath}|Audio recording]]`];
  if (params.transcriptVaultPath) {
    resources.push(`- [[${params.transcriptVaultPath}|Transcript]]`);
  }

  const summaryContent = params.summaryMarkdown.trim().length > 0
    ? params.summaryMarkdown.trim()
    : "*No summary generated.*";

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

  if (options.includeTranscript) {
    sections.push("## Transcript");
    sections.push(params.transcript.trim());
  }

  return sections.join("\n\n").trimEnd() + "\n";
}

export function getAudioMimeType(format: AudioFormat): string {
  if (format === "ogg") {
    return "audio/ogg;codecs=opus";
  }
  return "audio/webm;codecs=opus";
}

export function formatDurationText(durationMs: number): string {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${seconds}s`;
}
