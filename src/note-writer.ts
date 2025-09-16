import { App, normalizePath, TFile } from 'obsidian';
import { MeetingNotesSettings } from './settings';
import { RecordingResult } from './recorder';

export interface NoteCreationContext {
        transcript: string;
        summary?: string;
        audioPath?: string;
        recording: RecordingResult;
}

export async function saveRecordingToVault(app: App, settings: MeetingNotesSettings, result: RecordingResult): Promise<string> {
        const folder = settings.recordingsFolder.trim();
        if (folder.length > 0) {
                await ensureFolder(app, folder);
        }

        const extension = inferExtension(result.blob.type);
        const fileName = buildFileName('meeting-audio', result.startedAt, extension);
        const targetPath = normalizePath((folder ? `${folder}/${fileName}` : fileName));
        const arrayBuffer = await result.blob.arrayBuffer();
        await app.vault.adapter.writeBinary(targetPath, arrayBuffer);
        return targetPath;
}

export async function writeMeetingNote(app: App, settings: MeetingNotesSettings, context: NoteCreationContext): Promise<TFile> {
        const folder = settings.notesFolder.trim();
        if (folder.length > 0) {
                await ensureFolder(app, folder);
        }

        const title = buildNoteTitle(context.recording.startedAt);
        const basePath = folder ? `${folder}/${title}.md` : `${title}.md`;
        const notePath = await findAvailablePath(app, basePath);
        const content = buildNoteContent(settings, context, title);
        return app.vault.create(notePath, content);
}

async function ensureFolder(app: App, folder: string): Promise<void> {
        const path = normalizePath(folder);
        if (!path.length) {
                return;
        }

        const segments = path.split('/');
        let current = '';

        for (const segment of segments) {
                current = current ? `${current}/${segment}` : segment;
                if (!(await app.vault.adapter.exists(current))) {
                        await app.vault.createFolder(current);
                }
        }
}

async function findAvailablePath(app: App, basePath: string): Promise<string> {
        let normalized = normalizePath(basePath);
        let counter = 1;
        const extensionIndex = normalized.lastIndexOf('.');
        const prefix = extensionIndex === -1 ? normalized : normalized.substring(0, extensionIndex);
        const suffix = extensionIndex === -1 ? '' : normalized.substring(extensionIndex);

        while (app.vault.getAbstractFileByPath(normalized)) {
                normalized = `${prefix} ${counter}${suffix}`;
                counter += 1;
        }

        return normalized;
}

function buildFileName(prefix: string, date: Date, extension: string): string {
        const timestamp = formatDate(date).replace(/[:]/g, '-');
        return `${prefix}-${timestamp}.${extension}`;
}

function buildNoteTitle(date: Date): string {
        const day = formatDate(date).split('T')[0];
        return `Meeting Notes ${day}`;
}

function buildNoteContent(settings: MeetingNotesSettings, context: NoteCreationContext, title: string): string {
        const frontMatterLines = [
                '---',
                `created: ${context.recording.startedAt.toISOString()}`,
                `duration: ${formatDuration(context.recording.durationMs)}`,
                `systemAudio: ${context.recording.capturedSystemAudio}`,
                context.audioPath ? `audio: ${normalizePath(context.audioPath)}` : null,
                '---'
        ].filter((line): line is string => Boolean(line));

        const header = `# ${title}`;
        const audioLink = context.audioPath && settings.linkAudioInNote
                ? `\n[Audio recording](${normalizePath(context.audioPath)})\n`
                : '';

        const summary = context.summary?.trim().length
                ? context.summary.trim()
                : '## Summary\n- Summary not available.';

        const transcriptSection = context.transcript.trim().length
                ? `\n## Transcript\n${context.transcript.trim()}\n`
                : '';

        return `${frontMatterLines.join('\n')}\n\n${header}\n${audioLink}\n${summary}\n${transcriptSection}`.trim() + '\n';
}

function formatDate(date: Date): string {
        const pad = (value: number) => value.toString().padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function inferExtension(mimeType: string | undefined): string {
        if (!mimeType) {
                return 'webm';
        }
        if (mimeType.includes('ogg')) {
                return 'ogg';
        }
        if (mimeType.includes('wav')) {
                return 'wav';
        }
        if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
                return 'm4a';
        }
        return 'webm';
}

function formatDuration(durationMs: number): string {
        const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const parts = [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0'));
        return parts.join(':');
}
