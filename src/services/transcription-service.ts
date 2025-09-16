import { MeetingNotesSettings } from "../settings";
import { RecordingResult, TranscriptionResult } from "../types";

const DEFAULT_TRANSCRIPTION_TIMEOUT = 2 * 60 * 1000; // 2 minutes

export class TranscriptionService {
  constructor(private readonly settings: MeetingNotesSettings) {}

  async transcribe(recording: RecordingResult): Promise<TranscriptionResult> {
    const endpoint = this.settings.transcriptionEndpoint.trim();
    if (!endpoint) {
      throw new Error("Transcription endpoint is not configured. Please update the plugin settings.");
    }

    const formData = new FormData();
    formData.append("file", recording.blob, `meeting-${recording.startedAt}.webm`);
    formData.append("mimeType", recording.mimeType);
    formData.append("durationMs", String(recording.endedAt - recording.startedAt));
    formData.append("sources", JSON.stringify(recording.sources));

    const headers = new Headers();
    if (this.settings.transcriptionAuthToken) {
      headers.set("Authorization", this.settings.transcriptionAuthToken);
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), DEFAULT_TRANSCRIPTION_TIMEOUT);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await safeReadText(response);
        throw new Error(`Transcription failed (${response.status} ${response.statusText}): ${errorText}`);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        const text = extractTextFromJson(data);
        if (!text) {
          throw new Error("Transcription endpoint returned JSON but no transcript text was found.");
        }

        return { text, raw: data };
      }

      const text = await response.text();
      return { text, raw: text };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Transcription request timed out. You can increase the timeout by updating the service configuration.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

function extractTextFromJson(data: unknown): string {
  if (!data) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    const record = data as Record<string, unknown>;
    const candidates = ["text", "transcript", "transcription", "result"];
    for (const key of candidates) {
      const value = record[key];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }

    if (Array.isArray(record["segments"])) {
      const segments = record["segments"] as Array<{ text?: string }>;
      return segments.map((segment) => segment.text ?? "").join(" ");
    }
  }

  return "";
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    console.error("AI Meeting Notes: failed to read response body", error);
    return "";
  }
}
