export interface RecordingStartOptions {
  captureSystemAudio: boolean;
  mimeType?: string;
}

export class RecorderController {
  private recorder: MediaRecorder | null = null;
  private microphoneStream: MediaStream | null = null;
  private systemStream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime: Date | null = null;

  async start(options: RecordingStartOptions): Promise<void> {
    if (this.recorder) {
      throw new Error("Recording is already in progress");
    }

    if (typeof MediaRecorder === "undefined") {
      throw new Error("MediaRecorder API is not available in this environment.");
    }

    this.startTime = new Date();
    this.chunks = [];

    this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    if (options.captureSystemAudio) {
      try {
        this.systemStream = await navigator.mediaDevices.getDisplayMedia({
          audio: true,
          // Some browsers require a video track when capturing system audio.
          // We immediately stop any provided video track afterwards.
          video: { frameRate: 1, width: 1, height: 1 },
        });
        this.systemStream.getVideoTracks().forEach((track) => track.stop());
      } catch (error) {
        console.warn("System audio capture failed, falling back to microphone only", error);
        this.systemStream = null;
      }
    }

    const tracks: MediaStreamTrack[] = [];
    if (this.microphoneStream) {
      tracks.push(...this.microphoneStream.getAudioTracks());
    }
    if (this.systemStream) {
      tracks.push(...this.systemStream.getAudioTracks());
    }

    if (tracks.length === 0) {
      this.releaseStreams();
      throw new Error("No audio tracks available for recording.");
    }

    const stream = new MediaStream(tracks);

    const mimeType = options.mimeType && MediaRecorder.isTypeSupported(options.mimeType)
      ? options.mimeType
      : undefined;

    this.recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
  }

  getStartTime(): Date | null {
    return this.startTime;
  }

  async begin(): Promise<void> {
    if (!this.recorder) {
      throw new Error("Recorder has not been initialised. Call start() first.");
    }
    this.recorder.start();
  }

  async stop(): Promise<Blob> {
    if (!this.recorder) {
      throw new Error("No active recording.");
    }

    const recorder = this.recorder;

    const blobPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: recorder.mimeType || "audio/webm" });
        this.cleanup();
        resolve(blob);
      };
    });

    recorder.stop();
    this.releaseStreams();

    return blobPromise;
  }

  cancel(): void {
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.stop();
    }
    this.cleanup();
    this.releaseStreams();
  }

  private cleanup(): void {
    this.recorder = null;
    this.chunks = [];
    this.startTime = null;
  }

  private releaseStreams(): void {
    const stopTracks = (stream: MediaStream | null) => {
      stream?.getTracks().forEach((track) => track.stop());
    };

    stopTracks(this.microphoneStream);
    stopTracks(this.systemStream);

    this.microphoneStream = null;
    this.systemStream = null;
  }
}
