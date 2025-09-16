import { runCommand } from "../utils/command";

export interface SummarizerConfig {
  command: string;
  args: string[];
  prompt: string;
}

export async function summarizeTranscript(config: SummarizerConfig): Promise<string> {
  const result = await runCommand(config.command, config.args, {
    input: config.prompt.endsWith("\n") ? config.prompt : `${config.prompt}\n`,
  });

  return result.stdout.trim();
}
