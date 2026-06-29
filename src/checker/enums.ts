import {
  DUPLICATE_ENUM_MEMBER,
  ENUM_BACKING_TYPE,
  ENUM_MEMBER_CONSTANT,
  ENUM_MEMBER_RANGE,
} from "core/diagnostic_codes.ts";
import { evaluateIntegerConstant } from "checker/constant_values.ts";
import { checkConstantExpression } from "checker/constants.ts";
import { integerRange } from "checker/types.ts";
import { enumBackingType, enumMemberConstant } from "core/enums.ts";
import type { ConstDecl, EnumDecl } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";

type Str = string;
type IntValue = bigint;
type usize = number;
type b8 = boolean;

export function isEnumTypeName(type: Str, enums: EnumDecl[]): b8 {
  return enums.some((enumDecl) => enumDecl.name === type);
}

export interface EnumCheckResult {
  constants: ConstDecl[];
  diagnostics: Diagnostic[];
}

export function checkEnums(enums: EnumDecl[], constants: Map<Str, ConstDecl>): EnumCheckResult {
  const diagnostics: Diagnostic[] = [];
  const enumConstants: ConstDecl[] = [];
  const available = new Map<Str, ConstDecl>(constants);
  for (const enumDecl of enums) {
    const result = checkEnum(enumDecl, available);
    diagnostics.push(...result.diagnostics);
    enumConstants.push(...result.constants);
    for (const constant of result.constants) available.set(constant.name, constant);
  }
  return { constants: enumConstants, diagnostics };
}

function checkEnum(enumDecl: EnumDecl, constants: Map<Str, ConstDecl>): EnumCheckResult {
  const diagnostics: Diagnostic[] = [];
  const enumConstants: ConstDecl[] = [];
  const names = new Set<Str>();
  let previous: IntValue = -1n;
  const available = new Map<Str, ConstDecl>(constants);
  diagnostics.push(...checkEnumBackingType(enumDecl));
  for (let index: usize = 0; index < enumDecl.members.length; index++) {
    const member = enumDecl.members[index]!;
    if (names.has(member.name)) {
      diagnostics.push({
        message: `Duplicate enum member '${member.name}'`,
        code: DUPLICATE_ENUM_MEMBER,
        span: member.span,
      });
    }
    names.add(member.name);
    const value = member.initializer
      ? evaluateEnumInitializer(member, available, diagnostics)
      : previous + 1n;
    if (value !== null) {
      diagnostics.push(...checkEnumValue(enumDecl, value, member.span));
      const constant = enumMemberConstant(enumDecl, index, value);
      enumConstants.push(constant);
      available.set(constant.name, constant);
      previous = value;
    }
  }
  return { constants: enumConstants, diagnostics };
}

function evaluateEnumInitializer(
  member: EnumDecl["members"][usize],
  constants: Map<Str, ConstDecl>,
  diagnostics: Diagnostic[],
): IntValue | null {
  const initializer = member.initializer;
  if (initializer === null) return null;
  diagnostics.push(...checkConstantExpression(initializer, constants));
  const value = evaluateIntegerConstant(initializer, constants);
  if (value === null) {
    diagnostics.push({
      message: "Enum member initializer must be an integer constant",
      code: ENUM_MEMBER_CONSTANT,
      span: initializer.span,
    });
  }
  return value;
}

function checkEnumBackingType(enumDecl: EnumDecl): Diagnostic[] {
  const name = enumBackingTypeName(enumDecl);
  if (name !== null && integerRange(name) !== null) return [];
  return [{
    message: `Enum backing type must be a fixed-width integer type`,
    code: ENUM_BACKING_TYPE,
    span: enumDecl.span,
  }];
}

function checkEnumValue(
  enumDecl: EnumDecl,
  value: IntValue,
  span: Diagnostic["span"],
): Diagnostic[] {
  const name = enumBackingTypeName(enumDecl) ?? "<error>";
  const range = integerRange(name);
  if (range !== null && value >= range.min && value <= range.max) return [];
  return [{
    message: `Enum member value '${value}' is out of range for '${name}'`,
    code: ENUM_MEMBER_RANGE,
    span,
  }];
}

function enumBackingTypeName(enumDecl: EnumDecl): Str | null {
  const backing = enumBackingType(enumDecl);
  return backing.kind === "NamedTypeRef" && !backing.typeArgs ? backing.name : null;
}
