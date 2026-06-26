import type { CheckedProgram } from "checker";
import { emitCPrelude } from "c/prelude.ts";
import { createEmitContext, type EmitContext } from "emitter/context.ts";
import { emitArenaRuntimeSection } from "emitter/arenas.ts";
import { emitClassVTableDefinition } from "emitter/class_vtables.ts";
import { emitConstantDefinition } from "emitter/constants.ts";
import { emitEnumConstantDefinitions, emitEnumTypeDefinition } from "emitter/enums.ts";
import { emitFunctionDefinition } from "emitter/function_definitions.ts";
import { emitTaggedUnionConstants, emitTaggedUnionTypeDefinition } from "emitter/tagged_unions.ts";
import { collectFunctionPrototypes } from "emitter/function_prototypes.ts";
import { collectOptionalTypeDefinitions } from "emitter/optional_types.ts";
import { collectRecordTypeDefinitions } from "emitter/record_types.ts";
import { collectSliceTypeDefinitions } from "emitter/slice_types.ts";
import { collectTupleTypeDefinitions } from "emitter/tuple_types.ts";
import { collectEmittedTypeAliases } from "emitter/type_alias_collection.ts";

type Str = string;

export function emitTranslationUnit(program: CheckedProgram): Str {
  const context = createEmitContext(program);
  return [
    ...emitCPrelude(),
    ...emitArenaRuntimeSection(program),
    ...emitTypeAliasSection(program, context),
    ...emitRecordTypeSection(program, context),
    ...emitEnumTypeSection(program),
    ...emitTaggedUnionTypeSection(program, context),
    ...emitOptionalTypeSection(program, context),
    ...emitSliceTypeSection(program, context),
    ...emitTupleTypeSection(program, context),
    ...emitConstantSection(program, context),
    ...emitFunctionPrototypeSection(program, context),
    "",
    ...emitClassVTableSection(program),
    ...emitFunctionDefinitionSection(program, context),
  ].join("\n");
}

function emitTypeAliasSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectEmittedTypeAliases(program.typeAliases, context).flatMap((typeAlias) => [
    typeAlias.text,
    "",
  ]);
}

function emitRecordTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectRecordTypeDefinitions(program, context).flatMap((definition) => [definition, ""]);
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

function emitTupleTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectTupleTypeDefinitions(program, context).flatMap((definition) => [definition, ""]);
}

function emitConstantSection(program: CheckedProgram, context: EmitContext): Str[] {
  return [
    ...emitEnumConstantDefinitions(program.enums ?? [], context),
    ...(program.constants ?? []).map((constant) => emitConstantDefinition(constant, context)),
  ].flatMap((definition) => [definition, ""]);
}

function emitFunctionPrototypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  const functions = program.functions.filter((fn) => fn.overload !== true);
  return [
    ...collectFunctionPrototypes(functions.filter((fn) => fn.external), context),
    ...collectFunctionPrototypes(functions.filter((fn) => !fn.external), context),
  ];
}

function emitClassVTableSection(program: CheckedProgram): Str[] {
  return (program.classVTables ?? []).flatMap((vtable) => [emitClassVTableDefinition(vtable), ""]);
}

function emitFunctionDefinitionSection(program: CheckedProgram, context: EmitContext): Str[] {
  return program.functions.filter((fn) => fn.body && fn.overload !== true).flatMap((fn) => [
    emitFunctionDefinition(fn, context),
    "",
  ]);
}
