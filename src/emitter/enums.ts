import { checkEnums } from "checker/enums.ts";
import type { ConstDecl, EnumDecl, TypeRef } from "core/ast.ts";
import { enumBackingType } from "core/enums.ts";
import { emitConstantDefinition } from "emitter/constants.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function emitEnumTypeDefinition(enumDecl: EnumDecl): Str {
  return `typedef ${enumBackingCTypeName(enumDecl)} ${enumDecl.cName ?? enumDecl.name};`;
}

export function enumBackingCTypeName(enumDecl: EnumDecl): Str {
  return enumBackingTypeName(enumBackingType(enumDecl));
}

function enumBackingTypeName(type: TypeRef): Str {
  return type.kind === "NamedTypeRef" ? type.name : "<error>";
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
