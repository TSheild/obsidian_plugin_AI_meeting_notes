import { Notice } from 'obsidian';
import { MeetingNotesSettings } from './settings';

export async function transcribeAudio(blob: Blob, settings: MeetingNotesSettings): Promise<string> {
        if (!settings.transcriptionEndpoint) {
                                throw new Error('Transcription endpoint is not configured.');
        }

        const formData = new FormData();
        formData.append('file', blob, 'meeting.webm');
        if (settings.transcriptionModel) {
                formData.append('model', settings.transcriptionModel);
        }
        if (settings.transcriptionLanguage) {
                formData.append('language', settings.transcriptionLanguage);
        }

        const response = await fetch(settings.transcriptionEndpoint, {
                method: 'POST',
                body: formData
        });

        if (!response.ok) {
                throw new Error(`Transcription service responded with ${response.status}`);
        }

        const data = await response.json() as Record<string, unknown>;
        const textCandidate = data['text'] ?? data['transcript'] ?? data['result'];

        if (typeof textCandidate !== 'string' || textCandidate.trim().length === 0) {
                throw new Error('Transcription service did not return a transcript.');
        }

        return textCandidate.trim();
}

export async function summariseTranscript(transcript: string, settings: MeetingNotesSettings): Promise<string> {
        if (!settings.summarizationEndpoint || !settings.summarizationModel) {
                throw new Error('Summarisation endpoint is not configured.');
        }

        const trimmedTranscript = settings.summarizationMaxCharacters > 0
                ? transcript.slice(0, settings.summarizationMaxCharacters)
                : transcript;

        const prompt = settings.summarizationPrompt.replace(/{{transcript}}/g, trimmedTranscript);

        const response = await fetch(settings.summarizationEndpoint, {
                method: 'POST',
                headers: {
                        'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                        model: settings.summarizationModel,
                        prompt,
                        stream: false
                })
        });

        if (!response.ok) {
                throw new Error(`Summarisation service responded with ${response.status}`);
        }

        const data = await response.json() as Record<string, unknown>;
        const textCandidate = data['response'] ?? data['text'] ?? data['summary'];

        if (typeof textCandidate !== 'string' || textCandidate.trim().length === 0) {
                throw new Error('Summarisation service did not return text.');
        }

        return textCandidate.trim();
}

export function notifyWithConsoleFallback(message: string, level: 'info' | 'error' = 'info'): void {
        try {
                new Notice(message, 8000);
        } catch (error) {
                if (level === 'error') {
                        console.error(message);
                } else {
                        console.info(message);
                }
        }
}
