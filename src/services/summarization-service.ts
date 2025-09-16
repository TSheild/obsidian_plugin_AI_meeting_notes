import { MeetingNotesSettings } from "../settings";
import { RecordingResult, SummaryResult, TranscriptionResult } from "../types";

const DEFAULT_SUMMARY_TIMEOUT = 60 * 1000; // 1 minute

export class SummarizationService {
  constructor(private readonly settings: MeetingNotesSettings) {}

  async summarize(transcription: TranscriptionResult, recording: RecordingResult): Promise<SummaryResult> {
    const endpoint = this.settings.summarizationEndpoint.trim();

    if (!endpoint) {
      return this.createFallbackSummary(transcription.text, "Summarization endpoint is not configured.");
    }

    const headers = new Headers({ "Content-Type": "application/json" });
    if (this.settings.summarizationAuthToken) {
      headers.set("Authorization", this.settings.summarizationAuthToken);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), DEFAULT_SUMMARY_TIMEOUT);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          transcript: transcription.text,
          metadata: {
            durationMs: recording.endedAt - recording.startedAt,
            sources: recording.sources,
            mimeType: recording.mimeType,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await safeReadText(response);
        return this.createFallbackSummary(
          transcription.text,
          `Summarization failed (${response.status} ${response.statusText}): ${errorText}`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        return this.createFallbackSummary(
          transcription.text,
          "Summarization endpoint returned a non-JSON response. Using fallback summarizer.",
          text,
        );
      }

      const payload = await response.json();
      const summary = extractSummary(payload);
      const actionItems = extractActionItems(payload);

      if (!summary) {
        return this.createFallbackSummary(
          transcription.text,
          "Summarization endpoint returned JSON but no summary field was found.",
          payload,
        );
      }

      return {
        summary,
        actionItems,
        usedFallback: false,
        raw: payload,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return this.createFallbackSummary(transcription.text, "Summarization request timed out.");
      }

      console.error("AI Meeting Notes: summarization request failed", error);
      return this.createFallbackSummary(transcription.text, "Summarization request failed.");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private createFallbackSummary(transcript: string, reason: string, raw?: unknown): SummaryResult {
    const cleaned = transcript.trim();
    if (!cleaned) {
      return {
        summary: "No transcript was generated.",
        actionItems: [],
        usedFallback: true,
        errorMessage: reason,
        raw,
      };
    }

    const summary = buildHeuristicSummary(cleaned);
    const actionItems = buildHeuristicActionItems(cleaned);

    return {
      summary,
      actionItems,
      usedFallback: true,
      errorMessage: reason,
      raw,
    };
  }
}

function buildHeuristicSummary(transcript: string): string {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);

  if (sentences.length === 0) {
    return transcript.slice(0, 240);
  }

  return sentences.slice(0, 3).join(" ");
}

function buildHeuristicActionItems(transcript: string): string[] {
  const lines = transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const keywords = ["action", "todo", "to-do", "follow up", "next step", "task", "deliverable"];
  const actionItems = new Set<string>();

  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (line.startsWith("- [")) {
      actionItems.add(stripBullet(line));
      continue;
    }

    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        actionItems.add(stripBullet(line));
        break;
      }
    }
  }

  return Array.from(actionItems);
}

function stripBullet(line: string): string {
  return line.replace(/^[\-*\d\.\)\s]+/, "").trim();
}

function extractSummary(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const candidates = ["summary", "synopsis", "result", "notes"];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return "";
}

function extractActionItems(payload: unknown): string[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const candidates = ["actionItems", "action_items", "tasks", "todos"];
  for (const key of candidates) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (typeof value === "string") {
      return value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    }
  }

  return [];
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    console.error("AI Meeting Notes: failed to read response body", error);
    return "";
  }
}
