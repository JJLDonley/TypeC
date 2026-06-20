import type { CheckedProgram } from "checker";
import { emitCPrelude } from "c/prelude.ts";
import { createEmitContext, type EmitContext } from "emitter/context.ts";
import { emitFunctionDefinition } from "emitter/function_definitions.ts";
import { collectFunctionPrototypes } from "emitter/function_prototypes.ts";
import { collectSliceTypeDefinitions } from "emitter/slice_types.ts";
import { collectEmittedTypeAliases } from "emitter/type_alias_collection.ts";

type Str = string;

export function emitTranslationUnit(program: CheckedProgram): Str {
  const context = createEmitContext(program);
  return [
    ...emitCPrelude(),
    ...emitTypeAliasSection(program, context),
    ...emitSliceTypeSection(program, context),
    ...emitFunctionPrototypeSection(program, context),
    "",
    ...emitFunctionDefinitionSection(program, context),
  ].join("\n");
}

function emitTypeAliasSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectEmittedTypeAliases(program.typeAliases, context).flatMap((typeAlias) => [
    typeAlias.text,
    "",
  ]);
}

function emitSliceTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectSliceTypeDefinitions(program, context).flatMap((definition) => [definition, ""]);
}

function emitFunctionPrototypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return [
    ...collectFunctionPrototypes(program.functions.filter((fn) => fn.external), context),
    ...collectFunctionPrototypes(program.functions.filter((fn) => !fn.external), context),
  ];
}

function emitFunctionDefinitionSection(program: CheckedProgram, context: EmitContext): Str[] {
  return program.functions.filter((fn) => fn.body).flatMap((fn) => [
    emitFunctionDefinition(fn, context),
    "",
  ]);
}
