import { C_HEADER_CLANG_FAILED, C_HEADER_INVALID_JSON } from "core/diagnostic_codes.ts";
import { TypeCError } from "core/diagnostics.ts";

type Str = string;
type b8 = boolean;

interface ClangOutput {
  ok: b8;
  stdout: Str;
  stderr: Str;
}

export async function readClangHeaderAst(headerPath: Str, compilerFlags: Str[]): Promise<unknown> {
  return readCheckedClangHeaderAst(headerPath, await runClangAstDump(headerPath, compilerFlags));
}

export function readClangHeaderAstSync(headerPath: Str, compilerFlags: Str[]): unknown {
  return readCheckedClangHeaderAst(headerPath, runClangAstDumpSync(headerPath, compilerFlags));
}

function readCheckedClangHeaderAst(headerPath: Str, output: ClangOutput): unknown {
  if (!output.ok) {
    throw new TypeCError([{
      message: `clang failed while reading '${headerPath}': ${output.stderr}`,
      code: C_HEADER_CLANG_FAILED,
    }]);
  }
  return parseClangJson(output.stdout);
}

async function runClangAstDump(headerPath: Str, compilerFlags: Str[]): Promise<ClangOutput> {
  return clangOutput(await clangCommand(headerPath, compilerFlags).output());
}

function runClangAstDumpSync(headerPath: Str, compilerFlags: Str[]): ClangOutput {
  return clangOutput(clangCommand(headerPath, compilerFlags).outputSync());
}

function clangCommand(headerPath: Str, compilerFlags: Str[]): Deno.Command {
  return new Deno.Command("clang", {
    args: ["-x", "c", "-Xclang", "-ast-dump=json", "-fsyntax-only", ...compilerFlags, headerPath],
    stdout: "piped",
    stderr: "piped",
  });
}

function clangOutput(output: Deno.CommandOutput): ClangOutput {
  const decoder = new TextDecoder();
  return {
    ok: output.success,
    stdout: decoder.decode(output.stdout),
    stderr: decoder.decode(output.stderr).trim(),
  };
}

function parseClangJson(text: Str): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new TypeCError([{
      message: "clang did not emit valid JSON",
      code: C_HEADER_INVALID_JSON,
    }]);
  }
}
