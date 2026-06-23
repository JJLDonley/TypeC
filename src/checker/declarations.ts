import type { Diagnostic } from "core/diagnostics.ts";
import type { ConstDecl, FunctionDecl, TypeRef } from "core/ast.ts";
import type { ResolvedProgram } from "core/rast.ts";
import { checkValueType } from "checker/value_types.ts";
import { checkTaggedUnions } from "checker/tagged_unions.ts";
import { checkTypeAliasOrder } from "checker/type_alias_order.ts";
import { checkTypeRef } from "checker/type_validation.ts";

type Str = string;

export interface CheckedDeclarations {
  functions: Map<Str, FunctionDecl>;
  constants: Map<Str, ConstDecl>;
  typeAliases: Map<Str, TypeRef>;
  diagnostics: Diagnostic[];
}

export function checkDeclarations(program: ResolvedProgram): CheckedDeclarations {
  const typeAliases = collectTypeAliases(program);
  const functions = collectFunctions(program);
  const constants = collectConstants(program);
  const diagnostics = [
    ...checkTypeAliases(program, typeAliases),
    ...checkTaggedUnions(program.taggedUnions ?? [], typeAliases),
    ...checkConstants(program, typeAliases),
    ...checkFunctions(program, typeAliases),
  ];
  return { functions, constants, typeAliases, diagnostics };
}

function collectTypeAliases(program: ResolvedProgram): Map<Str, TypeRef> {
  return new Map([
    ...program.typeAliases.map((typeAlias): [Str, TypeRef] => [typeAlias.name, typeAlias.type]),
    ...(program.enums ?? []).map((enumDecl): [Str, TypeRef] => [
      enumDecl.name,
      { kind: "NamedTypeRef", name: "i32", span: enumDecl.span },
    ]),
    ...(program.taggedUnions ?? []).map((unionDecl): [Str, TypeRef] => [
      unionDecl.name,
      { kind: "NamedTypeRef", name: unionDecl.name, span: unionDecl.span },
    ]),
  ]);
}

function collectFunctions(program: ResolvedProgram): Map<Str, FunctionDecl> {
  return new Map(program.functions.map((fn) => [fn.name, fn]));
}

function collectConstants(program: ResolvedProgram): Map<Str, ConstDecl> {
  return new Map((program.constants ?? []).map((constant) => [constant.name, constant]));
}

function checkTypeAliases(program: ResolvedProgram, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const typeAlias of program.typeAliases) {
    if (typeAlias.type.kind !== "RecordTypeRef") {
      diagnostics.push({
        message: `Type alias '${typeAlias.name}' must name a record type`,
        span: typeAlias.span,
      });
    }
    diagnostics.push(...checkTypeRef(typeAlias.type, typeAliases));
  }
  diagnostics.push(...checkTypeAliasOrder(program.typeAliases));
  return diagnostics;
}

function checkConstants(program: ResolvedProgram, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  return (program.constants ?? []).flatMap((constant) =>
    checkConstantDeclaration(constant, typeAliases)
  );
}

function checkConstantDeclaration(
  constant: ConstDecl,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  return [
    ...checkTypeRef(constant.type, typeAliases),
    ...checkValueType(
      constant.type,
      `Constant '${constant.name}' cannot have type 'void'`,
      constant.span,
    ),
  ];
}

function checkFunctions(program: ResolvedProgram, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const fn of program.functions) {
    diagnostics.push(...checkFunctionDeclaration(fn, typeAliases));
  }
  return diagnostics;
}

function checkFunctionDeclaration(fn: FunctionDecl, typeAliases: Map<Str, TypeRef>): Diagnostic[] {
  const diagnostics: Diagnostic[] = checkTypeRef(fn.returnType, typeAliases);
  for (const param of fn.params) {
    diagnostics.push(...checkTypeRef(param.type, typeAliases));
    diagnostics.push(
      ...checkValueType(
        param.type,
        `Parameter '${param.name}' cannot have type 'void'`,
        param.span,
      ),
    );
  }
  return diagnostics;
}
