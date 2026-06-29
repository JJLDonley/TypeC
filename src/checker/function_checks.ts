import { VARIADIC_FUNCTION_EXTERN, VARIADIC_FUNCTION_FIXED_PARAM } from "core/diagnostic_codes.ts";
import type { FunctionDecl, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkCAbiFunction } from "checker/c_abi_diagnostics.ts";
import { checkFunctionReturnType } from "checker/function_signatures.ts";
import { checkMainFunction } from "checker/main.ts";

type Str = string;

export function checkFunctionHeader(
  fn: FunctionDecl,
  returnType: TypeName,
  aliases: Map<Str, TypeRef>,
): Diagnostic[] {
  return [
    ...checkFunctionReturnType(fn, returnType),
    ...checkFunctionVariadic(fn),
    ...checkFunctionAbi(fn, aliases),
    ...checkFunctionEntrypoint(fn, returnType),
  ];
}

function checkFunctionVariadic(fn: FunctionDecl): Diagnostic[] {
  if (fn.variadic !== true) return [];
  if (!fn.external) {
    return [{
      message: `Function '${fn.name}' cannot be variadic unless it is extern`,
      code: VARIADIC_FUNCTION_EXTERN,
      span: fn.span,
    }];
  }
  if (fn.params.length === 0) {
    return [{
      message: `Variadic extern function '${fn.name}' requires at least one fixed parameter`,
      code: VARIADIC_FUNCTION_FIXED_PARAM,
      span: fn.span,
    }];
  }
  return [];
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
