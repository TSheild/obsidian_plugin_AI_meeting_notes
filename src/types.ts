import type { SummarizationResult } from "./services/SummarizationService";
import type { TranscriptionResult } from "./services/TranscriptionService";

export interface RecordingOptions {
  captureSystemAudio: boolean;
}

export type RecordingLifecycleState =
  | { state: "idle"; message?: string }
  | { state: "recording"; startedAt: Date; message?: string }
  | { state: "processing"; step: string; message?: string }
  | {
      state: "completed";
      message: string;
      notePath: string;
      transcription: TranscriptionResult;
      summary: SummarizationResult;
    }
  | { state: "error"; message: string; error?: Error };
