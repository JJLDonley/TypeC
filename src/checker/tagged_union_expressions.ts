import type { Expression, TaggedUnionDecl, TaggedUnionVariant } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { taggedUnionDecl, taggedUnionVariant } from "core/tagged_unions.ts";
import { typeName } from "core/type_ref.ts";
import { isAssignable } from "checker/types.ts";

type Str = string;
type b8 = boolean;

type MethodCallExpr = Extract<Expression, { kind: "MethodCallExpr" }>;
type FieldAccessExpr = Extract<Expression, { kind: "FieldAccessExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface TaggedUnionExpressionCheck {
  handled: b8;
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkTaggedUnionConstructor(
  expr: MethodCallExpr,
  unions: TaggedUnionDecl[],
  resolveExpected: ExpectedTypeResolver,
): TaggedUnionExpressionCheck {
  if (expr.receiver.kind !== "IdentifierExpr") return unhandled();
  const unionDecl = taggedUnionDecl(unions, expr.receiver.name);
  if (unionDecl === null) return unhandled();
  const variant = taggedUnionVariant(unions, unionDecl.name, expr.method);
  if (variant === null) {
    return handled(unionDecl.name, [{
      message: `Unknown union variant '${expr.method}'`,
      span: expr.span,
    }]);
  }
  return handled(unionDecl.name, checkVariantArgs(expr, variant, resolveExpected));
}

export function checkTaggedUnionFieldAccess(
  expr: FieldAccessExpr,
  operandType: TypeName,
  unions: TaggedUnionDecl[],
): TaggedUnionExpressionCheck {
  const unionDecl = taggedUnionDecl(unions, operandType);
  if (unionDecl === null) return unhandled();
  if (expr.field === "tag") return handled("i32", []);
  const variant = unionDecl.variants.find((candidate) => candidate.name === expr.field) ?? null;
  if (variant === null) {
    return handled("<error>", [{
      message: `Unknown union variant '${expr.field}'`,
      span: expr.span,
    }]);
  }
  if (variant.payload === null) {
    return handled("<error>", [{
      message: `Union variant '${expr.field}' has no payload`,
      span: expr.span,
    }]);
  }
  return handled(typeName(variant.payload), []);
}

function checkVariantArgs(
  expr: MethodCallExpr,
  variant: TaggedUnionVariant,
  resolveExpected: ExpectedTypeResolver,
): Diagnostic[] {
  const expectedCount = variant.payload === null ? 0 : 1;
  if (expr.args.length !== expectedCount) {
    return [{
      message: `Union variant '${variant.name}' expects ${expectedCount} argument(s)`,
      span: expr.span,
    }];
  }
  if (variant.payload === null || expr.args[0] === undefined) return [];
  const expected = typeName(variant.payload);
  const actual = resolveExpected(expr.args[0], expected);
  if (isAssignable(actual, expected)) return [];
  return [{
    message: `Type mismatch: expected ${expected}, got ${actual}`,
    span: expr.args[0].span,
  }];
}

function handled(type: TypeName, diagnostics: Diagnostic[]): TaggedUnionExpressionCheck {
  return { handled: true, diagnostics, type };
}

function unhandled(): TaggedUnionExpressionCheck {
  return { handled: false, diagnostics: [], type: "<error>" };
}
