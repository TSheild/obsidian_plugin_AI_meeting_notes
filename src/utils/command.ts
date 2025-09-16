import { spawn } from "child_process";

export interface RunCommandOptions {
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
}

export interface RunCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CommandExecutionError extends Error {
  stdout: string;
  stderr: string;
  exitCode: number;

  constructor(message: string, stdout: string, stderr: string, exitCode: number) {
    super(message);
    this.stdout = stdout;
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

export function splitCommandLine(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let isEscaped = false;

  for (const char of input) {
    if (isEscaped) {
      current += char;
      isEscaped = false;
      continue;
    }

    if (char === "\\") {
      isEscaped = true;
      continue;
    }

    if (char === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }

    if (char === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }

    if ((char === " " || char === "\n" || char === "\t") && !inSingle && !inDouble) {
      if (current.length > 0) {
        args.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

export async function runCommand(command: string, args: string[], options: RunCommandOptions = {}): Promise<RunCommandResult> {
  return new Promise<RunCommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (error: Error) => {
      reject(error);
    });

    child.on("close", (code: number) => {
      const exitCode = code ?? 0;
      if (exitCode === 0) {
        resolve({ stdout, stderr, exitCode });
      } else {
        reject(new CommandExecutionError(`Command failed with exit code ${exitCode}`, stdout, stderr, exitCode));
      }
    });

    if (options.input !== undefined) {
      if (child.stdin) {
        child.stdin.write(options.input);
        child.stdin.end();
      }
    } else if (child.stdin) {
      child.stdin.end();
    }
  });
}
