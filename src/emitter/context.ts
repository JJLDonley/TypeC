import type {
  ConstDecl,
  EnumDecl,
  FunctionDecl,
  InterfaceDecl,
  Program,
  TaggedUnionDecl,
  TypeAliasDecl,
} from "core/ast.ts";
import { collectEnumConstants, enumBackingCTypeName } from "emitter/enums.ts";
import { taggedUnionTagConstants } from "core/tagged_union_constants.ts";
import type { CheckedProgram } from "checker";
import type { ExpressionTypeInfo } from "core/tast.ts";
import { borrowedInterfaceAliasType } from "core/borrowed_interfaces.ts";

type Str = string;

export interface EmitContext {
  typeAliases: Map<Str, TypeAliasDecl>;
  constants?: Map<Str, ConstDecl>;
  functions: Map<Str, FunctionDecl>;
  expressionTypes?: Map<Str, ExpressionTypeInfo>;
  program?: Program;
}

export function createEmitContext(program: CheckedProgram): EmitContext {
  const constants = new Map(
    (program.constants ?? []).map((constant): [Str, ConstDecl] => [constant.name, constant]),
  );
  for (const constant of collectEnumConstants(program.enums ?? [], constants)) {
    constants.set(constant.name, constant);
  }
  for (const constant of taggedUnionTagConstants(program.taggedUnions ?? [])) {
    constants.set(constant.name, constant);
  }
  return {
    typeAliases: createTypeAliasMap(
      program.typeAliases,
      program.enums ?? [],
      program.taggedUnions ?? [],
      program.interfaces ?? [],
    ),
    constants,
    functions: new Map(program.functions.map((fn) => [fn.name, fn])),
    expressionTypes: program.expressionTypes,
    program,
  };
}

function createTypeAliasMap(
  typeAliases: TypeAliasDecl[],
  enums: EnumDecl[],
  unions: TaggedUnionDecl[],
  interfaces: InterfaceDecl[],
): Map<Str, TypeAliasDecl> {
  return new Map<Str, TypeAliasDecl>([
    ...typeAliases.map((typeAlias): [Str, TypeAliasDecl] => [typeAlias.name, typeAlias]),
    ...enums.map((enumDecl): [Str, TypeAliasDecl] => [enumDecl.name, enumTypeAlias(enumDecl)]),
    ...unions.map((
      unionDecl,
    ): [Str, TypeAliasDecl] => [unionDecl.name, taggedUnionTypeAlias(unionDecl)]),
    ...interfaces.map((interfaceDecl): [Str, TypeAliasDecl] => [
      interfaceDecl.name,
      interfaceTypeAlias(interfaceDecl),
    ]),
  ]);
}

function taggedUnionTypeAlias(unionDecl: TaggedUnionDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: unionDecl.exported,
    name: unionDecl.name,
    cName: unionDecl.cName ?? unionDecl.name,
    type: { kind: "NamedTypeRef", name: unionDecl.name, span: unionDecl.span },
    span: unionDecl.span,
  };
}

function interfaceTypeAlias(interfaceDecl: InterfaceDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: interfaceDecl.exported,
    name: interfaceDecl.name,
    cName: interfaceDecl.name,
    type: borrowedInterfaceAliasType(interfaceDecl.span),
    span: interfaceDecl.span,
  };
}

function enumTypeAlias(enumDecl: EnumDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: enumDecl.exported,
    name: enumDecl.name,
    cName: enumDecl.cName ?? enumDecl.name,
    type: { kind: "NamedTypeRef", name: enumBackingCTypeName(enumDecl), span: enumDecl.span },
    span: enumDecl.span,
  };
}
