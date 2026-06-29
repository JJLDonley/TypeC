import { printAst } from "core/ast_printer.ts";
import { buildNative } from "c/compiler.ts";
import { generateExternsFromHeader } from "c/header/generator.ts";
import { cleanSourceArtifacts } from "driver/clean.ts";
import {
  type CliParseError,
  type CliRequest,
  parseCliArgsDetailed,
  usageText,
} from "driver/cli.ts";
import { checkFile, compileFile, emitCFile } from "driver/compiler.ts";
import { missingMainMessage } from "core/entrypoint.ts";
import { EXIT_FAILURE } from "driver/exit_codes.ts";
import { formatSourceFile, sourceFileIsFormatted } from "driver/format.ts";
import { parseSourceFile } from "driver/syntax.ts";
import { runExecutable } from "driver/runner.ts";
import { runLspServer } from "lsp/stdio.ts";
import { versionText } from "driver/version.ts";
import { watchFile } from "driver/watch.ts";
import { SourceReadError } from "driver/source_files.ts";

type Str = string;
type b8 = boolean;

async function main(args: Str[]): Promise<void> {
  const result = parseCliArgsDetailed(args);
  if (!result.request) usage(result.error);
  try {
    await execute(result.request);
  } catch (err) {
    if (err instanceof SourceReadError) sourceReadError(err);
    throw err;
  }
}

async function execute(request: CliRequest): Promise<void> {
  switch (request.command) {
    case "lsp":
      await runLspServer();
      return;
    case "version":
      console.log(versionText());
      return;
    case "help":
      console.log(usageText());
      return;
    case "watch":
      await watchFile(requireInputPath(request), buildDir(request));
      return;
    case "emit-ast":
      await emitAst(requireInputPath(request));
      return;
    case "parse":
      await parseInput(requireInputPath(request));
      return;
    case "emit-c":
      await emitC(requireInputPath(request));
      return;
    case "emit-externs":
      await emitExterns(requireInputPath(request), request.outputPath, request.compilerFlags ?? []);
      return;
    case "clean":
      await cleanInput(requireInputPath(request), buildDir(request));
      return;
    case "check":
      await checkInput(requireInputPath(request));
      return;
    case "fmt":
      await formatFiles(requireInputPaths(request));
      return;
    case "fmt-check":
      await checkFormat(requireInputPaths(request));
      return;
    case "build":
      await build(requireInputPath(request), buildDir(request));
      return;
    case "run":
      await run(requireInputPath(request), buildDir(request));
      return;
  }
}

async function emitAst(inputPath: Str): Promise<void> {
  console.log(printAst(await parseSourceFile(inputPath)));
}

async function parseInput(inputPath: Str): Promise<void> {
  await parseSourceFile(inputPath);
  console.log(`Parsed ${inputPath}`);
}

async function emitC(inputPath: Str): Promise<void> {
  console.log(await emitCFile(inputPath));
}

async function emitExterns(
  headerPath: Str,
  outputPath: Str | undefined,
  compilerFlags: Str[],
): Promise<void> {
  const output = await generateExternsFromHeader(headerPath, compilerFlags);
  if (outputPath === undefined) {
    console.log(output);
    return;
  }
  await Deno.writeTextFile(outputPath, output);
  console.log(`Wrote ${outputPath}`);
}

async function checkInput(inputPath: Str): Promise<void> {
  await checkFile(inputPath);
  console.log(`Checked ${inputPath}`);
}

async function cleanInput(inputPath: Str, outputDir: Str): Promise<void> {
  await cleanSourceArtifacts(inputPath, outputDir);
  console.log(`Cleaned ${inputPath}`);
}

async function formatFiles(inputPaths: Str[]): Promise<void> {
  for (const inputPath of inputPaths) await formatSourceFile(inputPath);
}

async function checkFormat(inputPaths: Str[]): Promise<void> {
  const unformatted = await unformattedSourcePaths(inputPaths);
  if (unformatted.length === 0) return;
  console.error(`Format check failed ${unformatted.join(", ")}`);
  Deno.exit(EXIT_FAILURE);
}

async function unformattedSourcePaths(inputPaths: Str[]): Promise<Str[]> {
  const paths: Str[] = [];
  for (const inputPath of inputPaths) {
    if (!await sourceFileIsFormatted(inputPath)) paths.push(inputPath);
  }
  return paths;
}

async function build(inputPath: Str, outputDir: Str): Promise<void> {
  const result = await compileFile(inputPath, outputDir);
  requireMain(result.hasMain);
  await buildNative(result);
  console.log(`Built ${result.exePath}`);
}

async function run(inputPath: Str, outputDir: Str): Promise<void> {
  const result = await compileFile(inputPath, outputDir);
  requireMain(result.hasMain);
  await buildNative(result);
  console.log(`Built ${result.exePath}`);
  await runExecutable(result.exePath);
}

function requireInputPath(request: CliRequest): Str {
  if (request.inputPath) return request.inputPath;
  usage();
}

function requireInputPaths(request: CliRequest): Str[] {
  if (request.inputPaths && request.inputPaths.length > 0) return request.inputPaths;
  if (request.inputPath) return [request.inputPath];
  usage();
}

function buildDir(request: CliRequest): Str {
  return request.buildDir ?? "build";
}

function requireMain(hasMain: b8): void {
  if (hasMain) return;
  console.error(missingMainMessage());
  Deno.exit(EXIT_FAILURE);
}

function usage(error?: CliParseError): never {
  if (error) console.error(`Error: ${error}`);
  console.error(usageText());
  Deno.exit(EXIT_FAILURE);
}

function sourceReadError(err: SourceReadError): never {
  console.error(`Error: ${err.messageText}`);
  Deno.exit(EXIT_FAILURE);
}

if (import.meta.main) await main(Deno.args);
