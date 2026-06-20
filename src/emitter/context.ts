import type { ConstDecl, FunctionDecl, TypeAliasDecl } from "core/ast.ts";
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
  return {
    typeAliases: new Map(program.typeAliases.map((typeAlias) => [typeAlias.name, typeAlias])),
    constants: new Map((program.constants ?? []).map((constant) => [constant.name, constant])),
    functions: new Map(program.functions.map((fn) => [fn.name, fn])),
    expressionTypes: program.expressionTypes,
  };
}
