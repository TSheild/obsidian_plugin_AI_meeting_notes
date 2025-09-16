import { RecordingOptions, RecordingResult } from "../types";

export interface RecorderCallbacks {
  onWarning?: (message: string) => void;
  onLog?: (message: string, data?: unknown) => void;
}

export class MeetingRecorder {
  private microphoneStream?: MediaStream;
  private systemStream?: MediaStream;
  private combinedStream?: MediaStream;
  private recorder?: MediaRecorder;
  private chunks: BlobPart[] = [];
  private startedAt?: number;
  private mimeType = "";

  constructor(private readonly callbacks: RecorderCallbacks = {}) {}

  async start(options: RecordingOptions): Promise<void> {
    if (this.isRecording()) {
      throw new Error("Recording is already in progress");
    }

    const tracks: MediaStreamTrack[] = [];
    let microphoneCaptured = false;
    let systemCaptured = false;

    this.log("Requesting audio streams", options);

    if (options.useMicrophone) {
      try {
        this.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTracks = this.microphoneStream.getAudioTracks();
        if (audioTracks.length > 0) {
          tracks.push(...audioTracks);
          microphoneCaptured = true;
        } else {
          this.warn("No audio tracks were returned from the microphone stream.");
        }
      } catch (error) {
        this.warn("Unable to access the microphone. Recording will continue without it.");
        console.error("AI Meeting Notes: failed to access microphone", error);
      }
    }

    if (options.useSystemAudio) {
      try {
        // Some browsers require at least an empty video constraint when requesting audio from getDisplayMedia.
        this.systemStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false });
        const audioTracks = this.systemStream.getAudioTracks();
        if (audioTracks.length > 0) {
          tracks.push(...audioTracks);
          systemCaptured = true;
        } else {
          this.warn("No audio tracks were returned from the system capture stream.");
        }
      } catch (error) {
        this.warn("Unable to capture system audio. Recording will continue without it.");
        console.error("AI Meeting Notes: failed to access system audio", error);
      }
    }

    if (tracks.length === 0) {
      this.cleanupStreams();
      throw new Error("No audio sources are available. Please enable at least one recording option in the settings.");
    }

    this.combinedStream = new MediaStream(tracks);
    this.mimeType = this.resolveMimeType(options.mimeType);
    this.chunks = [];
    this.startedAt = Date.now();

    this.recorder = this.mimeType
      ? new MediaRecorder(this.combinedStream, { mimeType: this.mimeType })
      : new MediaRecorder(this.combinedStream);

    this.recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.recorder.onerror = (event) => {
      console.error("AI Meeting Notes: recorder error", event);
      this.cleanupStreams();
    };

    if (this.systemStream) {
      for (const track of this.systemStream.getAudioTracks()) {
        track.addEventListener("ended", () => {
          if (this.isRecording()) {
            this.warn("System audio capture ended. The rest of the recording will rely on remaining sources.");
          }
        });
      }
    }

    this.recorder.start();
    this.log("Recording started", { microphoneCaptured, systemCaptured, mimeType: this.mimeType });
  }

  async stop(): Promise<RecordingResult> {
    if (!this.recorder) {
      throw new Error("Recording has not been started");
    }

    if (this.recorder.state === "inactive") {
      throw new Error("Recording is already stopped");
    }

    const recorder = this.recorder;

    return new Promise<RecordingResult>((resolve, reject) => {
      const finalize = () => {
        this.cleanupStreams();
        this.recorder = undefined;
      };

      recorder.onstop = () => {
        const endedAt = Date.now();
        const blob = new Blob(this.chunks, { type: this.mimeType || recorder.mimeType });
        const result: RecordingResult = {
          blob,
          mimeType: blob.type || this.mimeType || recorder.mimeType,
          startedAt: this.startedAt ?? endedAt,
          endedAt,
          sources: {
            microphone: Boolean(this.microphoneStream && this.microphoneStream.getAudioTracks().length > 0),
            system: Boolean(this.systemStream && this.systemStream.getAudioTracks().length > 0),
          },
        };

        this.log("Recording stopped", result);
        finalize();
        resolve(result);
      };

      recorder.onerror = (event) => {
        console.error("AI Meeting Notes: recorder error", event.error);
        finalize();
        reject(event.error);
      };

      try {
        recorder.stop();
      } catch (error) {
        finalize();
        reject(error);
      }
    });
  }

  isRecording(): boolean {
    return this.recorder !== undefined && this.recorder.state === "recording";
  }

  private resolveMimeType(preferred?: string): string {
    const candidates = preferred ? [preferred] : [];
    candidates.push("audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg");

    for (const candidate of candidates) {
      if (candidate && MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }

    return "";
  }

  private cleanupStreams() {
    const stopTracks = (stream?: MediaStream) => {
      if (!stream) {
        return;
      }
      for (const track of stream.getTracks()) {
        track.stop();
      }
    };

    stopTracks(this.microphoneStream);
    stopTracks(this.systemStream);
    stopTracks(this.combinedStream);

    this.microphoneStream = undefined;
    this.systemStream = undefined;
    this.combinedStream = undefined;
    this.chunks = [];
  }

  private warn(message: string) {
    if (this.callbacks.onWarning) {
      this.callbacks.onWarning(message);
    }
  }

  private log(message: string, data?: unknown) {
    if (this.callbacks.onLog) {
      this.callbacks.onLog(message, data);
    }
  }
}
