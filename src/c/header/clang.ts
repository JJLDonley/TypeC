import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

interface ClangOutput {
  ok: b8;
  stdout: Str;
  stderr: Str;
}

export async function readClangHeaderAst(headerPath: Str, compilerFlags: Str[]): Promise<unknown> {
  const output = await runClangAstDump(headerPath, compilerFlags);
  if (!output.ok) throw new TypeCError([{ message: `clang failed while reading '${headerPath}': ${output.stderr}` }]);
  return parseClangJson(output.stdout);
}

async function runClangAstDump(headerPath: Str, compilerFlags: Str[]): Promise<ClangOutput> {
  const command = new Deno.Command("clang", {
    args: ["-x", "c", "-Xclang", "-ast-dump=json", "-fsyntax-only", ...compilerFlags, headerPath],
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const decoder = new TextDecoder();
  return { ok: output.success, stdout: decoder.decode(output.stdout), stderr: decoder.decode(output.stderr).trim() };
}

function parseClangJson(text: Str): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeCError([{ message: "clang did not emit valid JSON" }]);
  }
}
