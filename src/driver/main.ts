import { printAst } from "core/ast_printer.ts";
import { buildNative } from "c/compiler.ts";
import { type CliRequest, parseCliArgs, usageText } from "driver/cli.ts";
import { compileFile } from "driver/compiler.ts";
import { missingMainMessage } from "core/entrypoint.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";
import { runExecutable } from "driver/runner.ts";
import { runLspServer } from "lsp/stdio.ts";
import { watchFile } from "driver/watch.ts";

type Str = string;
type b8 = boolean;

async function main(args: Str[]): Promise<void> {
  const request = parseCliArgs(args);
  if (!request) usage();
  await execute(request);
}

async function execute(request: CliRequest): Promise<void> {
  switch (request.command) {
    case "lsp":
      await runLspServer();
      return;
    case "watch":
      await watchFile(requireInputPath(request));
      return;
    case "emit-ast":
      await emitAst(requireInputPath(request));
      return;
    case "emit-c":
      await emitC(requireInputPath(request));
      return;
    case "build":
      await build(requireInputPath(request));
      return;
    case "run":
      await run(requireInputPath(request));
      return;
  }
}

async function emitAst(inputPath: Str): Promise<void> {
  console.log(printAst(parse(lex(await Deno.readTextFile(inputPath)))));
}

async function emitC(inputPath: Str): Promise<void> {
  const result = await compileFile(inputPath);
  console.log(result.cSource);
}

async function build(inputPath: Str): Promise<void> {
  const result = await compileFile(inputPath);
  requireMain(result.hasMain);
  await buildNative(result);
  console.log(`Built ${result.exePath}`);
}

async function run(inputPath: Str): Promise<void> {
  const result = await compileFile(inputPath);
  requireMain(result.hasMain);
  await buildNative(result);
  console.log(`Built ${result.exePath}`);
  await runExecutable(result.exePath);
}

function requireInputPath(request: CliRequest): Str {
  if (request.inputPath) return request.inputPath;
  usage();
}

function requireMain(hasMain: b8): void {
  if (hasMain) return;
  console.error(missingMainMessage());
  Deno.exit(1);
}

function usage(): never {
  console.error(usageText());
  Deno.exit(1);
}

if (import.meta.main) await main(Deno.args);
