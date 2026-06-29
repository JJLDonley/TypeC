import {
  type CHeaderConstant,
  type CHeaderEnum,
  collectHeaderConstants,
  collectHeaderEnums,
  collectHeaderFunctions,
  collectHeaderRecords,
} from "c/header/ast.ts";
import { readClangHeaderAst, readClangHeaderAstSync } from "c/header/clang.ts";
import { formatHeaderConstants } from "c/header/constants.ts";
import { formatHeaderEnums } from "c/header/enums.ts";
import { formatHeaderExterns } from "c/header/externs.ts";
import { collectHeaderMacroConstants } from "c/header/macros.ts";
import { formatHeaderRecordAliases } from "c/header/record_aliases.ts";
import { selectHeaderRecords } from "c/header/record_selection.ts";
import { supportedHeaderRecords } from "c/header/record_support.ts";
import { headerCompilerFlags } from "c/header/flags.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";
import { directoryOf } from "paths";

type Str = string;
type b8 = boolean;
type i32 = number;

const I32_MIN: i32 = -2147483648;
const I32_MAX: i32 = 2147483647;

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
  const enums = collectHeaderEnums(ast, mainSourceFile);
  const constants = [
    ...collectHeaderConstants(ast, mainSourceFile),
    ...enumMemberConstants(enums),
    ...macroConstants,
  ];
  return `${formatHeaderRecordAliases(records)}${formatHeaderEnums(enums, includeDir)}${
    formatHeaderConstants(constants, includeDir, recordNames)
  }${formatHeaderExterns(collectHeaderFunctions(ast, mainSourceFile), includeDir, recordNames)}`;
}

function enumMemberConstants(enums: CHeaderEnum[]): CHeaderConstant[] {
  return enums.filter(hasSupportedConstantMembers).flatMap((enumDecl) =>
    enumDecl.members.map((member) => ({
      name: member.name,
      type: "i32",
      value: member.value,
      sourceFile: enumDecl.sourceFile,
    }))
  );
}

function hasSupportedConstantMembers(enumDecl: CHeaderEnum): b8 {
  return (enumDecl.name === "" || isTypeCIdentifier(enumDecl.name)) &&
    enumDecl.members.every((member) => isTypeCIdentifier(member.name) && isI32Text(member.value));
}

function isI32Text(value: Str): b8 {
  if (!/^-?[0-9]+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= I32_MIN && parsed <= I32_MAX;
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

export function generateExternsFromHeaderSync(
  headerPath: Str,
  compilerFlags: Str[] = [],
  projectDir: Str = Deno.cwd(),
): Str {
  const flags = headerCompilerFlags(compilerFlags, projectDir);
  const ast = readClangHeaderAstSync(headerPath, flags);
  const macroConstants = collectHeaderMacroConstants(Deno.readTextFileSync(headerPath), headerPath);
  return generateExternsFromHeaderParts(ast, macroConstants, directoryOf(headerPath), headerPath);
}
