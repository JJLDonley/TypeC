import type { CheckedProgram } from "checker";
import { emitCPrelude } from "c/prelude.ts";
import { createEmitContext, type EmitContext } from "emitter/context.ts";
import { emitArenaRuntimeSection } from "emitter/arenas.ts";
import {
  emitBorrowedInterfaceShims,
  emitBorrowedInterfaceTypeDefinitions,
} from "emitter/borrowed_interfaces.ts";
import { emitConstantDefinition } from "emitter/constants.ts";
import { emitEnumConstantDefinitions, emitEnumTypeDefinition } from "emitter/enums.ts";
import { emitFunctionDefinition } from "emitter/function_definitions.ts";
import { emitTaggedUnionConstants, emitTaggedUnionTypeDefinition } from "emitter/tagged_unions.ts";
import { collectFunctionPrototypes } from "emitter/function_prototypes.ts";
import {
  collectOptionalTypeDefinitions,
  collectPostGeneratedHelperOptionalTypeDefinitions,
  collectPostGeneratedOptionalTypeDefinitions,
  collectPostHelperOptionalTypeDefinitions,
  collectPreAliasOptionalTypeDefinitions,
} from "emitter/optional_types.ts";
import {
  collectPostGeneratedAliasRecordTypeDefinitions,
  collectPostGeneratedOptionalRecordTypeDefinitions,
  collectRecordTypeDefinitions,
} from "emitter/record_types.ts";
import {
  collectPostGeneratedAliasSliceTypeDefinitions,
  collectPostGeneratedOptionalSliceTypeDefinitions,
  collectSliceTypeDefinitions,
} from "emitter/slice_types.ts";
import {
  collectPostGeneratedAliasTupleTypeDefinitions,
  collectPostGeneratedOptionalTupleTypeDefinitions,
  collectTupleTypeDefinitions,
} from "emitter/tuple_types.ts";
import {
  collectPostOptionalGeneratedEmittedTypeAliases,
  collectPreOptionalGeneratedEmittedTypeAliases,
  collectRegularEmittedTypeAliases,
} from "emitter/type_alias_collection.ts";

type Str = string;
type b8 = boolean;

export function emitTranslationUnit(program: CheckedProgram): Str {
  const context = createEmitContext(program);
  const preAliasOptionals = collectPreAliasOptionalTypeDefinitions(program.typeAliases, context);
  return [
    ...emitCPrelude(),
    ...emitArenaRuntimeSection(program),
    ...emitOptionalRuntimeHeaderSection(program, context, preAliasOptionals.names),
    ...emitBorrowedInterfaceTypeSection(program, context),
    ...emitPreAliasOptionalTypeSection(preAliasOptionals.definitions),
    ...emitEnumTypeSection(program),
    ...emitRegularTypeAliasSection(program, context),
    ...emitRecordTypeSection(program, context),
    ...emitTaggedUnionTypeSection(program, context),
    ...emitOptionalTypeSection(program, context, preAliasOptionals.names),
    ...emitSliceTypeSection(program, context),
    ...emitTupleTypeSection(program, context),
    ...emitPostHelperOptionalTypeSection(program, context, preAliasOptionals.names),
    ...emitPreOptionalGeneratedTypeAliasSection(program, context),
    ...emitPostGeneratedAliasRecordTypeSection(program, context),
    ...emitPostGeneratedAliasSliceTypeSection(program, context),
    ...emitPostGeneratedAliasTupleTypeSection(program, context),
    ...emitPostGeneratedOptionalTypeSection(program, context, preAliasOptionals.names),
    ...emitPostGeneratedOptionalRecordTypeSection(program, context),
    ...emitPostGeneratedOptionalSliceTypeSection(program, context),
    ...emitPostGeneratedOptionalTupleTypeSection(program, context),
    ...emitPostGeneratedHelperOptionalTypeSection(program, context, preAliasOptionals.names),
    ...emitPostOptionalGeneratedTypeAliasSection(program, context),
    ...emitConstantSection(program, context),
    ...emitFunctionPrototypeSection(program, context),
    "",
    ...emitBorrowedInterfaceShimSection(program, context),
    ...emitFunctionDefinitionSection(program, context),
  ].join("\n");
}

function emitOptionalRuntimeHeaderSection(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str>,
): Str[] {
  if (!usesOptionalAbortHelper(program, context, skipped)) return [];
  return ["#include <stdlib.h>", ""];
}

function usesOptionalAbortHelper(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str>,
): b8 {
  return [
    ...collectOptionalTypeDefinitions(program, context, skipped),
    ...collectPostHelperOptionalTypeDefinitions(program, context, skipped),
    ...collectPostGeneratedOptionalTypeDefinitions(program, context, skipped),
    ...collectPostGeneratedHelperOptionalTypeDefinitions(program, context, skipped),
  ].some((definition) => definition.includes("abort()"));
}

function emitBorrowedInterfaceTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return emitBorrowedInterfaceTypeDefinitions(program, context).flatMap((definition) => [
    definition,
    "",
  ]);
}

function emitPreAliasOptionalTypeSection(definitions: Str[]): Str[] {
  return definitions.flatMap((definition) => [definition, ""]);
}

function emitRegularTypeAliasSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectRegularEmittedTypeAliases(program.typeAliases, context).flatMap((typeAlias) => [
    typeAlias.text,
    "",
  ]);
}

function emitPreOptionalGeneratedTypeAliasSection(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectPreOptionalGeneratedEmittedTypeAliases(program.typeAliases, context).flatMap(
    (typeAlias) => [typeAlias.text, ""],
  );
}

function emitPostOptionalGeneratedTypeAliasSection(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectPostOptionalGeneratedEmittedTypeAliases(program.typeAliases, context).flatMap(
    (typeAlias) => [typeAlias.text, ""],
  );
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

function emitOptionalTypeSection(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str>,
): Str[] {
  return collectOptionalTypeDefinitions(program, context, skipped).flatMap((definition) => [
    definition,
    "",
  ]);
}

function emitSliceTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectSliceTypeDefinitions(program, context).flatMap((definition) => [definition, ""]);
}

function emitPostHelperOptionalTypeSection(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str>,
): Str[] {
  return collectPostHelperOptionalTypeDefinitions(program, context, skipped).flatMap((
    definition,
  ) => [
    definition,
    "",
  ]);
}

function emitTupleTypeSection(program: CheckedProgram, context: EmitContext): Str[] {
  return collectTupleTypeDefinitions(program, context).flatMap((definition) => [definition, ""]);
}

function emitPostGeneratedOptionalTypeSection(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str>,
): Str[] {
  return collectPostGeneratedOptionalTypeDefinitions(program, context, skipped).flatMap((
    definition,
  ) => [
    definition,
    "",
  ]);
}

function emitPostGeneratedAliasRecordTypeSection(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectPostGeneratedAliasRecordTypeDefinitions(program, context).flatMap((definition) => [
    definition,
    "",
  ]);
}

function emitPostGeneratedAliasSliceTypeSection(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectPostGeneratedAliasSliceTypeDefinitions(program, context).flatMap((definition) => [
    definition,
    "",
  ]);
}

function emitPostGeneratedAliasTupleTypeSection(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectPostGeneratedAliasTupleTypeDefinitions(program, context).flatMap((definition) => [
    definition,
    "",
  ]);
}

function emitPostGeneratedOptionalRecordTypeSection(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectPostGeneratedOptionalRecordTypeDefinitions(program, context).flatMap((
    definition,
  ) => [
    definition,
    "",
  ]);
}

function emitPostGeneratedOptionalSliceTypeSection(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectPostGeneratedOptionalSliceTypeDefinitions(program, context).flatMap((
    definition,
  ) => [
    definition,
    "",
  ]);
}

function emitPostGeneratedOptionalTupleTypeSection(
  program: CheckedProgram,
  context: EmitContext,
): Str[] {
  return collectPostGeneratedOptionalTupleTypeDefinitions(program, context).flatMap((
    definition,
  ) => [
    definition,
    "",
  ]);
}

function emitPostGeneratedHelperOptionalTypeSection(
  program: CheckedProgram,
  context: EmitContext,
  skipped: Set<Str>,
): Str[] {
  return collectPostGeneratedHelperOptionalTypeDefinitions(program, context, skipped).flatMap((
    definition,
  ) => [
    definition,
    "",
  ]);
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

function emitBorrowedInterfaceShimSection(program: CheckedProgram, context: EmitContext): Str[] {
  return emitBorrowedInterfaceShims(program, context).flatMap((definition) => [definition, ""]);
}

function emitFunctionDefinitionSection(program: CheckedProgram, context: EmitContext): Str[] {
  return program.functions.filter((fn) => fn.body && fn.overload !== true).flatMap((fn) => [
    emitFunctionDefinition(fn, context),
    "",
  ]);
}
