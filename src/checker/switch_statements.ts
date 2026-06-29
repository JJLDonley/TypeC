import {
  DUPLICATE_SWITCH_CASE,
  NON_EXHAUSTIVE_SWITCH,
  SWITCH_CASE_TYPE,
  SWITCH_TYPE,
} from "core/diagnostic_codes.ts";
import { checkConstantIntegerDivision } from "checker/constant_division.ts";
import { evaluateBoolConstant, evaluateIntegerConstant } from "checker/constant_values.ts";
import { checkConstantExpression } from "checker/constants.ts";
import { isAssignable } from "checker/types.ts";
import type { ConstDecl, EnumDecl, Expression, Statement, TaggedUnionDecl } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { qualifiedExpressionName } from "core/qualified_names.ts";

type Str = string;
type SwitchStmt = Extract<Statement, { kind: "SwitchStmt" }>;

type b8 = boolean;
type ExpressionTyper = (expr: Expression) => TypeName;
type ExpectedExpressionTyper = (expr: Expression, expected: TypeName) => TypeName;
type TypePredicate = (type: TypeName) => b8;
type Narrowing = [Str, Str];
type BlockChecker = (statements: Statement[], narrowing: Narrowing | null) => Diagnostic[];

export function checkSwitchStatement(
  stmt: SwitchStmt,
  constants: Map<Str, ConstDecl>,
  typeOf: ExpressionTyper,
  typeOfExpected: ExpectedExpressionTyper,
  checkBlock: BlockChecker,
  isEnumType: TypePredicate = () => false,
  enums: EnumDecl[] = [],
  taggedUnions: TaggedUnionDecl[] = [],
): Diagnostic[] {
  const switchType = typeOf(stmt.expression);
  return [
    ...checkSwitchType(stmt, switchType, isEnumType),
    ...checkSwitchLabels(stmt, switchType, constants, typeOfExpected),
    ...checkExhaustiveSwitch(stmt, switchType, typeOf, enums, taggedUnions),
    ...checkSwitchBodies(stmt, checkBlock),
  ];
}

function checkSwitchType(
  stmt: SwitchStmt,
  type: TypeName,
  isEnumType: TypePredicate,
): Diagnostic[] {
  if (isSwitchType(type, isEnumType)) return [];
  return [{
    message: `Switch expression type '${type}' is not switchable`,
    code: SWITCH_TYPE,
    span: stmt.expression.span,
  }];
}

function isSwitchType(type: TypeName, isEnumType: TypePredicate): b8 {
  return type === "bool" || isIntegerTypeName(type) || isEnumType(type);
}

function isIntegerTypeName(type: TypeName): b8 {
  return type === "i8" || type === "i16" || type === "i32" || type === "i64" ||
    type === "u8" || type === "u16" || type === "u32" || type === "u64" ||
    type === "usize";
}

function checkSwitchLabels(
  stmt: SwitchStmt,
  switchType: TypeName,
  constants: Map<Str, ConstDecl>,
  typeOfExpected: ExpectedExpressionTyper,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const labels = new Set<Str>();
  for (const switchCase of stmt.cases) {
    for (const label of switchCase.labels) {
      diagnostics.push(...checkConstantExpression(label, constants));
      diagnostics.push(...checkConstantIntegerDivision(label, constants));
      const labelType = typeOfExpected(label, switchType);
      if (!isAssignable(labelType, switchType)) {
        diagnostics.push({
          message: `Case label type '${labelType}' is not assignable to '${switchType}'`,
          code: SWITCH_CASE_TYPE,
          span: label.span,
        });
      }
      diagnostics.push(...checkDuplicateLabel(label, constants, labels));
    }
  }
  return diagnostics;
}

function checkExhaustiveSwitch(
  stmt: SwitchStmt,
  switchType: TypeName,
  typeOf: ExpressionTyper,
  enums: EnumDecl[],
  taggedUnions: TaggedUnionDecl[],
): Diagnostic[] {
  if (stmt.defaultCase) return [];
  const enumDecl = enums.find((candidate) => candidate.name === switchType) ?? null;
  if (enumDecl !== null) return enumExhaustivenessDiagnostics(stmt, enumDecl);
  const unionDecl = tagSwitchUnionDecl(stmt.expression, typeOf, taggedUnions);
  if (unionDecl !== null) return unionExhaustivenessDiagnostics(stmt, unionDecl);
  return [];
}

function enumExhaustivenessDiagnostics(stmt: SwitchStmt, enumDecl: EnumDecl): Diagnostic[] {
  const labels = switchMemberLabels(stmt, enumDecl.name);
  const missing = enumDecl.members
    .map((member) => member.name)
    .filter((member) => !labels.has(member));
  return nonExhaustiveDiagnostics(stmt, enumDecl.name, missing);
}

function unionExhaustivenessDiagnostics(
  stmt: SwitchStmt,
  unionDecl: TaggedUnionDecl,
): Diagnostic[] {
  const labels = switchMemberLabels(stmt, unionDecl.name);
  const missing = unionDecl.variants
    .map((variant) => variant.name)
    .filter((variant) => !labels.has(variant));
  return nonExhaustiveDiagnostics(stmt, unionDecl.name, missing);
}

function nonExhaustiveDiagnostics(
  stmt: SwitchStmt,
  ownerName: Str,
  missing: Str[],
): Diagnostic[] {
  if (missing.length === 0) return [];
  return [{
    message: `Non-exhaustive switch on '${ownerName}' is missing case(s): ${
      missing.map((name) => `${ownerName}.${name}`).join(", ")
    }`,
    code: NON_EXHAUSTIVE_SWITCH,
    span: stmt.expression.span,
  }];
}

function switchMemberLabels(stmt: SwitchStmt, ownerName: Str): Set<Str> {
  const labels = new Set<Str>();
  for (const switchCase of stmt.cases) {
    for (const label of switchCase.labels) {
      const member = qualifiedMemberLabel(label, ownerName);
      if (member !== null) labels.add(member);
    }
  }
  return labels;
}

function qualifiedMemberLabel(label: Expression, ownerName: Str): Str | null {
  const name = qualifiedExpressionName(label);
  const prefix = `${ownerName}.`;
  if (name === null || !name.startsWith(prefix)) return null;
  return name.slice(prefix.length);
}

function tagSwitchUnionName(expr: Expression): Str | null {
  if (expr.kind !== "FieldAccessExpr" || expr.field !== "tag") return null;
  if (expr.operand.kind !== "IdentifierExpr") return null;
  return expr.operand.name;
}

function tagSwitchUnionDecl(
  expr: Expression,
  typeOf: ExpressionTyper,
  taggedUnions: TaggedUnionDecl[],
): TaggedUnionDecl | null {
  if (expr.kind !== "FieldAccessExpr" || expr.field !== "tag") return null;
  const operandType = typeOf(expr.operand);
  return taggedUnions.find((candidate) => candidate.name === operandType) ?? null;
}

function checkDuplicateLabel(
  label: Expression,
  constants: Map<Str, ConstDecl>,
  labels: Set<Str>,
): Diagnostic[] {
  const key = switchLabelKey(label, constants);
  if (key === null) return [];
  if (!labels.has(key)) {
    labels.add(key);
    return [];
  }
  return [{
    message: `Duplicate switch case '${key}'`,
    code: DUPLICATE_SWITCH_CASE,
    span: label.span,
  }];
}

function switchLabelKey(label: Expression, constants: Map<Str, ConstDecl>): Str | null {
  const boolValue = evaluateBoolConstant(label, constants);
  if (boolValue !== null) return boolValue ? "true" : "false";
  const value = evaluateIntegerConstant(label, constants);
  return value === null ? null : value.toString();
}

function checkSwitchBodies(stmt: SwitchStmt, checkBlock: BlockChecker): Diagnostic[] {
  const unionValueName = tagSwitchUnionName(stmt.expression);
  return [
    ...stmt.cases.flatMap((switchCase) =>
      checkBlock(switchCase.statements, switchCaseNarrowing(switchCase.labels, unionValueName))
    ),
    ...(stmt.defaultCase ? checkBlock(stmt.defaultCase.statements, null) : []),
  ];
}

function switchCaseNarrowing(labels: Expression[], unionValueName: Str | null): Narrowing | null {
  if (unionValueName === null || labels.length !== 1) return null;
  const variant = qualifiedExpressionName(labels[0]);
  if (variant === null) return null;
  const separator = variant.lastIndexOf(".");
  if (separator < 0) return null;
  return [unionValueName, variant.slice(separator + 1)];
}
