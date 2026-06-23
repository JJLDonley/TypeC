import type { FunctionDecl, Statement, TypeRef } from "core/ast.ts";
import type { CheckedProgram } from "checker";
import { emitOptionalCType } from "c/optionals.ts";
import { optionalTypeElement } from "core/optional_types.ts";
import { typeName } from "core/type_ref.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function collectOptionalTypeDefinitions(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  const elements = new Map<Str, TypeRef>();
  for (const fn of program.functions) collectFunctionOptionals(fn, elements);
  return [...elements.values()].map((element) => emitOptionalCType(element, context.typeAliases));
}

function collectFunctionOptionals(fn: FunctionDecl, elements: Map<Str, TypeRef>): void {
  for (const param of fn.params) collectTypeOptionals(param.type, elements);
  collectTypeOptionals(fn.returnType, elements);
  if (!fn.body) return;
  for (const stmt of fn.body.statements) collectStatementOptionals(stmt, elements);
}

function collectStatementOptionals(stmt: Statement, elements: Map<Str, TypeRef>): void {
  if (stmt.kind === "VarDeclStmt") collectTypeOptionals(stmt.type, elements);
  if (stmt.kind === "WhileStmt") collectBlockOptionals(stmt.body.statements, elements);
  if (stmt.kind !== "IfStmt") return;
  collectBlockOptionals(stmt.thenBody.statements, elements);
  if (stmt.elseBody) collectBlockOptionals(stmt.elseBody.statements, elements);
}

function collectBlockOptionals(statements: Statement[], elements: Map<Str, TypeRef>): void {
  for (const statement of statements) collectStatementOptionals(statement, elements);
}

function collectTypeOptionals(type: TypeRef, elements: Map<Str, TypeRef>): void {
  const optionalElement = optionalTypeElement(type);
  if (optionalElement !== null) {
    elements.set(typeName(optionalElement), optionalElement);
    collectTypeOptionals(optionalElement, elements);
    return;
  }
  switch (type.kind) {
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeOptionals(type.element, elements);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) collectTypeOptionals(param.type, elements);
      collectTypeOptionals(type.returnType, elements);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeOptionals(field.type, elements);
      return;
    case "NamedTypeRef":
      return;
  }
}
