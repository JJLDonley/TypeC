import type { Expression, Program, TypeAliasDecl } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";

export type Str = string;

export interface ForInIterableInfo {
  keyType: TypeName;
  diagnostics: Diagnostic[];
}

export function checkForInIterable(
  iterable: Expression,
  iterableType: TypeName | null,
  program: Program,
): ForInIterableInfo {
  const enumType = enumIterableType(iterable, program);
  if (enumType !== null) return { keyType: enumType, diagnostics: [] };
  if (iterableType !== null && recordIterableType(iterableType, program.typeAliases) !== null) {
    return { keyType: "u8*", diagnostics: [] };
  }
  return {
    keyType: "<error>",
    diagnostics: [{ message: "For-in iterable must be a record, class, or enum", span: iterable.span }],
  };
}

function enumIterableType(iterable: Expression, program: Program): TypeName | null {
  if (iterable.kind !== "IdentifierExpr") return null;
  return program.enums?.some((enumDecl) => enumDecl.name === iterable.name) ? iterable.name : null;
}

function recordIterableType(typeName: TypeName, aliases: TypeAliasDecl[]): TypeAliasDecl | null {
  return aliases.find((alias) => alias.name === typeName && alias.type.kind === "RecordTypeRef") ??
    null;
}
