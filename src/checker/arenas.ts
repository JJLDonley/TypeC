import type { Expression } from "core/ast.ts";
import {
  ARENA_ALLOC_TARGET,
  ARENA_ARGUMENT_TYPE,
  ARENA_CALL_ARITY,
} from "core/diagnostic_codes.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isAssignable } from "checker/types.ts";
import { parseSafePointerTypeName } from "checker/type_name_shapes.ts";

type Str = string;
type b8 = boolean;
type usize = number;

type CallExpr = Extract<Expression, { kind: "CallExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface BuiltinCallCheck {
  handled: b8;
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkArenaCall(expr: CallExpr, resolveType: TypeResolver): BuiltinCallCheck {
  if (expr.callee === "arenaCreate") return checkArenaCreate(expr);
  if (expr.callee === "arenaDestroy") return checkArenaDestroy(expr, resolveType);
  if (expr.callee === "arenaAlloc") return missingArenaAllocationTarget(expr.span);
  return unhandledCall();
}

export function checkExpectedArenaCall(
  expr: Expression,
  expected: TypeName,
  resolveType: TypeResolver,
  resolveExpectedType: ExpectedTypeResolver,
): BuiltinCallCheck {
  if (expr.kind !== "CallExpr" || expr.callee !== "arenaAlloc") return unhandledCall();
  return checkArenaAlloc(expr, expected, resolveType, resolveExpectedType);
}

export function isBuiltinArenaTypeName(name: Str): b8 {
  return name === "Arena";
}

function checkArenaCreate(expr: CallExpr): BuiltinCallCheck {
  return handledCall("Arena", checkArity(expr, 0));
}

function checkArenaDestroy(expr: CallExpr, resolveType: TypeResolver): BuiltinCallCheck {
  const diagnostics = checkArity(expr, 1);
  if (expr.args[0]) diagnostics.push(...checkArgument(expr.args[0], "Arena", resolveType));
  return handledCall("void", diagnostics);
}

function checkArenaAlloc(
  expr: CallExpr,
  expected: TypeName,
  resolveType: TypeResolver,
  resolveExpectedType: ExpectedTypeResolver,
): BuiltinCallCheck {
  const diagnostics = checkArity(expr, 2);
  diagnostics.push(...checkSafePointerTarget(expected, expr.span));
  if (expr.args[0]) diagnostics.push(...checkArgument(expr.args[0], "Arena", resolveType));
  if (expr.args[1]) {
    diagnostics.push(...checkExpectedArgument(expr.args[1], "usize", resolveExpectedType));
  }
  return handledCall(expected, diagnostics);
}

function checkSafePointerTarget(expected: TypeName, span: SourceSpan): Diagnostic[] {
  if (parseSafePointerTypeName(expected) !== null) return [];
  return [{
    message: "arenaAlloc requires expected SafePtr<T> target type",
    code: ARENA_ALLOC_TARGET,
    span,
  }];
}

function checkArgument(
  expr: Expression,
  expected: TypeName,
  resolveType: TypeResolver,
): Diagnostic[] {
  const actual = resolveType(expr);
  if (isAssignable(actual, expected)) return [];
  return [typeMismatch(actual, expected, expr.span)];
}

function checkExpectedArgument(
  expr: Expression,
  expected: TypeName,
  resolveExpectedType: ExpectedTypeResolver,
): Diagnostic[] {
  const actual = resolveExpectedType(expr, expected);
  if (isAssignable(actual, expected)) return [];
  return [typeMismatch(actual, expected, expr.span)];
}

function checkArity(expr: CallExpr, expected: usize): Diagnostic[] {
  if (expr.args.length === expected) return [];
  return [{
    message: `Function '${expr.callee}' expects ${expected} argument(s)`,
    code: ARENA_CALL_ARITY,
    span: expr.span,
  }];
}

function typeMismatch(actual: TypeName, expected: TypeName, span: SourceSpan): Diagnostic {
  return {
    message: `Type mismatch: expected ${expected}, got ${actual}`,
    code: ARENA_ARGUMENT_TYPE,
    span,
  };
}

function missingArenaAllocationTarget(span: SourceSpan): BuiltinCallCheck {
  return handledCall("<error>", [{
    message: "arenaAlloc requires expected SafePtr<T> target type",
    code: ARENA_ALLOC_TARGET,
    span,
  }]);
}

function handledCall(type: TypeName, diagnostics: Diagnostic[]): BuiltinCallCheck {
  return { handled: true, diagnostics, type };
}

function unhandledCall(): BuiltinCallCheck {
  return { handled: false, diagnostics: [], type: "<error>" };
}
