import type { Diagnostic } from "../diagnostics.ts";
import type { FunctionDecl } from "../ast.ts";
import type { TypeName } from "../tast.ts";
import { parseArrayType } from "checker/types.ts";

type Str = string;
type usize = number;

export function checkFunctionReturnType(fn: FunctionDecl, returnType: TypeName): Diagnostic[] {
  if (!parseArrayType(returnType)) return [];
  return [{ message: `Function '${fn.name}' cannot return array type '${returnType}'`, span: fn.returnType.span }];
}

export function checkFunctionParamType(param: FunctionDecl["params"][usize], functionName: Str): Diagnostic[] {
  if (param.type.kind !== "InferredArrayTypeRef") return [];
  return [{ message: `Parameter '${param.name}' of function '${functionName}' cannot have inferred array type`, span: param.span }];
}
