import { printAst } from "./ast_printer.ts";
import { buildNative } from "./c_compiler.ts";
import { type CliRequest, parseCliArgs, usageText } from "./cli.ts";
import { compileFile } from "./compiler.ts";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { runExecutable } from "./runner.ts";
import { watchFile } from "./watch.ts";

type Str = string;
type b8 = boolean;

async function main(args: Str[]): Promise<void> {
  const request = parseCliArgs(args);
  if (!request) usage();
  await execute(request);
}

async function execute(request: CliRequest): Promise<void> {
  switch (request.command) {
    case "watch":
      await watchFile(request.inputPath);
      return;
    case "emit-ast":
      await emitAst(request.inputPath);
      return;
    case "emit-c":
      await emitC(request.inputPath);
      return;
    case "build":
      await build(request.inputPath);
      return;
    case "run":
      await run(request.inputPath);
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

async function run(inputPath: Str): Promise<never> {
  const result = await compileFile(inputPath);
  requireMain(result.hasMain);
  await buildNative(result);
  console.log(`Built ${result.exePath}`);
  await runExecutable(result.exePath);
}

function requireMain(hasMain: b8): void {
  if (hasMain) return;
  console.error("Program entrypoint 'main' not found");
  Deno.exit(1);
}

function usage(): never {
  console.error(usageText());
  Deno.exit(1);
}

if (import.meta.main) await main(Deno.args);
