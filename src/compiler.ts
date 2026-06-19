import { check } from "./checker.ts";
import { formatDiagnostic, TypeCError } from "./diagnostics.ts";
import { emitC } from "./emitter.ts";
import { loadProgram } from "./module_loader.ts";
import { buildOutputPaths } from "./path.ts";
import { resolve } from "./resolver.ts";

type Str = string;

export interface CompileResult {
  cPath: Str;
  exePath: Str;
  cSource: Str;
}

export async function compileFile(inputPath: Str, buildDir: Str = "build"): Promise<CompileResult> {
  const source = await Deno.readTextFile(inputPath);
  try {
    return await compileSourceFile(inputPath, buildDir, source);
  } catch (err) {
    if (err instanceof TypeCError) exitWithDiagnostics(inputPath, source, err);
    throw err;
  }
}

async function compileSourceFile(inputPath: Str, buildDir: Str, _source: Str): Promise<CompileResult> {
  const cSource = await compileSource(inputPath);
  await Deno.mkdir(buildDir, { recursive: true });
  const paths = buildOutputPaths(inputPath, buildDir);
  await Deno.writeTextFile(paths.cPath, cSource);
  return { ...paths, cSource };
}

async function compileSource(inputPath: Str): Promise<Str> {
  const ast = await loadProgram(inputPath);
  const resolved = resolve(ast);
  const checked = check(resolved);
  return emitC(checked);
}

function exitWithDiagnostics(inputPath: Str, source: Str, err: TypeCError): never {
  console.error(err.diagnostics.map((diagnostic) => formatDiagnostic(inputPath, source, diagnostic)).join("\n"));
  Deno.exit(1);
}
