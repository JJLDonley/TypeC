import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";

export function checkFunctionReturnType(fn: FunctionDecl, returnType: TypeName): Diagnostic[] {
  if (!parseArrayTypeName(returnType)) return [];
  return [{
    message: `Function '${fn.name}' cannot return array type '${returnType}'`,
    span: fn.returnType.span,
  }];
}
