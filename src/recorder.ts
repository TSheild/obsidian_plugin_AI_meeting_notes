export interface RecordingResult {
        blob: Blob;
        startedAt: Date;
        durationMs: number;
        capturedSystemAudio: boolean;
}

interface ActiveRecording {
        recorder: MediaRecorder;
        chunks: Blob[];
        audioContext: AudioContext;
        streams: MediaStream[];
        startedAt: Date;
        capturedSystemAudio: boolean;
}

const MEDIA_RECORDER_OPTIONS: MediaRecorderOptions = {
        mimeType: 'audio/webm;codecs=opus'
};

export class MeetingAudioRecorder {
        private activeRecording: ActiveRecording | null = null;

        get isRecording(): boolean {
                return this.activeRecording !== null;
        }

        async start(includeSystemAudio: boolean): Promise<void> {
                if (this.activeRecording) {
                        throw new Error('Recording is already in progress.');
                }

                const audioContext = new AudioContext();
                if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                }

                const destination = audioContext.createMediaStreamDestination();
                const streams: MediaStream[] = [];
                let capturedSystemAudio = false;

                const microphoneStream = await navigator.mediaDevices.getUserMedia({audio: true});
                streams.push(microphoneStream);
                const microphoneSource = audioContext.createMediaStreamSource(microphoneStream);
                microphoneSource.connect(destination);

                if (includeSystemAudio) {
                        try {
                                const systemStream = await navigator.mediaDevices.getDisplayMedia({
                                        audio: true,
                                        video: true
                                });
                                const audioTracks = systemStream.getAudioTracks();
                                if (audioTracks.length > 0) {
                                        const systemAudioStream = new MediaStream(audioTracks);
                                        const systemSource = audioContext.createMediaStreamSource(systemAudioStream);
                                        systemSource.connect(destination);
                                        streams.push(systemStream);
                                        capturedSystemAudio = true;
                                } else {
                                        systemStream.getTracks().forEach((track) => track.stop());
                                }
                        } catch (error) {
                                console.warn('System audio capture unavailable', error);
                        }
                }

                const recorder = new MediaRecorder(destination.stream, MEDIA_RECORDER_OPTIONS);
                const chunks: Blob[] = [];

                recorder.ondataavailable = (event: BlobEvent) => {
                        if (event.data && event.data.size > 0) {
                                chunks.push(event.data);
                        }
                };

                const startedAt = new Date();
                recorder.start(1000);

                this.activeRecording = {
                        recorder,
                        chunks,
                        audioContext,
                        streams,
                        startedAt,
                        capturedSystemAudio
                };
        }

        async stop(): Promise<RecordingResult> {
                if (!this.activeRecording) {
                        throw new Error('No active recording to stop.');
                }

                const {recorder, chunks, audioContext, streams, startedAt, capturedSystemAudio} = this.activeRecording;
                this.activeRecording = null;

                const result = await new Promise<Blob>((resolve, reject) => {
                        recorder.onstop = () => {
                                resolve(new Blob(chunks, {type: MEDIA_RECORDER_OPTIONS.mimeType}));
                        };
                        recorder.onerror = (event) => {
                                reject(event.error ?? new Error('Unknown MediaRecorder error'));
                        };
                        try {
                                recorder.stop();
                        } catch (error) {
                                reject(error);
                        }
                });

                streams.forEach((stream) => {
                        stream.getTracks().forEach((track) => track.stop());
                });
                audioContext.close().catch((error) => console.warn('Failed to close audio context', error));

                const durationMs = Date.now() - startedAt.getTime();

                return {
                        blob: result,
                        startedAt,
                        durationMs,
                        capturedSystemAudio
                };
        }

        async cancel(): Promise<void> {
                if (!this.activeRecording) {
                        return;
                }

                const {recorder, streams, audioContext} = this.activeRecording;
                this.activeRecording = null;

                recorder.stop();
                streams.forEach((stream) => {
                        stream.getTracks().forEach((track) => track.stop());
                });
                audioContext.close().catch((error) => console.warn('Failed to close audio context', error));
        }
}
