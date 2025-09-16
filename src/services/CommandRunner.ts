import { spawn } from "child_process";

export interface CommandOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  useShell?: boolean;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CommandExecutionError extends Error {
  readonly command: string;
  readonly args: string[];
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(
    command: string,
    args: string[],
    exitCode: number | null,
    stdout: string,
    stderr: string,
    message?: string,
  ) {
    const details = message ??
      `Command failed${exitCode !== null ? ` with exit code ${exitCode}` : ""}: ${command} ${args.join(" ")}`;
    super(details);
    this.command = command;
    this.args = args;
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export async function runCommand(command: string, args: string[], options: CommandOptions = {}): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.useShell ?? process.platform === "win32",
    });

    let stdout = "";
    let stderr = "";
    let finished = false;
    let timeoutHandle: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      if (finished) return;
      finished = true;
      cleanup();
      reject(error);
    });

    child.on("close", (code) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (code === 0) {
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      } else {
        reject(new CommandExecutionError(command, args, code ?? null, stdout, stderr));
      }
    });

    if (options.timeoutMs && options.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        if (finished) {
          return;
        }
        finished = true;
        child.kill("SIGKILL");
        cleanup();
        reject(new CommandExecutionError(command, args, null, stdout, stderr, `Command timed out after ${options.timeoutMs}ms`));
      }, options.timeoutMs);
    }
  });
}
