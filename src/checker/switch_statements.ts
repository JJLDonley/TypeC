import { checkConstantIntegerDivision } from "checker/constant_division.ts";
import { evaluateBoolConstant, evaluateIntegerConstant } from "checker/constant_values.ts";
import { checkConstantExpression } from "checker/constants.ts";
import { isAssignable } from "checker/types.ts";
import type { ConstDecl, Expression, Statement } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";

type Str = string;
type b8 = boolean;

type SwitchStmt = Extract<Statement, { kind: "SwitchStmt" }>;

type ExpressionTyper = (expr: Expression) => TypeName;
type ExpectedExpressionTyper = (expr: Expression, expected: TypeName) => TypeName;
type BlockChecker = (statements: Statement[]) => Diagnostic[];

export function checkSwitchStatement(
  stmt: SwitchStmt,
  constants: Map<Str, ConstDecl>,
  typeOf: ExpressionTyper,
  typeOfExpected: ExpectedExpressionTyper,
  checkBlock: BlockChecker,
): Diagnostic[] {
  const switchType = typeOf(stmt.expression);
  return [
    ...checkSwitchType(stmt, switchType),
    ...checkSwitchLabels(stmt, switchType, constants, typeOfExpected),
    ...checkSwitchBodies(stmt, checkBlock),
  ];
}

function checkSwitchType(stmt: SwitchStmt, type: TypeName): Diagnostic[] {
  if (isSwitchType(type)) return [];
  return [{
    message: `Switch expression type '${type}' is not switchable`,
    span: stmt.expression.span,
  }];
}

function isSwitchType(type: TypeName): b8 {
  return type === "bool" || isIntegerTypeName(type);
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
          span: label.span,
        });
      }
      diagnostics.push(...checkDuplicateLabel(label, constants, labels));
    }
  }
  return diagnostics;
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
  return [{ message: `Duplicate switch case '${key}'`, span: label.span }];
}

function switchLabelKey(label: Expression, constants: Map<Str, ConstDecl>): Str | null {
  const boolValue = evaluateBoolConstant(label, constants);
  if (boolValue !== null) return boolValue ? "true" : "false";
  const value = evaluateIntegerConstant(label, constants);
  return value === null ? null : value.toString();
}

function checkSwitchBodies(stmt: SwitchStmt, checkBlock: BlockChecker): Diagnostic[] {
  return [
    ...stmt.cases.flatMap((switchCase) => checkBlock(switchCase.statements)),
    ...(stmt.defaultCase ? checkBlock(stmt.defaultCase.statements) : []),
  ];
}
