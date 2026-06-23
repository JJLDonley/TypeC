import type { ConstDecl, FunctionDecl, TypeAliasDecl } from "core/ast.ts";
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
    typeAliases: new Map(program.typeAliases.map((typeAlias) => [typeAlias.name, typeAlias])),
    constants,
    functions: new Map(program.functions.map((fn) => [fn.name, fn])),
    expressionTypes: program.expressionTypes,
  };
}
