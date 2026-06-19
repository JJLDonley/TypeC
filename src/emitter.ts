import type { CheckedProgram } from "./checker.ts";
import type { Expression, FunctionDecl, Statement, TypeRef } from "./ast.ts";

export function emitC(program: CheckedProgram): string {
  const out: string[] = [];
  out.push("#include <stdint.h>");
  out.push("#include <stdbool.h>");
  out.push("#include <stddef.h>");
  out.push("");
  out.push("typedef uint8_t u8;");
  out.push("typedef uint16_t u16;");
  out.push("typedef uint32_t u32;");
  out.push("typedef uint64_t u64;");
  out.push("typedef int8_t i8;");
  out.push("typedef int16_t i16;");
  out.push("typedef int32_t i32;");
  out.push("typedef int64_t i64;");
  out.push("typedef float f32;");
  out.push("typedef double f64;");
  out.push("typedef bool b8;");
  out.push("typedef size_t usize;");
  out.push("");
  for (const fn of program.functions) {
    out.push(emitFunction(fn));
    out.push("");
  }
  return out.join("\n");
}

function emitFunction(fn: FunctionDecl): string {
  const params = fn.params.length === 0
    ? "void"
    : fn.params.map((p) => `${emitType(p.type)} ${p.name}`).join(", ");
  const out: string[] = [];
  out.push(`${emitType(fn.returnType)} ${fn.name}(${params}) {`);
  for (const stmt of fn.body.statements) out.push(`  ${emitStatement(stmt)}`);
  out.push("}");
  return out.join("\n");
}

function emitStatement(stmt: Statement): string {
  switch (stmt.kind) {
    case "ReturnStmt":
      return `return ${emitExpression(stmt.expression)};`;
    case "VarDeclStmt":
      return `${stmt.mutable ? "" : "const "}${emitType(stmt.type)} ${stmt.name} = ${emitExpression(stmt.initializer)};`;
  }
}

function emitExpression(expr: Expression): string {
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
      throw new Error(`Cannot emit pointer operator '${expr.operator}' before pointer checking`);
  }
}

function emitType(type: TypeRef): string {
  switch (type.kind) {
    case "NamedTypeRef":
      return emitNamedType(type.name);
    case "PointerTypeRef":
      return `${emitType(type.element)}*`;
    case "ReferenceTypeRef":
      return `${emitType(type.element)}*`;
    case "InferredArrayTypeRef":
      throw new Error("Cannot emit inferred array type before array checking");
    case "FixedArrayTypeRef":
      throw new Error("Cannot emit fixed array type before array checking");
  }
}

function emitNamedType(name: string): string {
  return name === "bool" ? "b8" : name;
}
