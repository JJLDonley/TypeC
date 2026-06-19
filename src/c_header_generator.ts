import { collectHeaderFunctions } from "./c_header_ast.ts";
import { readClangHeaderAst } from "./c_header_clang.ts";
import { formatHeaderExterns } from "./c_header_externs.ts";
import { headerCompilerFlags } from "./c_header_flags.ts";
import { directoryOf } from "./path.ts";

type Str = string;

export function generateExternsFromClangAst(ast: unknown, includeDir: Str | null = null): Str {
  return formatHeaderExterns(collectHeaderFunctions(ast), includeDir);
}

export async function generateExternsFromHeader(headerPath: Str, compilerFlags: Str[] = [], projectDir: Str = Deno.cwd()): Promise<Str> {
  const ast = await readClangHeaderAst(headerPath, headerCompilerFlags(compilerFlags, projectDir));
  return generateExternsFromClangAst(ast, directoryOf(headerPath));
}


