import type { Expression, FixedArrayTypeRef, Statement, TypeRef } from "core/ast.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";
import { spanKey } from "checker/exprs.ts";
import { cStringByteLength } from "core/c_strings.ts";
import { emitCDeclarator, emitCType } from "c/type.ts";
import { typeRefFromTypeName } from "checker/type_name_type_refs.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpressionExpected } from "emitter/expressions.ts";
import { emitCTypeName } from "emitter/type_names.ts";
import { emitCStringLiteral } from "emitter/strings.ts";

type Str = string;
type b8 = boolean;

type VarDeclStatement = Extract<Statement, { kind: "VarDeclStmt" }>;
type StringLiteralExpression = Extract<Expression, { kind: "StringLiteral" }>;

export function emitArrayVarDecl(stmt: VarDeclStatement, context: EmitContext): Str {
  if (stmt.initializer.kind === "StringLiteral") {
    return emitStringArrayVarDecl({ ...stmt, initializer: stmt.initializer }, context);
  }
  if (
    stmt.initializer.kind !== "ArrayLiteralExpr" && stmt.initializer.kind !== "ZeroValueExpr" &&
    !isArrayFillExpression(stmt.initializer)
  ) {
    throw new Error("Array declarations require array-compatible literals");
  }
  const shape = arrayDeclShape(stmt, context);
  const initializer = stmt.initializer.kind === "ZeroValueExpr"
    ? "{0}"
    : emitExpressionExpected(stmt.initializer, shape.expectedType, context);
  return `${constPrefix(stmt)}${shape.declarator} = ${initializer};`;
}

function emitStringArrayVarDecl(
  stmt: VarDeclStatement & { initializer: StringLiteralExpression },
  context: EmitContext,
): Str {
  const type = concreteArrayDeclType(stmt, context);
  const element = emitCType(type.element, context.typeAliases);
  const length = stringArrayLength(stmt);
  return `${constPrefix(stmt)}${arrayDeclarator(element, stmt.name, length)} = ${
    emitCStringLiteral(stmt.initializer.text)
  };`;
}

function isArrayFillExpression(expr: Expression): b8 {
  return expr.kind === "MethodCallExpr" && expr.receiver.kind === "IdentifierExpr" &&
    expr.receiver.name === "Array" && expr.method === "fill";
}

function arrayDeclShape(stmt: VarDeclStatement, context: EmitContext): {
  declarator: Str;
  expectedType: Str;
} {
  const type = concreteArrayDeclType(stmt, context);
  return {
    declarator: emitCDeclarator(type, stmt.name, context.typeAliases),
    expectedType: emitCTypeName(type, context.typeAliases),
  };
}

function concreteArrayDeclType(stmt: VarDeclStatement, context: EmitContext): FixedArrayTypeRef {
  if (stmt.type?.kind === "FixedArrayTypeRef") return stmt.type;
  if (stmt.type?.kind === "InferredArrayTypeRef") {
    return {
      kind: "FixedArrayTypeRef",
      element: stmt.type.element,
      sizeText: arrayLength(stmt),
      span: stmt.type.span,
    };
  }
  const inferred = inferredArrayType(stmt, context);
  if (inferred !== null) return inferred;
  throw new Error("Array declarations require array types");
}

function inferredArrayType(stmt: VarDeclStatement, context: EmitContext): FixedArrayTypeRef | null {
  const type = context.expressionTypes?.get(spanKey(stmt.initializer.span))?.type ?? "<error>";
  const array = parseArrayTypeName(type);
  if (array === null || array.length === null) return null;
  return {
    kind: "FixedArrayTypeRef",
    element: inferredElementType(array.element, stmt),
    sizeText: array.length.toString(),
    span: stmt.span,
  };
}

function inferredElementType(name: Str, stmt: VarDeclStatement): TypeRef {
  return typeRefFromTypeName(name, stmt.span);
}

function arrayLength(stmt: VarDeclStatement): Str {
  if (stmt.type?.kind === "FixedArrayTypeRef") return stmt.type.sizeText;
  if (stmt.initializer.kind === "ArrayLiteralExpr") return String(stmt.initializer.elements.length);
  if (stmt.initializer.kind === "StringLiteral") {
    return String(cStringByteLength(stmt.initializer.text));
  }
  throw new Error("Array declarations require array-compatible literals");
}

function stringArrayLength(stmt: VarDeclStatement & { initializer: StringLiteralExpression }): Str {
  if (stmt.type?.kind === "FixedArrayTypeRef") return stmt.type.sizeText;
  return String(cStringByteLength(stmt.initializer.text));
}

function arrayDeclarator(element: Str, name: Str, length: Str): Str {
  return `${element} ${name}[${length}]`;
}

function constPrefix(stmt: VarDeclStatement): Str {
  return stmt.mutable ? "" : "const ";
}
