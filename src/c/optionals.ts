import type { TypeAliasDecl, TypeRef } from "core/ast.ts";
import { optionalCTypeName, optionalUnwrapFunctionNameFromTypeName } from "c/optional_names.ts";
import { typeName } from "core/type_ref.ts";
import { type CTypeAliases, emitCType } from "c/type.ts";

type Str = string;

export function emitOptionalCType(
  element: TypeRef,
  aliases: CTypeAliases = new Map<Str, TypeAliasDecl>(),
): Str {
  const name = optionalCTypeName(element);
  const valueType = emitCType(element, aliases);
  const unwrapName = optionalUnwrapFunctionNameFromTypeName(typeName(element));
  return [
    `typedef struct ${name} { b8 present; ${valueType} value; } ${name};`,
    `static inline ${valueType} ${unwrapName}(${name} value) { if (!value.present) abort(); return value.value; }`,
  ].join("\n");
}
