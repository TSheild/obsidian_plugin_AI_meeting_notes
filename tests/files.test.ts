import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, FileSystemAdapter, TFile, normalizePath } from "obsidian";
import {
  absolutePathToVaultPath,
  ensureFolder,
  getAbsolutePath,
  joinVaultPath,
  saveBinaryFile,
  saveTextFile,
} from "../src/utils/files";

class MockFileSystemAdapter extends FileSystemAdapter {
  folders: Set<string>;

  constructor(basePath: string, folders: Iterable<string> = []) {
    super(basePath);
    this.folders = new Set(Array.from(folders, (folder) => normalizePath(folder)));
  }

  async exists(path: string) {
    return this.folders.has(normalizePath(path));
  }
}

type StoredFile = TFile & { data: string | ArrayBuffer | null };

function createEnvironment(initialFolders: string[] = []) {
  const folders = new Set(initialFolders.map((folder) => normalizePath(folder)));
  const adapter = new MockFileSystemAdapter("/vault", folders);
  const files = new Map<string, StoredFile>();

  const createFolder = vi.fn(async (path: string) => {
    const normalized = normalizePath(path);
    folders.add(normalized);
    adapter.folders.add(normalized);
  });

  const getAbstractFileByPath = vi.fn((path: string) => files.get(normalizePath(path)) ?? null);

  const createBinary = vi.fn(async (path: string, data: ArrayBuffer) => {
    const normalized = normalizePath(path);
    const file = new TFile(normalized) as StoredFile;
    file.data = data;
    files.set(normalized, file);
    return file;
  });

  const modifyBinary = vi.fn(async (file: StoredFile, data: ArrayBuffer) => {
    file.data = data;
    return file;
  });

  const create = vi.fn(async (path: string, content: string) => {
    const normalized = normalizePath(path);
    const file = new TFile(normalized) as StoredFile;
    file.data = content;
    files.set(normalized, file);
    return file;
  });

  const modify = vi.fn(async (file: StoredFile, content: string) => {
    file.data = content;
    return file;
  });

  const vault = {
    adapter,
    createFolder,
    getAbstractFileByPath,
    createBinary,
    modifyBinary,
    create,
    modify,
  };

  const app = { vault } as unknown as App;

  return { app, adapter, folders, files, vault };
}

describe("file utilities", () => {
  let env: ReturnType<typeof createEnvironment>;

  beforeEach(() => {
    env = createEnvironment(["AI Meeting Notes"]);
  });

  it("creates missing nested folders", async () => {
    await ensureFolder(env.app, "AI Meeting Notes/Audio");

    expect(env.vault.createFolder).toHaveBeenCalledTimes(1);
    expect(env.vault.createFolder).toHaveBeenCalledWith("AI Meeting Notes/Audio");
    expect(env.adapter.folders.has("AI Meeting Notes/Audio")).toBe(true);
  });

  it("ignores empty folder paths", async () => {
    await ensureFolder(env.app, "");
    await ensureFolder(env.app, undefined);

    expect(env.vault.createFolder).not.toHaveBeenCalled();
  });

  it("joins vault paths correctly", () => {
    expect(joinVaultPath("folder", "file.md")).toBe("folder/file.md");
    expect(joinVaultPath("", "file.md")).toBe("file.md");
  });

  it("resolves absolute paths when adapter is filesystem based", () => {
    expect(getAbsolutePath(env.app, "folder/file.md")).toBe("/vault/folder/file.md");
    expect(getAbsolutePath(env.app, ".")).toBe("/vault");
  });

  it("converts absolute paths to vault-relative paths", () => {
    const result = absolutePathToVaultPath(env.app, "/vault/sub/file.md");
    expect(result).toBe("sub/file.md");
  });

  it("creates binary files when they do not exist", async () => {
    const buffer = new ArrayBuffer(8);
    const file = await saveBinaryFile(env.app, "audio.webm", buffer);

    expect(env.vault.createBinary).toHaveBeenCalledWith("audio.webm", buffer);
    expect(env.files.get("audio.webm")).toBe(file);
  });

  it("updates binary files when they already exist", async () => {
    const existing = new TFile("audio.webm") as StoredFile;
    env.files.set("audio.webm", existing);

    const buffer = new ArrayBuffer(4);
    const file = await saveBinaryFile(env.app, "audio.webm", buffer);

    expect(env.vault.modifyBinary).toHaveBeenCalledWith(existing, buffer);
    expect(file).toBe(existing);
  });

  it("creates and updates text files", async () => {
    const created = await saveTextFile(env.app, "notes/note.md", "hello");
    expect(env.vault.create).toHaveBeenCalledWith("notes/note.md", "hello");

    const existing = created as StoredFile;
    env.files.set("notes/note.md", existing);
    const updated = await saveTextFile(env.app, "notes/note.md", "updated");

    expect(env.vault.modify).toHaveBeenCalledWith(existing, "updated");
    expect(updated).toBe(existing);
    expect(env.files.get("notes/note.md")).toBe(existing);
  });
});
