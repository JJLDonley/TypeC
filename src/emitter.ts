import type { Expression, FunctionDecl, Statement } from "./ast.ts";
import type { CheckedProgram } from "./checker.ts";
import { emitCPrelude } from "./c_prelude.ts";
import { emitCType } from "./c_type.ts";

type Str = string;

export function emitC(program: CheckedProgram): Str {
  const out: Str[] = [];
  out.push(...emitCPrelude());
  for (const fn of program.functions) {
    out.push(emitFunction(fn));
    out.push("");
  }
  return out.join("\n");
}

function emitFunction(fn: FunctionDecl): Str {
  const params = emitParams(fn);
  const out: Str[] = [];
  out.push(`${emitCType(fn.returnType)} ${fn.name}(${params}) {`);
  for (const stmt of fn.body.statements) out.push(`  ${emitStatement(stmt)}`);
  out.push("}");
  return out.join("\n");
}

function emitParams(fn: FunctionDecl): Str {
  if (fn.params.length === 0) return "void";
  return fn.params.map((param) => `${emitCType(param.type)} ${param.name}`).join(", ");
}

function emitStatement(stmt: Statement): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return `return ${emitExpression(stmt.expression)};`;
    case "VarDeclStmt":
      return `${stmt.mutable ? "" : "const "}${emitCType(stmt.type)} ${stmt.name} = ${emitExpression(stmt.initializer)};`;
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

