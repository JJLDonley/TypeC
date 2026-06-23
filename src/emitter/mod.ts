import type { CheckedProgram } from "checker";
import { emitTranslationUnit } from "emitter/translation_units.ts";

type Str = string;

export function emitC(program: CheckedProgram): Str {
  return emitTranslationUnit(program);
}

export * from "emitter/array_var_declarations.ts";
export * from "emitter/assignments.ts";
export * from "emitter/blocks.ts";
export * from "emitter/calls.ts";
export * from "emitter/constant_expressions.ts";
export * from "emitter/constants.ts";
export * from "emitter/context.ts";
export * from "emitter/control_flow.ts";
export * from "emitter/enums.ts";
export * from "emitter/expression_statements.ts";
export * from "emitter/expressions.ts";
export * from "emitter/function_definitions.ts";
export * from "emitter/function_prototypes.ts";
export * from "emitter/functions.ts";
export * from "emitter/helpers.ts";
export * from "emitter/local_types.ts";
export * from "emitter/record_types.ts";
export * from "emitter/return_statements.ts";
export * from "emitter/statements.ts";
export * from "emitter/strings.ts";
export * from "emitter/switch_statements.ts";
export * from "emitter/translation_units.ts";
export * from "emitter/type_alias_collection.ts";
export * from "emitter/type_aliases.ts";
export * from "emitter/type_names.ts";
export * from "emitter/var_declarations.ts";
