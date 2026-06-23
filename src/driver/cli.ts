type Str = string;

export type CliCommand = "build" | "run" | "emit-c" | "emit-ast" | "watch" | "lsp";

export interface CliRequest {
  command: CliCommand;
  inputPath?: Str;
}

const commands = new Set<Str>(["build", "run", "emit-c", "emit-ast", "watch", "lsp"]);

export function parseCliArgs(args: Str[]): CliRequest | null {
  const [command, inputPath] = args;
  if (!command) return null;
  if (!isCliCommand(command)) return null;
  if (command === "lsp") return { command };
  if (!inputPath) return null;
  return { command, inputPath };
}

export function usageText(): Str {
  return "Usage: deno run -A src/driver/main.ts <build|run|emit-c|emit-ast|watch> <file.tc> | lsp";
}

function isCliCommand(command: Str): command is CliCommand {
  return commands.has(command);
}
