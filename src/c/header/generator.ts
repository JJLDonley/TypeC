import {
  collectHeaderConstants,
  collectHeaderEnums,
  collectHeaderFunctions,
  collectHeaderRecords,
} from "c/header/ast.ts";
import { readClangHeaderAst } from "c/header/clang.ts";
import { formatHeaderConstants } from "c/header/constants.ts";
import { formatHeaderEnums } from "c/header/enums.ts";
import { formatHeaderExterns } from "c/header/externs.ts";
import { collectHeaderMacroConstants } from "c/header/macros.ts";
import { formatHeaderRecordAliases } from "c/header/record_aliases.ts";
import { selectHeaderRecords } from "c/header/record_selection.ts";
import { supportedHeaderRecords } from "c/header/record_support.ts";
import { headerCompilerFlags } from "c/header/flags.ts";
import { directoryOf } from "paths";

type Str = string;

export function generateExternsFromClangAst(
  ast: unknown,
  includeDir: Str | null = null,
  mainSourceFile: Str | null = null,
): Str {
  return generateExternsFromHeaderParts(ast, [], includeDir, mainSourceFile);
}

function generateExternsFromHeaderParts(
  ast: unknown,
  macroConstants: ReturnType<typeof collectHeaderMacroConstants>,
  includeDir: Str | null,
  mainSourceFile: Str | null,
): Str {
  const records = supportedHeaderRecords(
    selectHeaderRecords(collectHeaderRecords(ast, mainSourceFile), includeDir),
  );
  const recordNames = new Set<Str>(records.map((record) => record.name));
  const constants = [...collectHeaderConstants(ast, mainSourceFile), ...macroConstants];
  return `${formatHeaderRecordAliases(records)}${
    formatHeaderEnums(collectHeaderEnums(ast, mainSourceFile), includeDir)
  }${formatHeaderConstants(constants, includeDir, recordNames)}${
    formatHeaderExterns(collectHeaderFunctions(ast, mainSourceFile), includeDir, recordNames)
  }`;
}

export async function generateExternsFromHeader(
  headerPath: Str,
  compilerFlags: Str[] = [],
  projectDir: Str = Deno.cwd(),
): Promise<Str> {
  const flags = headerCompilerFlags(compilerFlags, projectDir);
  const ast = await readClangHeaderAst(headerPath, flags);
  const macroConstants = collectHeaderMacroConstants(
    await Deno.readTextFile(headerPath),
    headerPath,
  );
  return generateExternsFromHeaderParts(ast, macroConstants, directoryOf(headerPath), headerPath);
}
