import type { Diagnostic } from "core/diagnostics.ts";
import type { FunctionDecl } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";

export function checkMainFunction(fn: FunctionDecl, returnType: TypeName): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (fn.external) diagnostics.push({ message: "Function 'main' cannot be extern", span: fn.span });
  if (fn.params.length !== 0) {
    diagnostics.push({ message: "Function 'main' cannot have parameters", span: fn.span });
  }
  if (returnType !== "i32") {
    diagnostics.push({ message: `Function 'main' must return 'i32'`, span: fn.returnType.span });
  }
  return diagnostics;
}
