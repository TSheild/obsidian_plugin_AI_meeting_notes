import { describe, expect, it } from "vitest";
import { composeMeetingNote, formatDurationText, getAudioMimeType } from "../src/utils/note";

describe("note utilities", () => {
  it("builds a note including transcript when requested", () => {
    const startedAt = new Date("2024-01-02T03:04:05Z");
    const localeString = startedAt.toLocaleString();
    const content = composeMeetingNote(
      {
        title: "Meeting Alpha",
        audioVaultPath: "AI Meeting Notes/Audio/meeting.webm",
        transcriptVaultPath: "AI Meeting Notes/Transcripts/meeting.txt",
        summaryMarkdown: "## Summary\n- Discussed roadmap",
        transcript: "Speaker: Hello",
        startedAt,
        durationMs: 65000,
      },
      { includeTranscript: true },
    );

    expect(content).toContain("# Meeting Alpha");
    expect(content).toContain(`**Recorded:** ${localeString} (1m 05s)`);
    expect(content).toContain("## Resources");
    expect(content).toContain("[[AI Meeting Notes/Audio/meeting.webm|Audio recording]]");
    expect(content).toContain("[[AI Meeting Notes/Transcripts/meeting.txt|Transcript]]");
    expect(content).toContain("## Summary\n- Discussed roadmap");
    expect(content).toContain("## Transcript");
    expect(content).toContain("Speaker: Hello");
    expect(content.endsWith("\n")).toBe(true);
  });

  it("omits transcript section when disabled and fills summary fallback", () => {
    const startedAt = new Date("2024-01-02T03:04:05Z");
    const content = composeMeetingNote(
      {
        title: "Meeting Beta",
        audioVaultPath: "audio.webm",
        transcriptVaultPath: "",
        summaryMarkdown: " ",
        transcript: "",
        startedAt,
        durationMs: 3000,
      },
      { includeTranscript: false },
    );

    expect(content).not.toContain("## Transcript");
    expect(content).toContain("*No summary generated.*");
    expect(content).toContain("audio: [[audio.webm]]");
    expect(content).toContain("transcript: [[]]");
  });

  it("computes duration text", () => {
    expect(formatDurationText(0)).toBe("1s");
    expect(formatDurationText(59000)).toBe("59s");
    expect(formatDurationText(61000)).toBe("1m 01s");
    expect(formatDurationText(130000)).toBe("2m 10s");
  });

  it("returns appropriate MIME types for audio formats", () => {
    expect(getAudioMimeType("webm")).toBe("audio/webm;codecs=opus");
    expect(getAudioMimeType("ogg")).toBe("audio/ogg;codecs=opus");
  });
});
