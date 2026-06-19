import { collectHeaderFunctions } from "c/header/ast.ts";
import { readClangHeaderAst } from "c/header/clang.ts";
import { formatHeaderExterns } from "c/header/externs.ts";
import { headerCompilerFlags } from "c/header/flags.ts";
import { directoryOf } from "paths";

type Str = string;

export function generateExternsFromClangAst(ast: unknown, includeDir: Str | null = null): Str {
  return formatHeaderExterns(collectHeaderFunctions(ast), includeDir);
}

export async function generateExternsFromHeader(headerPath: Str, compilerFlags: Str[] = [], projectDir: Str = Deno.cwd()): Promise<Str> {
  const ast = await readClangHeaderAst(headerPath, headerCompilerFlags(compilerFlags, projectDir));
  return generateExternsFromClangAst(ast, directoryOf(headerPath));
}


