export class TAbstractFile {
  path: string;

  constructor(path: string) {
    this.path = normalizePath(path);
  }
}

export class TFile extends TAbstractFile {
  data: string | ArrayBuffer | null = null;
}

export class FileSystemAdapter {
  constructor(private basePath: string) {}

  getBasePath(): string {
    return this.basePath;
  }
}

export class App {
  vault: any;

  constructor() {
    this.vault = {};
  }
}

export function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}
