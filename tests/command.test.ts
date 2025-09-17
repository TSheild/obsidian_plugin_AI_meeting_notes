import { EventEmitter } from "events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spawnMock = vi.hoisted(() => vi.fn());

vi.mock("child_process", () => ({
  spawn: spawnMock,
}));

import { CommandExecutionError, runCommand, splitCommandLine } from "../src/utils/command";

class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();

  stderr = new EventEmitter();

  stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };
}

describe("splitCommandLine", () => {
  it("splits arguments respecting quotes", () => {
    const result = splitCommandLine('--model "base english" --flag');
    expect(result).toEqual(["--model", "base english", "--flag"]);
  });

  it("handles escaped characters and whitespace", () => {
    const result = splitCommandLine("run \\\"quoted\\\" 'single value' plain");
    expect(result).toEqual(["run", '"quoted"', "single value", "plain"]);
  });
});

describe("runCommand", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  it("returns stdout and stderr for successful execution", async () => {
    const child = new MockChildProcess();
    spawnMock.mockReturnValue(child as unknown as NodeJS.ChildProcess);

    const promise = runCommand("cmd", ["arg1"]);
    child.stdout.emit("data", Buffer.from("output"));
    child.stderr.emit("data", Buffer.from("warn"));
    child.emit("close", 0);

    const result = await promise;
    expect(result).toEqual({ stdout: "output", stderr: "warn", exitCode: 0 });
    expect(spawnMock).toHaveBeenCalledWith("cmd", ["arg1"], expect.objectContaining({ shell: false }));
  });

  it("writes provided input to stdin", async () => {
    const child = new MockChildProcess();
    spawnMock.mockReturnValue(child as unknown as NodeJS.ChildProcess);

    const promise = runCommand("cmd", [], { input: "hello" });
    child.emit("close", 0);

    await promise;
    expect(child.stdin.write).toHaveBeenCalledWith("hello");
    expect(child.stdin.end).toHaveBeenCalled();
  });

  it("rejects with errors emitted by the child process", async () => {
    const child = new MockChildProcess();
    spawnMock.mockReturnValue(child as unknown as NodeJS.ChildProcess);

    const promise = runCommand("cmd", []);
    const error = new Error("spawn failed");
    child.emit("error", error);

    await expect(promise).rejects.toBe(error);
  });

  it("rejects with CommandExecutionError when exit code is non-zero", async () => {
    const child = new MockChildProcess();
    spawnMock.mockReturnValue(child as unknown as NodeJS.ChildProcess);

    const promise = runCommand("cmd", []);
    child.stdout.emit("data", Buffer.from("out"));
    child.stderr.emit("data", Buffer.from("err"));
    child.emit("close", 2);

    await expect(promise).rejects.toBeInstanceOf(CommandExecutionError);
    await promise.catch((error) => {
      expect(error).toMatchObject({ exitCode: 2, stdout: "out", stderr: "err" });
    });
  });
});
