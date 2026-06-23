import { check } from "checker";
import { formatDiagnostic, TypeCError } from "core/diagnostics.ts";
import { emitC } from "emitter";
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

export async function compileFile(inputPath: Str, buildDir: Str = "build"): Promise<CompileResult> {
  const source = await Deno.readTextFile(inputPath);
  try {
    return await compileSourceFile(inputPath, buildDir);
  } catch (err) {
    if (err instanceof TypeCError) exitWithDiagnostics(inputPath, source, err);
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

async function compileSource(
  inputPath: Str,
): Promise<{ cSource: Str; hasMain: b8; compilerFlags: Str[] }> {
  const config = await loadProjectConfig(inputPath);
  const ast = instantiateGenerics(await loadProgram(inputPath, config));
  const resolved = resolve(ast);
  const checked = check(resolved);
  return {
    cSource: emitC(checked),
    hasMain: hasMain(checked),
    compilerFlags: config.compilerFlags,
  };
}

function exitWithDiagnostics(inputPath: Str, source: Str, err: TypeCError): never {
  console.error(
    err.diagnostics.map((diagnostic) => formatDiagnostic(inputPath, source, diagnostic)).join("\n"),
  );
  Deno.exit(1);
}
