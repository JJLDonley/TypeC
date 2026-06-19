import type { Expression, FunctionDecl, Statement, TypeRef } from "./ast.ts";
import type { CheckedProgram } from "./checker.ts";

type Str = string;

export function emitC(program: CheckedProgram): Str {
  const out: Str[] = [];
  out.push(...emitPrelude());
  for (const fn of program.functions) {
    out.push(emitFunction(fn));
    out.push("");
  }
  return out.join("\n");
}

function emitPrelude(): Str[] {
  return [
    "#include <stdint.h>",
    "#include <stdbool.h>",
    "#include <stddef.h>",
    "",
    "typedef uint8_t u8;",
    "typedef uint16_t u16;",
    "typedef uint32_t u32;",
    "typedef uint64_t u64;",
    "typedef int8_t i8;",
    "typedef int16_t i16;",
    "typedef int32_t i32;",
    "typedef int64_t i64;",
    "typedef float f32;",
    "typedef double f64;",
    "typedef bool b8;",
    "typedef size_t usize;",
    "",
  ];
}

function emitFunction(fn: FunctionDecl): Str {
  const params = emitParams(fn);
  const out: Str[] = [];
  out.push(`${emitType(fn.returnType)} ${fn.name}(${params}) {`);
  for (const stmt of fn.body.statements) out.push(`  ${emitStatement(stmt)}`);
  out.push("}");
  return out.join("\n");
}

function emitParams(fn: FunctionDecl): Str {
  if (fn.params.length === 0) return "void";
  return fn.params.map((param) => `${emitType(param.type)} ${param.name}`).join(", ");
}

function emitStatement(stmt: Statement): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return `return ${emitExpression(stmt.expression)};`;
    case "VarDeclStmt":
      return `${stmt.mutable ? "" : "const "}${emitType(stmt.type)} ${stmt.name} = ${emitExpression(stmt.initializer)};`;
  }
}

function emitExpression(expr: Expression): Str {
  switch (expr.kind) {
    case "IntegerLiteral":
      return expr.text;
    case "FloatLiteral":
      return expr.text;
    case "IdentifierExpr":
      return expr.name;
    case "BinaryExpr":
      return `${emitExpression(expr.left)} ${expr.operator} ${emitExpression(expr.right)}`;
    case "CallExpr":
      return `${expr.callee}(${expr.args.map(emitExpression).join(", ")})`;
    case "PostfixPointerExpr":
      return emitPostfixPointerExpression(expr);
  }
}

function emitPostfixPointerExpression(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>): Str {
  const operand = emitExpression(expr.operand);
  if (expr.operator === ".&") return `&${operand}`;
  return `*${operand}`;
}

function emitType(type: TypeRef): Str {
  switch (type.kind) {
    case "NamedTypeRef":
      return emitNamedType(type.name);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
      return `${emitType(type.element)}*`;
    case "InferredArrayTypeRef":
      throw new Error("Cannot emit inferred array type before array checking");
    case "FixedArrayTypeRef":
      throw new Error("Cannot emit fixed array type before array checking");
  }
}

function emitNamedType(name: Str): Str {
  return name === "bool" ? "b8" : name;
}
