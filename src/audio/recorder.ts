export interface RecordingOptions {
  includeSystemAudio: boolean;
  mimeType: string;
}

export interface RecordingResult {
  blob: Blob;
  startedAt: Date;
  endedAt: Date;
  durationMs: number;
  mimeType: string;
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;

  private chunks: Blob[] = [];

  private streams: MediaStream[] = [];

  private startedAt: Date | null = null;

  private mimeType: string = "audio/webm";

  isRecording(): boolean {
    return this.mediaRecorder !== null;
  }

  async start(options: RecordingOptions): Promise<void> {
    if (this.mediaRecorder) {
      throw new Error("Recording is already in progress.");
    }

    this.chunks = [];
    this.streams = [];

    const microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.streams.push(microphoneStream);
    const tracks: MediaStreamTrack[] = [...microphoneStream.getAudioTracks()];

    if (options.includeSystemAudio && navigator.mediaDevices.getDisplayMedia) {
      try {
        const systemStream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          video: true,
        } as DisplayMediaStreamConstraints);
        this.streams.push(systemStream);
        tracks.push(...systemStream.getAudioTracks());
        // We do not need the accompanying video track once permission has been granted.
        for (const track of systemStream.getVideoTracks()) {
          track.stop();
        }
      } catch (error) {
        this.stopStreams();
        throw error;
      }
    }

    const combinedStream = new MediaStream(tracks);
    let mediaRecorder: MediaRecorder;
    if (MediaRecorder.isTypeSupported(options.mimeType)) {
      mediaRecorder = new MediaRecorder(combinedStream, { mimeType: options.mimeType });
      this.mimeType = options.mimeType;
    } else {
      mediaRecorder = new MediaRecorder(combinedStream);
      this.mimeType = mediaRecorder.mimeType || this.mimeType;
    }

    mediaRecorder.addEventListener("dataavailable", (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    });

    this.mediaRecorder = mediaRecorder;
    this.startedAt = new Date();
    this.mediaRecorder.start();
  }

  async stop(): Promise<RecordingResult> {
    if (!this.mediaRecorder) {
      throw new Error("No recording in progress.");
    }

    const recorder = this.mediaRecorder;
    return new Promise<RecordingResult>((resolve, reject) => {
      const handleError = (error: Event) => {
        cleanup();
        reject(error instanceof ErrorEvent ? error.error : new Error("Recording failed."));
      };

      const handleStop = () => {
        const endedAt = new Date();
        const startedAt = this.startedAt ?? endedAt;
        const blob = new Blob(this.chunks, { type: this.mimeType });
        const durationMs = endedAt.getTime() - startedAt.getTime();
        cleanup();
        resolve({
          blob,
          startedAt,
          endedAt,
          durationMs,
          mimeType: this.mimeType,
        });
      };

      const cleanup = () => {
        recorder.removeEventListener("error", handleError);
        recorder.removeEventListener("stop", handleStop);
        this.mediaRecorder = null;
        this.startedAt = null;
        this.chunks = [];
        this.stopStreams();
      };

      recorder.addEventListener("error", handleError, { once: true });
      recorder.addEventListener("stop", handleStop, { once: true });

      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        } else {
          handleStop();
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  async cancel(): Promise<void> {
    if (!this.mediaRecorder) {
      return;
    }

    const recorder = this.mediaRecorder;
    await new Promise<void>((resolve) => {
      const cleanup = () => {
        recorder.removeEventListener("stop", cleanup);
        recorder.removeEventListener("error", cleanup);
        this.mediaRecorder = null;
        this.startedAt = null;
        this.chunks = [];
        this.stopStreams();
        resolve();
      };

      recorder.addEventListener("stop", cleanup, { once: true });
      recorder.addEventListener("error", cleanup, { once: true });

      try {
        if (recorder.state !== "inactive") {
          recorder.stop();
        } else {
          cleanup();
        }
      } catch (error) {
        console.error(error);
        cleanup();
      }
    });
  }

  private stopStreams() {
    for (const stream of this.streams) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    this.streams = [];
  }
}
