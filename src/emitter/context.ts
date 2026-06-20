import type { FunctionDecl, TypeAliasDecl } from "core/ast.ts";
import type { CheckedProgram } from "checker";
import type { ExpressionTypeInfo } from "core/tast.ts";

type Str = string;

export interface EmitContext {
  typeAliases: Map<Str, TypeAliasDecl>;
  functions: Map<Str, FunctionDecl>;
  expressionTypes?: Map<Str, ExpressionTypeInfo>;
}

export function createEmitContext(program: CheckedProgram): EmitContext {
  return {
    typeAliases: new Map(program.typeAliases.map((typeAlias) => [typeAlias.name, typeAlias])),
    functions: new Map(program.functions.map((fn) => [fn.name, fn])),
    expressionTypes: program.expressionTypes,
  };
}
