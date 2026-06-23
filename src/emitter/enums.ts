import { checkEnums } from "checker/enums.ts";
import type { ConstDecl, EnumDecl } from "core/ast.ts";
import { emitConstantDefinition } from "emitter/constants.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function emitEnumTypeDefinition(enumDecl: EnumDecl): Str {
  return `typedef i32 ${enumDecl.cName ?? enumDecl.name};`;
}

export function collectEnumConstants(
  enums: EnumDecl[],
  constants: Map<Str, ConstDecl>,
): ConstDecl[] {
  return checkEnums(enums, constants).constants;
}

export function emitEnumConstantDefinitions(
  enums: EnumDecl[],
  context: EmitContext,
): Str[] {
  return collectEnumConstants(enums, context.constants ?? new Map()).map((constant) =>
    emitConstantDefinition(constant, context)
  );
}
