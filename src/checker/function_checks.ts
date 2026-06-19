import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkCAbiFunction } from "checker/c_abi_diagnostics.ts";
import { checkFunctionReturnType } from "checker/function_signatures.ts";
import { checkMainFunction } from "checker/main.ts";

type Str = string;

export function checkFunctionHeader(fn: FunctionDecl, returnType: TypeName, aliases: Map<Str, TypeRef>): Diagnostic[] {
  return [
    ...checkFunctionReturnType(fn, returnType),
    ...checkFunctionAbi(fn, aliases),
    ...checkFunctionEntrypoint(fn, returnType),
  ];
}

function checkFunctionAbi(fn: FunctionDecl, aliases: Map<Str, TypeRef>): Diagnostic[] {
  if (fn.external) return checkCAbiFunction(fn, "Extern", aliases);
  if (fn.exported) return checkCAbiFunction(fn, "Exported", aliases);
  return [];
}

function checkFunctionEntrypoint(fn: FunctionDecl, returnType: TypeName): Diagnostic[] {
  if (fn.name !== "main") return [];
  return checkMainFunction(fn, returnType);
}
