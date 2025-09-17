import { beforeEach, describe, expect, it, vi } from "vitest";

const runCommandMock = vi.fn();
const accessMock = vi.fn();
const readFileMock = vi.fn();

vi.mock("../src/utils/command", () => ({
  runCommand: runCommandMock,
}));

vi.mock("fs", () => ({
  promises: {
    access: accessMock,
    readFile: readFileMock,
  },
}));

const { summarizeTranscript } = await import("../src/ai/summarizer");
const { transcribeAudio } = await import("../src/ai/transcription");

describe("summarizeTranscript", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
  });

  it("passes prompt to command ensuring trailing newline", async () => {
    runCommandMock.mockResolvedValue({ stdout: " Summary text \n", stderr: "", exitCode: 0 });

    const result = await summarizeTranscript({
      command: "ollama",
      args: ["run", "llama3"],
      prompt: "Create summary",
    });

    expect(runCommandMock).toHaveBeenCalledWith("ollama", ["run", "llama3"], { input: "Create summary\n" });
    expect(result).toBe("Summary text");
  });

  it("does not duplicate newline when prompt already ends with one", async () => {
    runCommandMock.mockResolvedValue({ stdout: "Done", stderr: "", exitCode: 0 });

    await summarizeTranscript({ command: "cmd", args: [], prompt: "hello\n" });
    expect(runCommandMock).toHaveBeenCalledWith("cmd", [], { input: "hello\n" });
  });
});

describe("transcribeAudio", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
    accessMock.mockReset();
    readFileMock.mockReset();
  });

  it("returns transcript contents from generated file", async () => {
    runCommandMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    accessMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue("Transcribed text");

    const result = await transcribeAudio({
      command: "whisper",
      args: ["--model", "base"],
      audioFilePath: "/tmp/audio.webm",
      outputDir: "/tmp/out",
      outputFormat: "txt",
    });

    expect(runCommandMock).toHaveBeenCalledWith("whisper", ["--model", "base"]);
    expect(accessMock).toHaveBeenCalledWith("/tmp/out/audio.txt");
    expect(result).toEqual({ transcript: "Transcribed text", transcriptFilePath: "/tmp/out/audio.txt" });
  });

  it("throws when transcript file is missing", async () => {
    runCommandMock.mockResolvedValue({ stdout: "", stderr: "", exitCode: 0 });
    accessMock.mockRejectedValue(new Error("missing"));

    await expect(
      transcribeAudio({
        command: "whisper",
        args: [],
        audioFilePath: "audio.webm",
        outputDir: "/tmp/out",
        outputFormat: "txt",
      }),
    ).rejects.toThrow("Transcription output not found");
  });
});
