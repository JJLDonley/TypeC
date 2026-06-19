import type { Expression, FunctionDecl, RecordTypeRef, Statement, TypeAliasDecl } from "./ast.ts";
import type { CheckedProgram } from "./checker.ts";
import { emitCPrelude } from "./c_prelude.ts";
import { emitCDeclarator, emitCType } from "./c_type.ts";

type Str = string;

export function emitC(program: CheckedProgram): Str {
  const out: Str[] = [];
  out.push(...emitCPrelude());
  for (const typeAlias of program.typeAliases) {
    out.push(emitTypeAlias(typeAlias));
    out.push("");
  }
  for (const fn of program.functions) {
    out.push(emitFunction(fn));
    out.push("");
  }
  return out.join("\n");
}

function emitTypeAlias(typeAlias: TypeAliasDecl): Str {
  if (typeAlias.type.kind !== "RecordTypeRef") throw new Error("Only record type aliases can be emitted");
  return emitRecordTypeAlias(typeAlias.name, typeAlias.type);
}

function emitRecordTypeAlias(name: Str, type: RecordTypeRef): Str {
  const out: Str[] = [];
  out.push("typedef struct {");
  for (const field of type.fields) out.push(`  ${emitCType(field.type)} ${field.name};`);
  out.push(`} ${name};`);
  return out.join("\n");
}

function emitFunction(fn: FunctionDecl): Str {
  const params = emitParams(fn);
  const out: Str[] = [];
  out.push(`${emitCType(fn.returnType)} ${fn.name}(${params}) {`);
  for (const stmt of fn.body.statements) out.push(`  ${emitStatement(stmt, emitCType(fn.returnType))}`);
  out.push("}");
  return out.join("\n");
}

function emitParams(fn: FunctionDecl): Str {
  if (fn.params.length === 0) return "void";
  return fn.params.map((param) => emitCDeclarator(param.type, param.name)).join(", ");
}

function emitStatement(stmt: Statement, returnType: Str): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return `return ${emitExpressionExpected(stmt.expression, returnType)};`;
    case "VarDeclStmt":
      return emitVarDecl(stmt);
  }
}

function emitVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>): Str {
  if (stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef") return emitArrayVarDecl(stmt);
  return `${stmt.mutable ? "" : "const "}${emitCType(stmt.type)} ${stmt.name} = ${emitExpressionExpected(stmt.initializer, emitCType(stmt.type))};`;
}

function emitArrayVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>): Str {
  if (stmt.initializer.kind !== "ArrayLiteralExpr") throw new Error("Array declarations require array literals");
  const element = stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef" ? emitCType(stmt.type.element) : "";
  const length = stmt.type.kind === "FixedArrayTypeRef" ? stmt.type.sizeText : String(stmt.initializer.elements.length);
  const declarator = `${element} ${stmt.name}[${length}]`;
  return `${stmt.mutable ? "" : "const "}${declarator} = ${emitExpressionExpected(stmt.initializer, `${element}[${length}]`)};`;
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
    case "FieldAccessExpr":
      return `${emitExpression(expr.operand)}.${expr.field}`;
    case "RecordLiteralExpr":
      throw new Error("Record literals require an expected C type");
    case "ArrayLiteralExpr":
      throw new Error("Array literals require an expected C type");
    case "IndexExpr":
      return `${emitExpression(expr.operand)}[${emitExpression(expr.index)}]`;
  }
}

function emitExpressionExpected(expr: Expression, expectedType: Str): Str {
  if (expr.kind === "RecordLiteralExpr") return emitRecordLiteralExpression(expr, expectedType);
  if (expr.kind === "ArrayLiteralExpr") return emitArrayLiteralExpression(expr);
  return emitExpression(expr);
}

function emitRecordLiteralExpression(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, expectedType: Str): Str {
  const fields = expr.fields.map((field) => `.${field.name} = ${emitExpression(field.expression)}`).join(", ");
  return `(${expectedType}){ ${fields} }`;
}

function emitArrayLiteralExpression(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>): Str {
  return `{ ${expr.elements.map(emitExpression).join(", ")} }`;
}

function emitPostfixPointerExpression(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>): Str {
  const operand = emitExpression(expr.operand);
  if (expr.operator === ".&") return `&${operand}`;
  return `*${operand}`;
}

