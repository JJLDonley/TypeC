import { lex } from "core/lexer.ts";
import { parse } from "parser";
import type { Program } from "core/ast.ts";
import { TypeCError } from "core/diagnostics.ts";
import { exitWithTypeCDiagnostics } from "driver/diagnostics.ts";
import { readSourceText } from "driver/source_files.ts";

type Str = string;

export async function parseSourceFile(inputPath: Str): Promise<Program> {
  const source = await readSourceText(inputPath);
  try {
    return parseSource(source);
  } catch (err) {
    if (err instanceof TypeCError) exitWithTypeCDiagnostics(inputPath, source, err);
    throw err;
  }
}

export function parseSource(source: Str): Program {
  return parse(lex(source));
}
