type Str = string;

export type CliCommand = "build" | "run" | "emit-c" | "emit-ast" | "watch";

export interface CliRequest {
  command: CliCommand;
  inputPath: Str;
}

const commands = new Set<Str>(["build", "run", "emit-c", "emit-ast", "watch"]);

export function parseCliArgs(args: Str[]): CliRequest | null {
  const [command, inputPath] = args;
  if (!command || !inputPath) return null;
  if (!isCliCommand(command)) return null;
  return { command, inputPath };
}

export function usageText(): Str {
  return "Usage: deno run -A src/main.ts <build|run|emit-c|emit-ast|watch> <file.tc>";
}

function isCliCommand(command: Str): command is CliCommand {
  return commands.has(command);
}
