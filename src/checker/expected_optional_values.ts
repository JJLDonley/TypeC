import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { optionalTypeNameElement } from "checker/type_name_shapes.ts";
import { isAssignable } from "checker/types.ts";

type b8 = boolean;
type usize = number;

export interface ExpectedOptionalConstructorCheck {
  handled: b8;
  diagnostics: Diagnostic[];
  type: TypeName;
}

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkExpectedOptionalConstructorCall(
  expr: Expression,
  expected: TypeName,
  resolveExpectedType: ExpectedTypeResolver,
): ExpectedOptionalConstructorCheck {
  if (expr.kind !== "CallExpr") return unhandled();
  if (expr.callee !== "Some" && expr.callee !== "None") return unhandled();
  if (hasExplicitTypeArgs(expr)) return unhandled();
  const element = optionalTypeNameElement(expected);
  if (element === null) return unhandled();
  const diagnostics = expr.callee === "Some"
    ? checkExpectedSome(expr, element, resolveExpectedType)
    : checkExpectedNone(expr);
  return { handled: true, diagnostics, type: expected };
}

function hasExplicitTypeArgs(expr: Extract<Expression, { kind: "CallExpr" }>): b8 {
  return (expr.typeArgs?.length ?? 0) > 0;
}

function checkExpectedSome(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  expected: TypeName,
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  const diagnostics = checkArity(expr, 1);
  const value = expr.args[0] ?? null;
  if (value === null) return diagnostics;
  const actual = resolveExpectedType(value, expected);
  if (isAssignable(actual, expected)) return diagnostics;
  diagnostics.push({
    message: `Type '${actual}' is not assignable to '${expected}'`,
    span: value.span,
  });
  return diagnostics;
}

function checkExpectedNone(expr: Extract<Expression, { kind: "CallExpr" }>): Diagnostic[] {
  return checkArity(expr, 0);
}

function checkArity(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  expected: usize,
): Diagnostic[] {
  return expr.args.length === expected ? [] : [{
    message: `${expr.callee} expects ${expected} arguments, got ${expr.args.length}`,
    span: expr.span,
  }];
}

function unhandled(): ExpectedOptionalConstructorCheck {
  return { handled: false, diagnostics: [], type: "<error>" };
}
