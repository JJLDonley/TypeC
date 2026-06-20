import {
  collectHeaderConstants,
  collectHeaderFunctions,
  collectHeaderRecords,
} from "c/header/ast.ts";
import { readClangHeaderAst } from "c/header/clang.ts";
import { formatHeaderConstants } from "c/header/constants.ts";
import { formatHeaderExterns } from "c/header/externs.ts";
import { formatHeaderRecordAliases } from "c/header/record_aliases.ts";
import { selectHeaderRecords } from "c/header/record_selection.ts";
import { supportedHeaderRecords } from "c/header/record_support.ts";
import { headerCompilerFlags } from "c/header/flags.ts";
import { directoryOf } from "paths";

type Str = string;

export function generateExternsFromClangAst(ast: unknown, includeDir: Str | null = null): Str {
  const records = supportedHeaderRecords(
    selectHeaderRecords(collectHeaderRecords(ast), includeDir),
  );
  const recordNames = new Set<Str>(records.map((record) => record.name));
  return `${formatHeaderRecordAliases(records)}${
    formatHeaderConstants(collectHeaderConstants(ast), includeDir, recordNames)
  }${formatHeaderExterns(collectHeaderFunctions(ast), includeDir, recordNames)}`;
}

export async function generateExternsFromHeader(
  headerPath: Str,
  compilerFlags: Str[] = [],
  projectDir: Str = Deno.cwd(),
): Promise<Str> {
  const ast = await readClangHeaderAst(headerPath, headerCompilerFlags(compilerFlags, projectDir));
  return generateExternsFromClangAst(ast, directoryOf(headerPath));
}
