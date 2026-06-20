import type { Expression, Statement } from "core/ast.ts";
import { cStringByteLength } from "core/c_strings.ts";
import { emitCType } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpressionExpected } from "emitter/expressions.ts";
import { emitCStringLiteral } from "emitter/strings.ts";

type Str = string;

type VarDeclStatement = Extract<Statement, { kind: "VarDeclStmt" }>;
type StringLiteralExpression = Extract<Expression, { kind: "StringLiteral" }>;

export function emitArrayVarDecl(stmt: VarDeclStatement, context: EmitContext): Str {
  if (stmt.initializer.kind === "StringLiteral") {
    return emitStringArrayVarDecl({ ...stmt, initializer: stmt.initializer }, context);
  }
  if (stmt.initializer.kind !== "ArrayLiteralExpr") {
    throw new Error("Array declarations require array-compatible literals");
  }
  const shape = arrayDeclShape(stmt, context);
  return `${constPrefix(stmt)}${shape.declarator} = ${
    emitExpressionExpected(stmt.initializer, shape.expectedType, context)
  };`;
}

function emitStringArrayVarDecl(
  stmt: VarDeclStatement & { initializer: StringLiteralExpression },
  context: EmitContext,
): Str {
  if (!isArrayVarDecl(stmt)) throw new Error("String array declarations require array types");
  const element = emitCType(stmt.type.element, context.typeAliases);
  const length = stringArrayLength(stmt);
  return `${constPrefix(stmt)}${arrayDeclarator(element, stmt.name, length)} = ${
    emitCStringLiteral(stmt.initializer.text)
  };`;
}

function arrayDeclShape(stmt: VarDeclStatement, context: EmitContext): {
  declarator: Str;
  expectedType: Str;
} {
  if (!isArrayVarDecl(stmt)) throw new Error("Array declarations require array types");
  const element = emitCType(stmt.type.element, context.typeAliases);
  const length = arrayLength(stmt);
  return {
    declarator: arrayDeclarator(element, stmt.name, length),
    expectedType: `${element}[${length}]`,
  };
}

function isArrayVarDecl(stmt: VarDeclStatement): stmt is VarDeclStatement & {
  type: Extract<VarDeclStatement["type"], { kind: "InferredArrayTypeRef" | "FixedArrayTypeRef" }>;
} {
  return stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef";
}

function arrayLength(stmt: VarDeclStatement): Str {
  if (stmt.type.kind === "FixedArrayTypeRef") return stmt.type.sizeText;
  if (stmt.initializer.kind === "ArrayLiteralExpr") return String(stmt.initializer.elements.length);
  throw new Error("Array declarations require array-compatible literals");
}

function stringArrayLength(stmt: VarDeclStatement & { initializer: StringLiteralExpression }): Str {
  if (stmt.type.kind === "FixedArrayTypeRef") return stmt.type.sizeText;
  return String(cStringByteLength(stmt.initializer.text));
}

function arrayDeclarator(element: Str, name: Str, length: Str): Str {
  return `${element} ${name}[${length}]`;
}

function constPrefix(stmt: VarDeclStatement): Str {
  return stmt.mutable ? "" : "const ";
}
