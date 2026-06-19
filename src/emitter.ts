import type { Expression, FunctionDecl, RecordTypeRef, Statement, TypeAliasDecl } from "./ast.ts";
import type { CheckedProgram } from "./checker.ts";
import { emitCPrelude } from "./c_prelude.ts";
import { emitCDeclarator, emitCType } from "./c_type.ts";
import { createEmitContext, type EmitContext } from "./emitter_context.ts";
import { emitFunctionPrototype, emitFunctionSignature } from "./emitter_functions.ts";
import { cArrayElementType, cPrecedence, emitIntegerLiteralExpression } from "./emitter_helpers.ts";

type Str = string;
type usize = number;

export function emitC(program: CheckedProgram): Str {
  const out: Str[] = [];
  const context = createEmitContext(program);
  out.push(...emitCPrelude());
  for (const typeAlias of program.typeAliases) {
    out.push(emitTypeAlias(typeAlias));
    out.push("");
  }
  for (const fn of program.functions.filter((fn) => fn.external)) out.push(emitFunctionPrototype(fn));
  for (const fn of program.functions.filter((fn) => !fn.external)) out.push(emitFunctionPrototype(fn));
  out.push("");
  for (const fn of program.functions.filter((fn) => fn.body)) {
    out.push(emitFunctionDefinition(fn, context));
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
  for (const field of type.fields) out.push(`  ${emitCDeclarator(field.type, field.name)};`);
  out.push(`} ${name};`);
  return out.join("\n");
}

function emitFunctionDefinition(fn: FunctionDecl, context: EmitContext): Str {
  if (!fn.body) throw new Error("Function definition requires a body");
  const out: Str[] = [];
  out.push(`${emitFunctionSignature(fn)} {`);
  for (const stmt of fn.body.statements) out.push(`  ${emitStatement(stmt, emitCType(fn.returnType), context)}`);
  out.push("}");
  return out.join("\n");
}

function emitStatement(stmt: Statement, returnType: Str, context: EmitContext): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return stmt.expression ? `return ${emitExpressionExpected(stmt.expression, returnType, context)};` : "return;";
    case "VarDeclStmt":
      return emitVarDecl(stmt, context);
    case "AssignmentStmt":
      return `${stmt.name} = ${emitExpression(stmt.expression, context)};`;
    case "WhileStmt":
      return emitWhile(stmt, returnType, context);
    case "IfStmt":
      return emitIf(stmt, returnType, context);
  }
}

function emitIf(stmt: Extract<Statement, { kind: "IfStmt" }>, returnType: Str, context: EmitContext): Str {
  const out: Str[] = [];
  out.push(`if (${emitExpression(stmt.condition, context)}) {`);
  for (const child of stmt.thenBody.statements) out.push(`  ${emitStatement(child, returnType, context)}`);
  if (!stmt.elseBody) {
    out.push("}");
    return out.join("\n  ");
  }
  out.push("} else {");
  for (const child of stmt.elseBody.statements) out.push(`  ${emitStatement(child, returnType, context)}`);
  out.push("}");
  return out.join("\n  ");
}

function emitWhile(stmt: Extract<Statement, { kind: "WhileStmt" }>, returnType: Str, context: EmitContext): Str {
  const out: Str[] = [];
  out.push(`while (${emitExpression(stmt.condition, context)}) {`);
  for (const child of stmt.body.statements) out.push(`  ${emitStatement(child, returnType, context)}`);
  out.push("}");
  return out.join("\n  ");
}

function emitVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, context: EmitContext): Str {
  if (stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef") return emitArrayVarDecl(stmt, context);
  return `${stmt.mutable ? "" : "const "}${emitCType(stmt.type)} ${stmt.name} = ${emitExpressionExpected(stmt.initializer, emitCType(stmt.type), context)};`;
}

function emitArrayVarDecl(stmt: Extract<Statement, { kind: "VarDeclStmt" }>, context: EmitContext): Str {
  if (stmt.initializer.kind !== "ArrayLiteralExpr") throw new Error("Array declarations require array literals");
  const element = stmt.type.kind === "InferredArrayTypeRef" || stmt.type.kind === "FixedArrayTypeRef" ? emitCType(stmt.type.element) : "";
  const length = stmt.type.kind === "FixedArrayTypeRef" ? stmt.type.sizeText : String(stmt.initializer.elements.length);
  const declarator = `${element} ${stmt.name}[${length}]`;
  return `${stmt.mutable ? "" : "const "}${declarator} = ${emitExpressionExpected(stmt.initializer, `${element}[${length}]`, context)};`;
}

function emitExpression(expr: Expression, context: EmitContext): Str {
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
      return emitBinaryExpression(expr, context);
    case "CallExpr":
      return emitCallExpression(expr, context);
    case "PostfixPointerExpr":
      return emitPostfixPointerExpression(expr, context);
    case "FieldAccessExpr":
      return `${emitMemberOperand(expr.operand, context)}.${expr.field}`;
    case "RecordLiteralExpr":
      throw new Error("Record literals require an expected C type");
    case "ArrayLiteralExpr":
      throw new Error("Array literals require an expected C type");
    case "IndexExpr":
      return `${emitMemberOperand(expr.operand, context)}[${emitExpression(expr.index, context)}]`;
  }
}

function emitExpressionExpected(expr: Expression, expectedType: Str, context: EmitContext): Str {
  if (expr.kind === "IntegerLiteral") return emitIntegerLiteralExpression(expr, expectedType);
  if (expr.kind === "RecordLiteralExpr") return emitRecordLiteralExpression(expr, expectedType, context);
  if (expr.kind === "ArrayLiteralExpr") return emitArrayLiteralExpression(expr, context, expectedType);
  return emitExpression(expr, context);
}

function emitRecordLiteralExpression(expr: Extract<Expression, { kind: "RecordLiteralExpr" }>, expectedType: Str, context: EmitContext): Str {
  const record = context.typeAliases.get(expectedType)?.type;
  const fields = expr.fields.map((field) => emitRecordLiteralField(field, record?.kind === "RecordTypeRef" ? record : null, context)).join(", ");
  return `(${expectedType}){ ${fields} }`;
}

function emitRecordLiteralField(field: Extract<Expression, { kind: "RecordLiteralExpr" }>["fields"][usize], record: RecordTypeRef | null, context: EmitContext): Str {
  const expected = record?.fields.find((candidate) => candidate.name === field.name);
  const value = expected ? emitExpressionExpected(field.expression, emitCTypeName(expected.type), context) : emitExpression(field.expression, context);
  return `.${field.name} = ${value}`;
}

function emitCTypeName(type: TypeAliasDecl["type"]): Str {
  if (type.kind === "FixedArrayTypeRef") return `${emitCType(type.element)}[${type.sizeText}]`;
  if (type.kind === "InferredArrayTypeRef") return `${emitCType(type.element)}[]`;
  return emitCType(type);
}

function emitArrayLiteralExpression(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, context: EmitContext, expectedType: Str | null = null): Str {
  const elementType = expectedType ? cArrayElementType(expectedType) : null;
  const elements = expr.elements.map((element) => elementType ? emitExpressionExpected(element, elementType, context) : emitExpression(element, context));
  return `{ ${elements.join(", ")} }`;
}

function emitCallExpression(expr: Extract<Expression, { kind: "CallExpr" }>, context: EmitContext): Str {
  const fn = context.functions.get(expr.callee);
  const args = expr.args.map((arg, index) => emitCallArg(arg, fn?.params[index], context));
  return `${expr.callee}(${args.join(", ")})`;
}

function emitCallArg(arg: Expression, param: FunctionDecl["params"][usize] | undefined, context: EmitContext): Str {
  if (!param) return emitExpression(arg, context);
  const expectedType = emitCTypeName(param.type);
  if (arg.kind === "ArrayLiteralExpr") return emitArrayCompoundLiteral(arg, expectedType, context);
  return emitExpressionExpected(arg, expectedType, context);
}

function emitArrayCompoundLiteral(expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>, expectedType: Str, context: EmitContext): Str {
  return `(${expectedType})${emitArrayLiteralExpression(expr, context, expectedType)}`;
}

function emitBinaryExpression(expr: Extract<Expression, { kind: "BinaryExpr" }>, context: EmitContext): Str {
  const left = emitBinaryOperand(expr.left, expr.operator, "left", context);
  const right = emitBinaryOperand(expr.right, expr.operator, "right", context);
  return `${left} ${expr.operator} ${right}`;
}

function emitBinaryOperand(expr: Expression, parentOperator: Str, side: "left" | "right", context: EmitContext): Str {
  const operand = emitExpression(expr, context);
  if (expr.kind !== "BinaryExpr") return operand;
  const parent = cPrecedence(parentOperator);
  const child = cPrecedence(expr.operator);
  if (child < parent) return `(${operand})`;
  if (side === "right" && child === parent) return `(${operand})`;
  return operand;
}

function emitPostfixPointerExpression(expr: Extract<Expression, { kind: "PostfixPointerExpr" }>, context: EmitContext): Str {
  const operand = emitExpression(expr.operand, context);
  if (expr.operator === ".&") return `&${operand}`;
  return `*${operand}`;
}

function emitMemberOperand(expr: Expression, context: EmitContext): Str {
  const operand = emitExpression(expr, context);
  if (expr.kind === "PostfixPointerExpr" && expr.operator === ".*") return `(${operand})`;
  return operand;
}

