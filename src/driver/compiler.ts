import { check, type CheckedProgram } from "checker";
import { TypeCError } from "core/diagnostics.ts";
import { emitC } from "emitter";
import { exitWithTypeCDiagnostics } from "driver/diagnostics.ts";
import { readSourceText } from "driver/source_files.ts";
import { hasMain } from "core/entrypoint.ts";
import { instantiateGenerics } from "core/generics.ts";
import { loadProgram } from "module/loader.ts";
import { buildOutputPaths } from "paths";
import { loadProjectConfig } from "project/config.ts";
import { resolve } from "core/resolver.ts";

type Str = string;
type b8 = boolean;

export interface CompileResult {
  cPath: Str;
  exePath: Str;
  cSource: Str;
  hasMain: b8;
  compilerFlags: Str[];
}

interface CheckedSource {
  program: CheckedProgram;
  compilerFlags: Str[];
}

export async function compileFile(inputPath: Str, buildDir: Str = "build"): Promise<CompileResult> {
  const source = await readSourceText(inputPath);
  try {
    return await compileSourceFile(inputPath, buildDir);
  } catch (err) {
    if (err instanceof TypeCError) exitWithTypeCDiagnostics(inputPath, source, err);
    throw err;
  }
}

export async function checkFile(inputPath: Str): Promise<void> {
  const source = await readSourceText(inputPath);
  try {
    await checkSourceFile(inputPath);
  } catch (err) {
    if (err instanceof TypeCError) exitWithTypeCDiagnostics(inputPath, source, err);
    throw err;
  }
}

export async function emitCFile(inputPath: Str): Promise<Str> {
  const source = await readSourceText(inputPath);
  try {
    return (await compileSource(inputPath)).cSource;
  } catch (err) {
    if (err instanceof TypeCError) exitWithTypeCDiagnostics(inputPath, source, err);
    throw err;
  }
}

async function compileSourceFile(inputPath: Str, buildDir: Str): Promise<CompileResult> {
  const compiled = await compileSource(inputPath);
  await Deno.mkdir(buildDir, { recursive: true });
  const paths = buildOutputPaths(inputPath, buildDir);
  await Deno.writeTextFile(paths.cPath, compiled.cSource);
  return { ...paths, ...compiled };
}

async function checkSourceFile(inputPath: Str): Promise<void> {
  await checkedSource(inputPath);
}

async function compileSource(
  inputPath: Str,
): Promise<{ cSource: Str; hasMain: b8; compilerFlags: Str[] }> {
  const checked = await checkedSource(inputPath);
  return {
    cSource: emitC(checked.program),
    hasMain: hasMain(checked.program),
    compilerFlags: checked.compilerFlags,
  };
}

async function checkedSource(inputPath: Str): Promise<CheckedSource> {
  const config = await loadProjectConfig(inputPath);
  const ast = instantiateGenerics(await loadProgram(inputPath, config));
  return { program: check(resolve(ast)), compilerFlags: config.compilerFlags };
}
