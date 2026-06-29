import type { Diagnostic } from "core/diagnostics.ts";
import type { ConstDecl, EnumDecl, FunctionDecl, TypeRef } from "core/ast.ts";
import { enumBackingType } from "core/enums.ts";
import type { ResolvedProgram } from "core/rast.ts";
import { checkValueType } from "checker/value_types.ts";
import { isInferredFunctionReturn } from "checker/function_return_inference.ts";
import { checkTaggedUnions } from "checker/tagged_unions.ts";
import { checkTypeAliasLiteralValueTypes } from "checker/literal_value_types.ts";
import { checkTypeAliasCycles } from "checker/type_alias_cycles.ts";
import { checkTypeAliasOrder } from "checker/type_alias_order.ts";
import { runtimeFunctions } from "checker/overloads.ts";
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
  const interfaceNames = collectInterfaceNames(program);
  const diagnostics = [
    ...checkTypeAliases(program, typeAliases, interfaceNames),
    ...checkTaggedUnions(program.taggedUnions ?? [], typeAliases, interfaceNames),
    ...checkEnumBackings(program.enums ?? [], typeAliases, interfaceNames),
    ...checkConstants(program, typeAliases, interfaceNames),
    ...checkFunctions(program, typeAliases, interfaceNames),
  ];
  return { functions, constants, typeAliases, diagnostics };
}

function collectTypeAliases(program: ResolvedProgram): Map<Str, TypeRef> {
  return new Map([
    ...program.typeAliases.map((typeAlias): [Str, TypeRef] => [typeAlias.name, typeAlias.type]),
    ...(program.enums ?? []).map((enumDecl): [Str, TypeRef] => [
      enumDecl.name,
      enumBackingType(enumDecl),
    ]),
    ...(program.taggedUnions ?? []).map((unionDecl): [Str, TypeRef] => [
      unionDecl.name,
      { kind: "NamedTypeRef", name: unionDecl.name, span: unionDecl.span },
    ]),
  ]);
}

function collectFunctions(program: ResolvedProgram): Map<Str, FunctionDecl> {
  return new Map(runtimeFunctions(program.functions).map((fn) => [fn.name, fn]));
}

function collectConstants(program: ResolvedProgram): Map<Str, ConstDecl> {
  return new Map((program.constants ?? []).map((constant) => [constant.name, constant]));
}

function collectInterfaceNames(program: ResolvedProgram): Set<Str> {
  return new Set((program.interfaces ?? []).map((interfaceDecl) => interfaceDecl.name));
}

function checkTypeAliases(
  program: ResolvedProgram,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const typeAlias of program.typeAliases) {
    diagnostics.push(...checkTypeRef(typeAlias.type, typeAliases, interfaceNames, "type-alias"));
    diagnostics.push(...checkTypeAliasLiteralValueTypes(typeAlias, typeAliases));
  }
  diagnostics.push(...checkTypeAliasCycles(program.typeAliases));
  diagnostics.push(...checkTypeAliasOrder(program.typeAliases));
  return diagnostics;
}

function checkEnumBackings(
  enums: EnumDecl[],
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
): Diagnostic[] {
  return enums.flatMap((enumDecl) =>
    checkTypeRef(enumBackingType(enumDecl), typeAliases, interfaceNames)
  );
}

function checkConstants(
  program: ResolvedProgram,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
): Diagnostic[] {
  return (program.constants ?? []).flatMap((constant) =>
    checkConstantDeclaration(constant, typeAliases, interfaceNames)
  );
}

function checkConstantDeclaration(
  constant: ConstDecl,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
): Diagnostic[] {
  return [
    ...checkTypeRef(constant.type, typeAliases, interfaceNames),
    ...checkValueType(
      constant.type,
      `Constant '${constant.name}' cannot have type 'void'`,
      constant.span,
    ),
  ];
}

function checkFunctions(
  program: ResolvedProgram,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const fn of program.functions) {
    diagnostics.push(...checkFunctionDeclaration(fn, typeAliases, interfaceNames));
  }
  return diagnostics;
}

function checkFunctionDeclaration(
  fn: FunctionDecl,
  typeAliases: Map<Str, TypeRef>,
  interfaceNames: Set<Str>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = isInferredFunctionReturn(fn)
    ? []
    : checkTypeRef(fn.returnType, typeAliases, interfaceNames);
  for (const param of fn.params) {
    diagnostics.push(...checkTypeRef(param.type, typeAliases, interfaceNames));
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
