import type { CheckedProgram } from "checker";
import type { FunctionDecl, InterfaceDecl, Param, Statement, TypeRef } from "core/ast.ts";
import { classMethodName } from "core/classes.ts";
import { typeName } from "core/type_ref.ts";
import { emitCParamDeclarator, emitCType } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export function emitBorrowedInterfaceTypeDefinitions(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  const used = usedBorrowedInterfaceNames(program);
  return (program.interfaces ?? [])
    .filter((interfaceDecl) => used.has(interfaceDecl.name))
    .map((interfaceDecl) => emitBorrowedInterfaceTypeDefinition(interfaceDecl, context));
}

export function emitBorrowedInterfaceShims(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  const used = usedBorrowedInterfaceNames(program);
  const out: Str[] = [];
  for (const className of classNames(program.functions)) {
    if (used.size === 0) break;
    for (const interfaceDecl of program.interfaces ?? []) {
      if (!used.has(interfaceDecl.name)) continue;
      out.push(...emitClassInterfaceShims(className, interfaceDecl, context));
    }
  }
  return out;
}

function usedBorrowedInterfaceNames(program: CheckedProgram): Set<Str> {
  const names = new Set<Str>();
  for (const fn of program.functions) {
    for (const param of fn.params) collectBorrowedInterfaceName(param.type, names);
    collectBorrowedInterfaceName(fn.returnType, names);
    for (const stmt of fn.body?.statements ?? []) {
      collectStatementBorrowedInterfaceNames(stmt, names);
    }
  }
  return names;
}

function collectStatementBorrowedInterfaceNames(stmt: Statement, names: Set<Str>): void {
  if (stmt.kind === "VarDeclStmt" && stmt.type !== null) {
    collectBorrowedInterfaceName(stmt.type, names);
  }
  for (const child of childStatements(stmt)) collectStatementBorrowedInterfaceNames(child, names);
}

function childStatements(stmt: Statement): Statement[] {
  switch (stmt.kind) {
    case "SwitchStmt":
      return [
        ...stmt.cases.flatMap((switchCase) => switchCase.statements),
        ...(stmt.defaultCase?.statements ?? []),
      ];
    case "WhileStmt":
    case "DoWhileStmt":
    case "ForStmt":
    case "ForOfStmt":
    case "ForInStmt":
      return stmt.body.statements;
    case "IfStmt":
      return [...stmt.thenBody.statements, ...(stmt.elseBody?.statements ?? [])];
    default:
      return [];
  }
}

function collectBorrowedInterfaceName(type: TypeRef, names: Set<Str>): void {
  if (type.kind === "ReferenceTypeRef" && type.element.kind === "NamedTypeRef") {
    names.add(type.element.name);
  }
}

function classNames(functions: FunctionDecl[]): Str[] {
  const names = new Set<Str>();
  for (const fn of functions) {
    const dot = fn.name.indexOf(".");
    if (dot > 0) names.add(fn.name.slice(0, dot));
  }
  return [...names];
}

function emitBorrowedInterfaceTypeDefinition(
  interfaceDecl: InterfaceDecl,
  context: EmitContext,
): Str {
  const out: Str[] = [`typedef struct ${interfaceDecl.name} {`, "  void* self;"];
  for (const method of interfaceDecl.methods) {
    out.push(`  ${emitBorrowedInterfaceMethodPointer(method, context)};`);
  }
  out.push(`} ${interfaceDecl.name};`);
  return out.join("\n");
}

function emitBorrowedInterfaceMethodPointer(
  method: InterfaceDecl["methods"][usize],
  context: EmitContext,
): Str {
  const params = [
    "void*",
    ...method.params.map((param) => emitCType(param.type, context.typeAliases)),
  ]
    .join(", ");
  return `${emitCType(method.returnType, context.typeAliases)} (*${method.name})(${params})`;
}

function emitClassInterfaceShims(
  className: Str,
  interfaceDecl: InterfaceDecl,
  context: EmitContext,
): Str[] {
  const out: Str[] = [];
  for (const method of interfaceDecl.methods) {
    const fn = context.functions.get(classMethodName(className, method.name)) ?? null;
    if (fn === null || !methodSignatureMatches(fn, method)) continue;
    out.push(emitBorrowedInterfaceShim(className, interfaceDecl.name, fn, method, context));
  }
  return out;
}

function emitBorrowedInterfaceShim(
  className: Str,
  interfaceName: Str,
  fn: FunctionDecl,
  method: InterfaceDecl["methods"][usize],
  context: EmitContext,
): Str {
  const shimName = borrowedInterfaceShimName(className, interfaceName, method.name);
  const params = borrowedInterfaceShimParams(method.params, context);
  const args = [castSelf(className), ...method.params.map((param) => param.name)].join(", ");
  const call = `${fn.cName ?? fn.name}(${args})`;
  const prefix = `${emitCType(method.returnType, context.typeAliases)} ${shimName}(${params})`;
  if (typeName(method.returnType) === "void") return `static ${prefix} {\n  ${call};\n}`;
  return `static ${prefix} {\n  return ${call};\n}`;
}

function borrowedInterfaceShimParams(params: Param[], context: EmitContext): Str {
  return [
    "void* self",
    ...params.map((param) => emitCParamDeclarator(param.type, param.name, context.typeAliases)),
  ]
    .join(", ");
}

function castSelf(className: Str): Str {
  return `(${className}*)self`;
}

export function borrowedInterfaceShimName(
  className: Str,
  interfaceName: Str,
  methodName: Str,
): Str {
  return `${className}_as_${interfaceName}_${methodName}`;
}

export function borrowedInterfaceLiteral(
  expectedType: Str,
  sourceType: Str,
  sourceExpression: Str,
  interfaceDecl: InterfaceDecl,
): Str {
  const sourceName = borrowedSourceName(sourceType) ?? sourceType;
  const fields = [`.self = ${sourceExpression}`];
  for (const method of interfaceDecl.methods) {
    fields.push(
      `.${method.name} = ${borrowedInterfaceShimName(sourceName, expectedType, method.name)}`,
    );
  }
  return `(${expectedType}){ ${fields.join(", ")} }`;
}

export function borrowedSourceName(typeNameText: Str): Str | null {
  return typeNameText.endsWith("&") ? typeNameText.slice(0, typeNameText.length - 1) : null;
}

function methodSignatureMatches(
  fn: FunctionDecl,
  method: InterfaceDecl["methods"][usize],
): b8 {
  const params = fn.params.slice(1);
  if (params.length !== method.params.length) return false;
  if (typeName(fn.returnType) !== typeName(method.returnType)) return false;
  return params.every((param, index) =>
    typeName(param.type) === typeName(method.params[index]!.type)
  );
}
