import type { FunctionDecl, Statement, TypeRef } from "core/ast.ts";
import type { CheckedProgram } from "checker";
import { emitSliceCType } from "c/slices.ts";
import { typeName } from "core/type_ref.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function collectSliceTypeDefinitions(program: CheckedProgram, context: EmitContext): Str[] {
  const elements = new Map<Str, TypeRef>();
  for (const fn of program.functions) collectFunctionSlices(fn, elements);
  return [...elements.values()].map((element) => emitSliceCType(element, context.typeAliases));
}

function collectFunctionSlices(fn: FunctionDecl, elements: Map<Str, TypeRef>): void {
  for (const param of fn.params) collectTypeSlices(param.type, elements);
  collectTypeSlices(fn.returnType, elements);
  if (fn.body) { for (const stmt of fn.body.statements) collectStatementSlices(stmt, elements); }
}

function collectStatementSlices(stmt: Statement, elements: Map<Str, TypeRef>): void {
  if (stmt.kind === "VarDeclStmt") collectTypeSlices(stmt.type, elements);
  if (stmt.kind === "WhileStmt") {
    for (const child of stmt.body.statements) collectStatementSlices(child, elements);
  }
  if (stmt.kind !== "IfStmt") return;
  for (const child of stmt.thenBody.statements) collectStatementSlices(child, elements);
  if (stmt.elseBody) {
    for (const child of stmt.elseBody.statements) collectStatementSlices(child, elements);
  }
}

function collectTypeSlices(type: TypeRef, elements: Map<Str, TypeRef>): void {
  switch (type.kind) {
    case "SliceTypeRef":
      elements.set(typeName(type.element), type.element);
      collectTypeSlices(type.element, elements);
      return;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      collectTypeSlices(type.element, elements);
      return;
    case "FunctionTypeRef":
      for (const param of type.params) collectTypeSlices(param.type, elements);
      collectTypeSlices(type.returnType, elements);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeSlices(field.type, elements);
      return;
    case "NamedTypeRef":
      return;
  }
}
