type Str = string;
type b8 = boolean;

export type CliCommand =
  | "build"
  | "run"
  | "check"
  | "clean"
  | "parse"
  | "emit-c"
  | "emit-ast"
  | "emit-externs"
  | "watch"
  | "fmt"
  | "fmt-check"
  | "lsp"
  | "version"
  | "help";

export interface CliRequest {
  command: CliCommand;
  inputPath?: Str;
  inputPaths?: Str[];
  buildDir?: Str;
  outputPath?: Str;
  compilerFlags?: Str[];
}

export type CliParseError =
  | "missing command"
  | "unknown command"
  | "command does not take a source file"
  | "missing source file"
  | "source file must end with .tc"
  | "header file must end with .h"
  | "output file must end with .tc"
  | "output file must not be empty"
  | "build directory must not be empty"
  | "build directory option is not accepted"
  | "invalid option";

export interface CliParseResult {
  request?: CliRequest;
  error?: CliParseError;
}

interface BuildDirParseResult {
  value?: Str;
  error?: CliParseError;
}

const commands = new Set<Str>([
  "build",
  "run",
  "check",
  "clean",
  "parse",
  "emit-c",
  "emit-ast",
  "emit-externs",
  "watch",
  "fmt",
  "fmt-check",
  "lsp",
  "version",
  "help",
]);

export function parseCliArgs(args: Str[]): CliRequest | null {
  return parseCliArgsDetailed(args).request ?? null;
}

export function parseCliArgsDetailed(args: Str[]): CliParseResult {
  const [rawCommand, inputPath, ...options] = args;
  if (!rawCommand) return { error: "missing command" };
  const command = normalizeCliCommand(rawCommand);
  if (!command) return { error: "unknown command" };
  if (isSourceFreeCommand(command)) return parseSourceFreeCommand(command, inputPath, options);
  if (isFormatterCommand(command)) return parseFormatterCommand(command, inputPath, options);
  if (command === "emit-externs") return parseEmitExternsCommand(inputPath, options);
  if (!inputPath) return { error: "missing source file" };
  if (!isTypeCSourcePath(inputPath)) return { error: "source file must end with .tc" };
  const buildDir = parseBuildDirOption(command, options);
  if (buildDir.error) return { error: buildDir.error };
  return {
    request: buildDir.value
      ? { command, inputPath, buildDir: buildDir.value }
      : { command, inputPath },
  };
}

export function usageText(): Str {
  return [
    "Usage:",
    "  STC build <file.tc> [--build-dir <dir>]",
    "  STC run <file.tc> [--build-dir <dir>]",
    "  STC clean <file.tc> [--build-dir <dir>]",
    "  STC watch <file.tc> [--build-dir <dir>]",
    "  STC check <file.tc>",
    "  STC parse <file.tc>",
    "  STC emit-c <file.tc>",
    "  STC emit-ast <file.tc>",
    "  STC emit-externs <header.h> [-o <file.tc>] [-- <clang flags...>]",
    "  STC fmt <paths...>",
    "  STC fmt-check <paths...>",
    "  STC lsp",
    "  STC version | --version",
    "  STC help | --help",
  ].join("\n");
}

function parseSourceFreeCommand(
  command: CliCommand,
  inputPath: Str | undefined,
  options: Str[],
): CliParseResult {
  return options.length === 0 && inputPath === undefined
    ? { request: { command } }
    : { error: "command does not take a source file" };
}

function parseFormatterCommand(
  command: CliCommand,
  inputPath: Str | undefined,
  rest: Str[],
): CliParseResult {
  const inputPaths = inputPath ? [inputPath, ...rest] : [];
  if (inputPaths.length === 0) return { error: "missing source file" };
  if (!inputPaths.every(isTypeCSourcePath)) return { error: "source file must end with .tc" };
  return { request: { command, inputPath: inputPaths[0], inputPaths } };
}

function parseEmitExternsCommand(
  inputPath: Str | undefined,
  options: Str[],
): CliParseResult {
  if (!inputPath) return { error: "missing source file" };
  if (!inputPath.endsWith(".h")) return { error: "header file must end with .h" };
  const parsed = parseEmitExternsOptions(options);
  if (parsed.error) return { error: parsed.error };
  return {
    request: {
      command: "emit-externs",
      inputPath,
      outputPath: parsed.outputPath,
      compilerFlags: parsed.compilerFlags,
    },
  };
}

interface EmitExternsOptions {
  outputPath?: Str;
  compilerFlags: Str[];
  error?: CliParseError;
}

function parseEmitExternsOptions(options: Str[]): EmitExternsOptions {
  const separatorIndex = options.indexOf("--");
  const commandOptions = separatorIndex < 0 ? options : options.slice(0, separatorIndex);
  const compilerFlags = separatorIndex < 0 ? [] : options.slice(separatorIndex + 1);
  if (commandOptions.length === 0) return { compilerFlags };
  if (commandOptions.length !== 2 || commandOptions[0] !== "-o") {
    return { compilerFlags, error: "invalid option" };
  }
  const outputPath = commandOptions[1];
  if (outputPath.length === 0) return { compilerFlags, error: "output file must not be empty" };
  if (!outputPath.endsWith(".tc")) return { compilerFlags, error: "output file must end with .tc" };
  return { outputPath, compilerFlags };
}

function parseBuildDirOption(command: CliCommand, options: Str[]): BuildDirParseResult {
  if (options.length === 0) return {};
  const [name, value, extra] = options;
  if (name !== "--build-dir" || value === undefined || extra !== undefined) {
    return { error: "invalid option" };
  }
  if (!commandAcceptsBuildDir(command)) return { error: "build directory option is not accepted" };
  if (!validBuildDirValue(value)) return { error: "build directory must not be empty" };
  return { value };
}

function commandAcceptsBuildDir(command: CliCommand): b8 {
  return command === "build" || command === "run" || command === "clean" || command === "watch";
}

function validBuildDirValue(value: Str): b8 {
  return value.length > 0;
}

function isTypeCSourcePath(inputPath: Str): b8 {
  return inputPath.endsWith(".tc");
}

function isSourceFreeCommand(command: CliCommand): b8 {
  return command === "lsp" || command === "version" || command === "help";
}

function isFormatterCommand(command: CliCommand): b8 {
  return command === "fmt" || command === "fmt-check";
}

function normalizeCliCommand(command: Str): CliCommand | null {
  if (command === "--help") return "help";
  if (command === "--version") return "version";
  return isCliCommand(command) ? command : null;
}

function isCliCommand(command: Str): command is CliCommand {
  return commands.has(command);
}
