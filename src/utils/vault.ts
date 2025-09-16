import { App, FileSystemAdapter, normalizePath } from "obsidian";
import * as path from "path";

export class VaultFileManager {
  constructor(private readonly app: App) {}

  getNormalizedPath(vaultPath: string): string {
    return normalizePath(vaultPath);
  }

  async ensureFolder(folderPath: string): Promise<void> {
    const normalized = this.getNormalizedPath(folderPath);
    if (normalized === "." || normalized === "") {
      return;
    }
    const adapter = this.app.vault.adapter;
    if (await adapter.exists(normalized)) {
      return;
    }
    try {
      await this.app.vault.createFolder(normalized);
    } catch (error) {
      if (!(await adapter.exists(normalized))) {
        throw error;
      }
    }
  }

  async writeBinary(filePath: string, data: ArrayBuffer): Promise<void> {
    const normalized = this.getNormalizedPath(filePath);
    const dirName = path.dirname(normalized);
    await this.ensureFolder(dirName);
    await this.app.vault.adapter.writeBinary(normalized, data);
  }

  async writeText(filePath: string, data: string): Promise<void> {
    const normalized = this.getNormalizedPath(filePath);
    const dirName = path.dirname(normalized);
    await this.ensureFolder(dirName);
    await this.app.vault.adapter.write(normalized, data);
  }

  async readText(filePath: string): Promise<string> {
    const normalized = this.getNormalizedPath(filePath);
    return this.app.vault.adapter.read(normalized);
  }

  async pathExists(vaultPath: string): Promise<boolean> {
    const normalized = this.getNormalizedPath(vaultPath);
    return this.app.vault.adapter.exists(normalized);
  }

  getAbsolutePath(vaultRelativePath: string): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("File system operations are only available on desktop.");
    }
    const basePath = adapter.getBasePath();
    return path.resolve(basePath, this.getNormalizedPath(vaultRelativePath));
  }

  getVaultRoot(): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error("File system operations are only available on desktop.");
    }
    return adapter.getBasePath();
  }
}
