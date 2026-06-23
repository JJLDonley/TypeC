import type { CHeaderEnum, CHeaderEnumMember } from "c/header/ast.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";
import { isIncludedHeaderConstant } from "c/header/support.ts";

export type Str = string;
type b8 = boolean;
type i32 = number;

const I32_MIN: i32 = -2147483648;
const I32_MAX: i32 = 2147483647;

export function formatHeaderEnums(
  enums: CHeaderEnum[],
  includeDir: Str | null = null,
): Str {
  const declarations = uniqueHeaderEnums(
    enums.filter((enumDecl) => isIncludedHeaderEnum(enumDecl, includeDir)),
  )
    .filter(isSupportedHeaderEnum)
    .map(formatHeaderEnum);
  return `${declarations.join("\n")}${declarations.length > 0 ? "\n" : ""}`;
}

function isIncludedHeaderEnum(enumDecl: CHeaderEnum, includeDir: Str | null): b8 {
  return isIncludedHeaderConstant(
    { name: enumDecl.name, type: "int", value: "0", sourceFile: enumDecl.sourceFile },
    includeDir,
  );
}

function uniqueHeaderEnums(enums: CHeaderEnum[]): CHeaderEnum[] {
  const seen = new Set<Str>();
  const unique: CHeaderEnum[] = [];
  for (const enumDecl of enums) {
    const key = headerEnumKey(enumDecl);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    unique.push(enumDecl);
  }
  return unique;
}

function headerEnumKey(enumDecl: CHeaderEnum): Str | null {
  if (!isSupportedHeaderEnum(enumDecl)) return null;
  return `${enumDecl.name}:${
    enumDecl.members.map((member) => `${member.name}=${member.value}`).join(",")
  }`;
}

function isSupportedHeaderEnum(enumDecl: CHeaderEnum): b8 {
  return isTypeCIdentifier(enumDecl.name) && hasMembers(enumDecl) &&
    hasUniqueMemberNames(enumDecl) &&
    enumDecl.members.every(isSupportedHeaderEnumMember);
}

function hasMembers(enumDecl: CHeaderEnum): b8 {
  return enumDecl.members.length > 0;
}

function hasUniqueMemberNames(enumDecl: CHeaderEnum): b8 {
  const names = new Set<Str>();
  for (const member of enumDecl.members) {
    if (names.has(member.name)) return false;
    names.add(member.name);
  }
  return true;
}

function isSupportedHeaderEnumMember(member: CHeaderEnumMember): b8 {
  return isTypeCIdentifier(member.name) && isI32Text(member.value);
}

function isI32Text(value: Str): b8 {
  if (!/^-?[0-9]+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= I32_MIN && parsed <= I32_MAX;
}

function formatHeaderEnum(enumDecl: CHeaderEnum): Str {
  return `export enum ${enumDecl.name} {\n${
    enumDecl.members.map(formatHeaderEnumMember).join("\n")
  }\n}`;
}

function formatHeaderEnumMember(member: CHeaderEnumMember): Str {
  return `  ${member.name} = ${member.value},`;
}
