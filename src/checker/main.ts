import {
  MAIN_FUNCTION_EXTERN,
  MAIN_FUNCTION_PARAMS,
  MAIN_FUNCTION_RETURN,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";

export function checkMainFunction(fn: FunctionDecl, returnType: TypeName): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (fn.external) {
    diagnostics.push({
      message: "Function 'main' cannot be extern",
      code: MAIN_FUNCTION_EXTERN,
      span: fn.span,
    });
  }
  if (fn.params.length !== 0) {
    diagnostics.push({
      message: "Function 'main' cannot have parameters",
      code: MAIN_FUNCTION_PARAMS,
      span: fn.span,
    });
  }
  if (returnType !== "i32") {
    diagnostics.push({
      message: `Function 'main' must return 'i32'`,
      code: MAIN_FUNCTION_RETURN,
      span: fn.returnType.span,
    });
  }
  return diagnostics;
}
