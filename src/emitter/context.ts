import type { ConstDecl, EnumDecl, FunctionDecl, TypeAliasDecl } from "core/ast.ts";
import { collectEnumConstants } from "emitter/enums.ts";
import type { CheckedProgram } from "checker";
import type { ExpressionTypeInfo } from "core/tast.ts";

type Str = string;

export interface EmitContext {
  typeAliases: Map<Str, TypeAliasDecl>;
  constants?: Map<Str, ConstDecl>;
  functions: Map<Str, FunctionDecl>;
  expressionTypes?: Map<Str, ExpressionTypeInfo>;
}

export function createEmitContext(program: CheckedProgram): EmitContext {
  const constants = new Map(
    (program.constants ?? []).map((constant): [Str, ConstDecl] => [constant.name, constant]),
  );
  for (const constant of collectEnumConstants(program.enums ?? [], constants)) {
    constants.set(constant.name, constant);
  }
  return {
    typeAliases: createTypeAliasMap(program.typeAliases, program.enums ?? []),
    constants,
    functions: new Map(program.functions.map((fn) => [fn.name, fn])),
    expressionTypes: program.expressionTypes,
  };
}

function createTypeAliasMap(
  typeAliases: TypeAliasDecl[],
  enums: EnumDecl[],
): Map<Str, TypeAliasDecl> {
  return new Map<Str, TypeAliasDecl>([
    ...typeAliases.map((typeAlias): [Str, TypeAliasDecl] => [typeAlias.name, typeAlias]),
    ...enums.map((enumDecl): [Str, TypeAliasDecl] => [enumDecl.name, enumTypeAlias(enumDecl)]),
  ]);
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
