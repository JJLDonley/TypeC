import type { CheckedProgram } from "checker";
import { emitCPrelude } from "c/prelude.ts";
import { createEmitContext, type EmitContext } from "emitter/context.ts";
import { emitArenaRuntimeSection } from "emitter/arenas.ts";
import { emitConstantDefinition } from "emitter/constants.ts";
import { emitEnumConstantDefinitions, emitEnumTypeDefinition } from "emitter/enums.ts";
import { emitFunctionDefinition } from "emitter/function_definitions.ts";
import { emitTaggedUnionConstants, emitTaggedUnionTypeDefinition } from "emitter/tagged_unions.ts";
import { collectFunctionPrototypes } from "emitter/function_prototypes.ts";
import { collectOptionalTypeDefinitions } from "emitter/optional_types.ts";
import { collectSliceTypeDefinitions } from "emitter/slice_types.ts";
import { collectEmittedTypeAliases } from "emitter/type_alias_collection.ts";

type Str = string;

export function emitTranslationUnit(program: CheckedProgram): Str {
  const context = createEmitContext(program);
  return [
    ...emitCPrelude(),
    ...emitArenaRuntimeSection(program),
    ...emitTypeAliasSection(program, context),
    ...emitEnumTypeSection(program),
    ...emitTaggedUnionTypeSection(program, context),
    ...emitOptionalTypeSection(program, context),
    ...emitSliceTypeSection(program, context),
    ...emitConstantSection(program, context),
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

function emitEnumTypeSection(program: CheckedProgram): Str[] {
  return (program.enums ?? []).flatMap((enumDecl) => [emitEnumTypeDefinition(enumDecl), ""]);
}

function emitTaggedUnionTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return (program.taggedUnions ?? []).flatMap((unionDecl) => [
    emitTaggedUnionTypeDefinition(unionDecl, context),
    "",
    ...emitTaggedUnionConstants(unionDecl),
    "",
  ]);
}

function emitOptionalTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectOptionalTypeDefinitions(program, context).flatMap((definition) => [definition, ""]);
}

function emitSliceTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectSliceTypeDefinitions(program, context).flatMap((definition) => [definition, ""]);
}

function emitConstantSection(program: CheckedProgram, context: EmitContext): Str[] {
  return [
    ...emitEnumConstantDefinitions(program.enums ?? [], context),
    ...(program.constants ?? []).map((constant) => emitConstantDefinition(constant, context)),
  ].flatMap((definition) => [definition, ""]);
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
