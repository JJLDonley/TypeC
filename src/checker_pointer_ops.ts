import type { Diagnostic } from "./diagnostics.ts";
import type { Expression } from "./ast.ts";
import type { TypeName } from "./tast.ts";
import { isAddressable } from "./checker_exprs.ts";
import { isPointerLikeType } from "./checker_types.ts";

export interface PointerOperationCheck {
  type: TypeName;
  diagnostics: Diagnostic[];
}

type PostfixPointerExpr = Extract<Expression, { kind: "PostfixPointerExpr" }>;

export function checkPostfixPointerOperation(expr: PostfixPointerExpr, operand: TypeName): PointerOperationCheck {
  if (expr.operator === ".&") return checkAddressOperation(expr, operand);
  return checkDereferenceOperation(expr, operand);
}

function checkAddressOperation(expr: PostfixPointerExpr, operand: TypeName): PointerOperationCheck {
  if (isAddressable(expr.operand)) return { type: `${operand}&`, diagnostics: [] };
  return { type: `${operand}&`, diagnostics: [{ message: "Cannot take address of non-addressable expression", span: expr.span }] };
}

function checkDereferenceOperation(expr: PostfixPointerExpr, operand: TypeName): PointerOperationCheck {
  if (isPointerLikeType(operand)) return { type: operand.slice(0, -1), diagnostics: [] };
  return { type: "<error>", diagnostics: [{ message: `Cannot dereference non-pointer-like type '${operand}'`, span: expr.span }] };
}
