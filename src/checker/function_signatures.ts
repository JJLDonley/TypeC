import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { parseArrayType } from "checker/types.ts";

export function checkFunctionReturnType(fn: FunctionDecl, returnType: TypeName): Diagnostic[] {
  if (!parseArrayType(returnType)) return [];
  return [{ message: `Function '${fn.name}' cannot return array type '${returnType}'`, span: fn.returnType.span }];
}

