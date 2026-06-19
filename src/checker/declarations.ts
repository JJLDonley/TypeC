import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { ResolvedProgram } from "core/rast.ts";
import { checkValueType } from "checker/value_types.ts";
import { checkTypeAliasOrder } from "checker/type_alias_order.ts";
import { checkTypeRef } from "checker/type_validation.ts";

type Str = string;

export interface CheckedDeclarations {
  functions: Map<Str, FunctionDecl>;
  typeAliases: Map<Str, TypeRef>;
  diagnostics: Diagnostic[];
}

export function checkDeclarations(program: ResolvedProgram): CheckedDeclarations {
  const typeAliases = collectTypeAliases(program);
  const functions = collectFunctions(program);
  const diagnostics = [...checkTypeAliases(program, typeAliases), ...checkFunctions(program, typeAliases)];
  return { functions, typeAliases, diagnostics };
}

function collectTypeAliases(program: ResolvedProgram): Map<Str, TypeRef> {
  return new Map(program.typeAliases.map((typeAlias) => [typeAlias.name, typeAlias.type]));
}

function collectFunctions(program: ResolvedProgram): Map<Str, FunctionDecl> {
  return new Map(program.functions.map((fn) => [fn.name, fn]));
}

function checkTypeAliases(program: ResolvedProgram, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const typeAlias of program.typeAliases) {
    if (typeAlias.type.kind !== "RecordTypeRef") diagnostics.push({ message: `Type alias '${typeAlias.name}' must name a record type`, span: typeAlias.span });
    diagnostics.push(...checkTypeRef(typeAlias.type, typeAliases));
  }
  diagnostics.push(...checkTypeAliasOrder(program.typeAliases));
  return diagnostics;
}

function checkFunctions(program: ResolvedProgram, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const fn of program.functions) diagnostics.push(...checkFunctionDeclaration(fn, typeAliases));
  return diagnostics;
}

function checkFunctionDeclaration(fn: FunctionDecl, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  const diagnostics: Diagnostic[] = checkTypeRef(fn.returnType, typeAliases);
  for (const param of fn.params) {
    diagnostics.push(...checkTypeRef(param.type, typeAliases));
    diagnostics.push(...checkValueType(param.type, `Parameter '${param.name}' cannot have type 'void'`, param.span));
  }
  return diagnostics;
}
