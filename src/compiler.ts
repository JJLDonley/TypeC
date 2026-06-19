import { check } from "./checker.ts";
import { formatDiagnostic, TypeCError } from "./diagnostics.ts";
import { emitC } from "./emitter.ts";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { resolve } from "./resolver.ts";

export interface CompileResult {
  cPath: string;
  exePath: string;
  cSource: string;
}

export async function compileFile(inputPath: string, buildDir = "build"): Promise<CompileResult> {
  const source = await Deno.readTextFile(inputPath);
  try {
    const tokens = lex(source);
    const ast = parse(tokens);
    const resolved = resolve(ast);
    const checked = check(resolved);
    const cSource = emitC(checked);

    await Deno.mkdir(buildDir, { recursive: true });
    const base = basenameNoExt(inputPath);
    const cPath = `${buildDir}/${base}.c`;
    const exePath = `${buildDir}/${base}`;
    await Deno.writeTextFile(cPath, cSource);
    return { cPath, exePath, cSource };
  } catch (err) {
    if (err instanceof TypeCError) {
      console.error(err.diagnostics.map((d) => formatDiagnostic(inputPath, source, d)).join("\n"));
      Deno.exit(1);
    }
    throw err;
  }
}

export async function buildNative(result: CompileResult): Promise<void> {
  const command = new Deno.Command("cc", { args: [result.cPath, "-o", result.exePath] });
  const output = await command.output();
  if (!output.success) {
    console.error(new TextDecoder().decode(output.stderr));
    Deno.exit(output.code);
  }
}

function basenameNoExt(path: string): string {
  const file = path.split(/[\\/]/).pop() ?? "out";
  return file.replace(/\.[^.]+$/, "");
}
