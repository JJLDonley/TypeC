import { evaluateIntegerConstant } from "checker/constant_values.ts";
import { checkConstantExpression } from "checker/constants.ts";
import { integerRange } from "checker/types.ts";
import { enumMemberConstant } from "core/enums.ts";
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
  for (let index: usize = 0; index < enumDecl.members.length; index++) {
    const member = enumDecl.members[index]!;
    if (names.has(member.name)) {
      diagnostics.push({ message: `Duplicate enum member '${member.name}'`, span: member.span });
    }
    names.add(member.name);
    const value = member.initializer
      ? evaluateEnumInitializer(member, available, diagnostics)
      : previous + 1n;
    if (value !== null) {
      diagnostics.push(...checkI32EnumValue(value, member.span));
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
      span: initializer.span,
    });
  }
  return value;
}

function checkI32EnumValue(value: IntValue, span: Diagnostic["span"]): Diagnostic[] {
  const range = integerRange("i32")!;
  if (value >= range.min && value <= range.max) return [];
  return [{ message: `Enum member value '${value}' is out of range for 'i32'`, span }];
}
