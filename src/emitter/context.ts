import type {
  ConstDecl,
  EnumDecl,
  FunctionDecl,
  Program,
  TaggedUnionDecl,
  TypeAliasDecl,
} from "core/ast.ts";
import { collectEnumConstants } from "emitter/enums.ts";
import type { CheckedProgram } from "checker";
import type { ExpressionTypeInfo } from "core/tast.ts";

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
  return {
    typeAliases: createTypeAliasMap(
      program.typeAliases,
      program.enums ?? [],
      program.taggedUnions ?? [],
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
): Map<Str, TypeAliasDecl> {
  return new Map<Str, TypeAliasDecl>([
    ...typeAliases.map((typeAlias): [Str, TypeAliasDecl] => [typeAlias.name, typeAlias]),
    ...enums.map((enumDecl): [Str, TypeAliasDecl] => [enumDecl.name, enumTypeAlias(enumDecl)]),
    ...unions.map((
      unionDecl,
    ): [Str, TypeAliasDecl] => [unionDecl.name, taggedUnionTypeAlias(unionDecl)]),
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

function enumTypeAlias(enumDecl: EnumDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: enumDecl.exported,
    name: enumDecl.name,
    cName: enumDecl.cName ?? enumDecl.name,
    type: { kind: "NamedTypeRef", name: "i32", span: enumDecl.span },
    span: enumDecl.span,
  };
}
