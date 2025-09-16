export interface RecordingOptions {
  useMicrophone: boolean;
  useSystemAudio: boolean;
  mimeType?: string;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  startedAt: number;
  endedAt: number;
  sources: {
    microphone: boolean;
    system: boolean;
  };
}

export interface TranscriptionResult {
  text: string;
  raw?: unknown;
}

export interface SummaryResult {
  summary: string;
  actionItems: string[];
  usedFallback: boolean;
  raw?: unknown;
  errorMessage?: string;
}

export interface MeetingNotesContent {
  summary: string;
  actionItems: string[];
  transcript: string;
  markdown: string;
  createdAt: Date;
  recording: RecordingResult;
  summaryUsedFallback: boolean;
}
