import type { Expression, FunctionDecl, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkCallArguments } from "checker/calls.ts";
import { checkFieldAccessExpression } from "checker/field_access_expressions.ts";
import { checkIndexExpression } from "checker/index_expressions.ts";
import { optionalTypeNameElement } from "checker/type_name_shapes.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

type OptionalFieldAccessExpr = Extract<Expression, { kind: "OptionalFieldAccessExpr" }>;
type OptionalMethodCallExpr = Extract<Expression, { kind: "OptionalMethodCallExpr" }>;
type OptionalIndexExpr = Extract<Expression, { kind: "OptionalIndexExpr" }>;
type TypeResolver = (expr: Expression) => TypeName;
type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface OptionalChainCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkOptionalFieldAccessExpression(
  expr: OptionalFieldAccessExpr,
  operandType: TypeName,
  aliases: Map<Str, TypeRef>,
): OptionalChainCheck {
  const elementType = optionalChainElementType(expr, operandType);
  if (elementType.diagnostics.length > 0) return elementType;
  const result = checkFieldAccessExpression(fieldAccess(expr), elementType.type, aliases);
  return optionalResult(result);
}

export function checkOptionalIndexExpression(
  expr: OptionalIndexExpr,
  operandType: TypeName,
  resolveType: TypeResolver,
): OptionalChainCheck {
  const elementType = optionalChainElementType(expr, operandType);
  if (elementType.diagnostics.length > 0) return elementType;
  const result = checkIndexExpression(indexAccess(expr), elementType.type, resolveType);
  return optionalResult(result);
}

export function checkOptionalMethodCallExpression(
  expr: OptionalMethodCallExpr,
  operandType: TypeName,
  fn: FunctionDecl | undefined,
  resolveExpectedType: ExpectedTypeResolver,
  resolveType: TypeResolver,
): OptionalChainCheck {
  const elementType = optionalChainElementType(expr, operandType);
  if (elementType.diagnostics.length > 0) return elementType;
  if (!fn) return unknownOptionalMethod(expr, elementType.type);
  return optionalResult({
    diagnostics: checkCallArguments(
      expr.args,
      { ...fn, params: fn.params.slice(1) },
      resolveExpectedType,
      resolveType,
      expr.span,
    ),
    type: typeName(fn.returnType),
  });
}

function optionalChainElementType(
  expr: Expression,
  operandType: TypeName,
): OptionalChainCheck {
  const elementType = optionalTypeNameElement(operandType);
  if (elementType !== null) return { diagnostics: [], type: elementType };
  return {
    diagnostics: [
      {
        message: `Optional chaining requires optional operand, got '${operandType}'`,
        span: expr.span,
      },
    ],
    type: "<error>",
  };
}

function optionalResult(result: OptionalChainCheck): OptionalChainCheck {
  if (result.type === "<error>" || result.type.endsWith("?")) return result;
  return { diagnostics: result.diagnostics, type: `${result.type}?` };
}

function fieldAccess(
  expr: OptionalFieldAccessExpr,
): Extract<Expression, { kind: "FieldAccessExpr" }> {
  return { kind: "FieldAccessExpr", operand: expr.operand, field: expr.field, span: expr.span };
}

function indexAccess(expr: OptionalIndexExpr): Extract<Expression, { kind: "IndexExpr" }> {
  return { kind: "IndexExpr", operand: expr.operand, index: expr.index, span: expr.span };
}

function unknownOptionalMethod(
  expr: OptionalMethodCallExpr,
  receiverType: TypeName,
): OptionalChainCheck {
  return {
    diagnostics: [{
      message: `Unknown method '${expr.method}' on optional type '${receiverType}?'`,
      span: expr.span,
    }],
    type: "<error>",
  };
}
