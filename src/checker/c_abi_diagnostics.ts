import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl, TypeRef } from "core/ast.ts";
import { isCAbiType } from "checker/c_abi.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export function checkCAbiFunction(
  fn: FunctionDecl,
  label: Str,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!isCAbiType(fn.returnType, typeAliases)) {
    diagnostics.push({
      message: `${label} function '${fn.name}' return type '${
        typeName(fn.returnType)
      }' is not C ABI compatible`,
      span: fn.returnType.span,
    });
  }
  for (const param of fn.params) {
    if (isCAbiType(param.type, typeAliases)) continue;
    diagnostics.push({
      message: `${label} function '${fn.name}' parameter '${param.name}' type '${
        typeName(param.type)
      }' is not C ABI compatible`,
      span: param.span,
    });
  }
  return diagnostics;
}
