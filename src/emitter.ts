import type { Expression, FunctionDecl, RecordTypeRef, Statement, TypeAliasDecl } from "./ast.ts";
import type { CheckedProgram } from "./checker.ts";
import { emitCPrelude } from "./c_prelude.ts";
import { emitCDeclarator, emitCType } from "./c_type.ts";

type Str = string;
type usize = number;

export function emitC(program: CheckedProgram): Str {
  const out: Str[] = [];
  const typeAliases = typeAliasMap(program.typeAliases);
  out.push(...emitCPrelude());
  for (const typeAlias of program.typeAliases) {
    out.push(emitTypeAlias(typeAlias));
    out.push("");
  }
  for (const fn of program.functions.filter((fn) => fn.external)) out.push(emitFunctionPrototype(fn));
  for (const fn of program.functions.filter((fn) => !fn.external)) out.push(emitFunctionPrototype(fn));
  out.push("");
  for (const fn of program.functions.filter((fn) => fn.body)) {
    out.push(emitFunctionDefinition(fn, typeAliases));
    out.push("");
  }
  return out.join("\n");
}

function typeAliasMap(typeAliases: TypeAliasDecl[]): Map<Str, TypeAliasDecl> {
  return new Map(typeAliases.map((typeAlias) => [typeAlias.name, typeAlias]));
}

function emitTypeAlias(typeAlias: TypeAliasDecl): Str {
  if (typeAlias.type.kind !== "RecordTypeRef") throw new Error("Only record type aliases can be emitted");
  return emitRecordTypeAlias(typeAlias.name, typeAlias.type);
}

function emitRecordTypeAlias(name: Str, type: RecordTypeRef): Str {
  const out: Str[] = [];
  out.push("typedef struct {");
  for (const field of type.fields) out.push(`  ${emitCDeclarator(field.type, field.name)};`);
  out.push(`} ${name};`);
  return out.join("\n");
}

function emitFunctionPrototype(fn: FunctionDecl): Str {
  return `${emitFunctionSignature(fn)};`;
}

function emitFunctionDefinition(fn: FunctionDecl, typeAliases: Map<Str, TypeAliasDecl>): Str {
  if (!fn.body) throw new Error("Function definition requires a body");
  const out: Str[] = [];
  out.push(`${emitFunctionSignature(fn)} {`);
  for (const stmt of fn.body.statements) out.push(`  ${emitStatement(stmt, emitCType(fn.returnType), typeAliases)}`);
  out.push("}");
  return out.join("\n");
}

function emitFunctionSignature(fn: FunctionDecl): Str {
  return `${emitFunctionStorage(fn)}${emitCType(fn.returnType)} ${fn.name}(${emitParams(fn)})`;
}

function emitFunctionStorage(fn: FunctionDecl): Str {
  if (fn.exported || fn.name === "main") return "";
  return "static ";
}

function emitParams(fn: FunctionDecl): Str {
  if (fn.params.length === 0) return "void";
  return fn.params.map((param) => emitCDeclarator(param.type, param.name)).join(", ");
}

function emitStatement(stmt: Statement, returnType: Str, typeAliases: Map<Str, TypeAliasDecl>): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return stmt.expression ? `return ${emitExpressionExpected(stmt.expression, returnType, typeAliases)};` : "return;";
    case "VarDeclStmt":
      return emitVarDecl(stmt, typeAliases);
    case "AssignmentStmt":
      return `${stmt.name} = ${emitExpression(stmt.expression, typeAliases)};`;
    case "WhileStmt":
      return emitWhile(stmt, returnType, typeAliases);
    case "IfStmt":
      return emitIf(stmt, returnType, typeAliases);
  }
}

function emitIf(stmt: Extract<Statement, { kind: "IfStmt" }>, returnType: Str, typeAliases: Map<Str, TypeAliasDecl>): Str {
  const out: Str[] = [];
  out.push(`if (${emitExpression(stmt.condition, typeAliases)}) {`);
  for (const child of stmt.thenBody.statements) out.push(`  ${emitStatement(child, returnType, typeAliases)}`);
  if (!stmt.elseBody) {
    out.push("}");
    return out.join("\n  ");
  }
  out.push("} else {");
  for (const child of stmt.elseBody.statements) out.push(`  ${emitStatement(child, returnType, typeAliases)}`);
  out.push("}");
  return out.join("\n  ");
}

function emitWhile(stmt: Extract<Statement, { kind: "WhileStmt" }>, returnType: Str, typeAliases: Map<Str, TypeAliasDecl>): Str {
  const out: Str[] = [];
  out.push(`while (${emitExpression(stmt.condition, typeAliases)}) {`);
  for (const child of stmt.body.statements) out.push(`  ${emitStatement(child, returnType, typeAliases)}`);
  out.push("}");
  return out.join("\n  ");
}

function emitVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, typeAliases: Map<Str, TypeAliasDecl>): Str {
  if (stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef") return emitArrayVarDecl(stmt, typeAliases);
  return `${stmt.mutable ? "" : "const "}${emitCType(stmt.type)} ${stmt.name} = ${emitExpressionExpected(stmt.initializer, emitCType(stmt.type), typeAliases)};`;
}

function emitArrayVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, typeAliases: Map<Str, TypeAliasDecl>): Str {
  if (stmt.initializer.kind !== "ArrayLiteralExpr") throw new Error("Array declarations require array literals");
  const element = stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef" ? emitCType(stmt.type.element) : "";
  const length = stmt.type.kind === "FixedArrayTypeRef" ? stmt.type.sizeText : String(stmt.initializer.elements.length);
  const declarator = `${element} ${stmt.name}[${length}]`;
  return `${stmt.mutable ? "" : "const "}${declarator} = ${emitExpressionExpected(stmt.initializer, `${element}[${length}]`, typeAliases)};`;
}

function emitExpression(expr: Expression, typeAliases: Map<Str, TypeAliasDecl>): Str {
  switch (expr.kind) {
    case "IntegerLiteral":
      return expr.text;
    case "FloatLiteral":
      return expr.text;
    case "BoolLiteral":
      return expr.text;
    case "IdentifierExpr":
      return expr.name;
    case "BinaryExpr":
      return `${emitExpression(expr.left, typeAliases)} ${expr.operator} ${emitExpression(expr.right, typeAliases)}`;
    case "CallExpr":
      return `${expr.callee}(${expr.args.map((arg) => emitExpression(arg, typeAliases)).join(", ")})`;
    case "PostfixPointerExpr":
      return emitPostfixPointerExpression(expr, typeAliases);
    case "FieldAccessExpr":
      return `${emitExpression(expr.operand, typeAliases)}.${expr.field}`;
    case "RecordLiteralExpr":
      throw new Error("Record literals require an expected C type");
    case "ArrayLiteralExpr":
      throw new Error("Array literals require an expected C type");
    case "IndexExpr":
      return `${emitExpression(expr.operand, typeAliases)}[${emitExpression(expr.index, typeAliases)}]`;
  }
}

function emitExpressionExpected(expr: Expression, expectedType: Str, typeAliases: Map<Str, TypeAliasDecl>): Str {
  if (expr.kind === "RecordLiteralExpr") return emitRecordLiteralExpression(expr, expectedType, typeAliases);
  if (expr.kind === "ArrayLiteralExpr") return emitArrayLiteralExpression(expr, typeAliases);
  return emitExpression(expr, typeAliases);
}

function emitRecordLiteralExpression(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, expectedType: Str, typeAliases: Map<Str, TypeAliasDecl>): Str {
  const record = typeAliases.get(expectedType)?.type;
  const fields = expr.fields.map((field) => emitRecordLiteralField(field, record?.kind === "RecordTypeRef" ? record : null, typeAliases)).join(", ");
  return `(${expectedType}){ ${fields} }`;
}

function emitRecordLiteralField(field: Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize], record: RecordTypeRef | null, typeAliases: Map<Str, TypeAliasDecl>): Str {
  const expected = record?.fields.find((candidate) => candidate.name === field.name);
  const value = expected ? emitExpressionExpected(field.expression, emitCTypeName(expected.type), typeAliases) : emitExpression(field.expression, typeAliases);
  return `.${field.name} = ${value}`;
}

function emitCTypeName(type: TypeAliasDecl["type"]): Str {
  if (type.kind === "FixedArrayTypeRef") return `${emitCType(type.element)}[${type.sizeText}]`;
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element)}[]`;
  return emitCType(type);
}

function emitArrayLiteralExpression(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, typeAliases: Map<Str, TypeAliasDecl>): Str {
  return `{ ${expr.elements.map((element) => emitExpression(element, typeAliases)).join(", ")} }`;
}

function emitPostfixPointerExpression(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>, typeAliases: Map<Str, TypeAliasDecl>): Str {
  const operand = emitExpression(expr.operand, typeAliases);
  if (expr.operator === ".&") return `&${operand}`;
  return `*${operand}`;
}

