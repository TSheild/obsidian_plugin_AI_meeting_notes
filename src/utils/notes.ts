import { MeetingNotesSettings } from "../settings";
import { MeetingNotesContent, RecordingResult, SummaryResult, TranscriptionResult } from "../types";

export function createMeetingNotesContent(options: {
  summary: SummaryResult;
  transcription: TranscriptionResult;
  recording: RecordingResult;
  settings: MeetingNotesSettings;
}): MeetingNotesContent {
  const createdAt = new Date();
  const normalizedSummary = options.summary.summary.trim() || "No summary available.";
  const normalizedActionItems = normalizeActionItems(options.summary.actionItems);
  const markdown = buildMeetingNotesMarkdown({
    summary: normalizedSummary,
    actionItems: normalizedActionItems,
    transcript: options.transcription.text,
    recording: options.recording,
    settings: options.settings,
    createdAt,
  });

  return {
    summary: normalizedSummary,
    actionItems: normalizedActionItems,
    transcript: options.transcription.text,
    markdown,
    createdAt,
    recording: options.recording,
    summaryUsedFallback: options.summary.usedFallback,
  };
}

export function buildMeetingNotesMarkdown(args: {
  summary: string;
  actionItems: string[];
  transcript: string;
  recording: RecordingResult;
  settings: MeetingNotesSettings;
  createdAt: Date;
}): string {
  const lines: string[] = [];
  const timestamp = args.createdAt.toLocaleString();
  const duration = formatDuration(args.recording.endedAt - args.recording.startedAt);
  const sources = describeSources(args.recording.sources);

  lines.push(`> Recorded ${timestamp}`);
  lines.push(`> Duration: ${duration} • Sources: ${sources}`);
  lines.push("");

  const summaryHeading = args.settings.summaryHeading?.trim();
  if (summaryHeading) {
    lines.push(summaryHeading);
  }
  lines.push(args.summary || "No summary available.");
  lines.push("");

  const actionHeading = args.settings.actionItemsHeading?.trim();
  if (actionHeading) {
    lines.push(actionHeading);
  }

  if (args.actionItems.length > 0) {
    for (const item of args.actionItems) {
      lines.push(`- [ ] ${item}`);
    }
  } else {
    lines.push("- [ ] No action items captured.");
  }

  if (args.settings.includeTranscriptInNotes) {
    lines.push("");
    const transcriptHeading = args.settings.transcriptHeading?.trim();
    if (transcriptHeading) {
      lines.push(transcriptHeading);
    }
    lines.push("```");
    lines.push(args.transcript || "No transcript available.");
    lines.push("```");
  }

  return lines.join("\n");
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export function describeSources(sources: RecordingResult["sources"]): string {
  const active: string[] = [];
  if (sources.microphone) {
    active.push("microphone");
  }
  if (sources.system) {
    active.push("system audio");
  }

  if (active.length === 0) {
    return "unknown";
  }

  if (active.length === 2) {
    return `${active[0]} + ${active[1]}`;
  }

  return active[0];
}

function normalizeActionItems(items: string[]): string[] {
  return items
    .map((item) => item.replace(/^[-*]\s*(\[[ xX]?\]\s*)?/, "").trim())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}
