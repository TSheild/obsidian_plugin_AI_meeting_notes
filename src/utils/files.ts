import { App, FileSystemAdapter, TAbstractFile, TFile, normalizePath } from "obsidian";
import * as path from "path";

export async function ensureFolder(app: App, folderPath?: string): Promise<void> {
  if (!folderPath || folderPath.trim().length === 0) {
    return;
  }

  const adapter = app.vault.adapter;
  const normalized = normalizePath(folderPath.trim());
  const segments = normalized.split("/");
  let current = "";

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    // eslint-disable-next-line no-await-in-loop
    const exists = await adapter.exists(current);
    if (!exists) {
      // eslint-disable-next-line no-await-in-loop
      await app.vault.createFolder(current);
    }
  }
}

export function joinVaultPath(folderPath: string | undefined, fileName: string): string {
  if (!folderPath || folderPath.trim().length === 0) {
    return normalizePath(fileName);
  }
  return normalizePath(`${folderPath}/${fileName}`);
}

export function getAbsolutePath(app: App, vaultPath: string): string | null {
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    const basePath = adapter.getBasePath();
    if (!vaultPath || vaultPath === ".") {
      return basePath;
    }
    return path.join(basePath, vaultPath);
  }
  return null;
}

export function absolutePathToVaultPath(app: App, absolutePath: string): string | null {
  const adapter = app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    const basePath = adapter.getBasePath();
    const relative = path.relative(basePath, absolutePath);
    return normalizePath(relative);
  }
  return null;
}

export async function saveBinaryFile(app: App, vaultPath: string, data: ArrayBuffer): Promise<TFile> {
  const normalized = normalizePath(vaultPath);
  const existing = app.vault.getAbstractFileByPath(normalized);
  if (existing instanceof TFile) {
    await app.vault.modifyBinary(existing, data);
    return existing;
  }
  return app.vault.createBinary(normalized, data);
}

export async function saveTextFile(app: App, vaultPath: string, content: string): Promise<TFile> {
  const normalized = normalizePath(vaultPath);
  const existing: TAbstractFile | null = app.vault.getAbstractFileByPath(normalized);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
    return existing;
  }
  return app.vault.create(normalized, content);
}
