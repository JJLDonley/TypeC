import type { FunctionDecl, Statement, TypeRef } from "core/ast.ts";
import type { CheckedProgram } from "checker";
import {
  optionalCTypeNameFromTypeName,
  optionalUnwrapFunctionNameFromTypeName,
} from "c/optional_names.ts";
import { emitOptionalCType } from "c/optionals.ts";
import { optionalTypeNameElement } from "checker/type_name_shapes.ts";
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
  const definitions = [...elements.values()].map((element) =>
    emitOptionalCType(element, context.typeAliases)
  );
  const emitted = new Set(elements.keys());
  for (const type of context.expressionTypes?.values() ?? []) {
    const element = optionalTypeNameElement(type.type);
    if (element !== null && !emitted.has(element)) {
      emitted.add(element);
      definitions.push(emitOptionalCTypeNameDefinition(element, context));
    }
  }
  return definitions;
}

function emitOptionalCTypeNameDefinition(element: Str, context: EmitContext): Str {
  const name = optionalCTypeNameFromTypeName(element);
  const valueType = optionalElementCTypeName(element, context);
  const unwrapName = optionalUnwrapFunctionNameFromTypeName(element);
  return [
    `typedef struct ${name} { b8 present; ${valueType} value; } ${name};`,
    `static inline ${valueType} ${unwrapName}(${name} value) { if (!value.present) abort(); return value.value; }`,
  ].join("\n");
}

function optionalElementCTypeName(element: Str, context: EmitContext): Str {
  if (element === "bool") return "b8";
  return context.typeAliases.get(element)?.cName ?? element;
}

function collectFunctionOptionals(fn: FunctionDecl, elements: Map<Str, TypeRef>): void {
  for (const param of fn.params) collectTypeOptionals(param.type, elements);
  collectTypeOptionals(fn.returnType, elements);
  if (!fn.body) return;
  for (const stmt of fn.body.statements) collectStatementOptionals(stmt, elements);
}

function collectStatementOptionals(stmt: Statement, elements: Map<Str, TypeRef>): void {
  if (stmt.kind === "VarDeclStmt" && stmt.type !== null) collectTypeOptionals(stmt.type, elements);
  if (stmt.kind === "WhileStmt" || stmt.kind === "DoWhileStmt") {
    collectBlockOptionals(stmt.body.statements, elements);
  }
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
    case "TupleTypeRef":
      for (const element of type.elements) collectTypeOptionals(element, elements);
      return;
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      for (const member of type.members) collectTypeOptionals(member, elements);
      return;
    case "ConditionalTypeRef":
      collectTypeOptionals(type.checkType, elements);
      collectTypeOptionals(type.extendsType, elements);
      collectTypeOptionals(type.trueType, elements);
      collectTypeOptionals(type.falseType, elements);
      return;
    case "RecordTypeRef":
      for (const field of type.fields) collectTypeOptionals(field.type, elements);
      return;
    case "NamedTypeRef":
      return;
  }
}
