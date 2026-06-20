import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { isAddressable } from "checker/exprs.ts";
import { isPointerLikeTypeName, pointeeTypeName } from "checker/type_name_shapes.ts";

export interface PointerOperationCheck {
  type: TypeName;
  diagnostics: Diagnostic[];
}

type PostfixPointerExpr = Extract<Expression, { kind: "PostfixPointerExpr" }>;

export function checkPostfixPointerOperation(
  expr: PostfixPointerExpr,
  operand: TypeName,
): PointerOperationCheck {
  if (expr.operator === ".&") return checkAddressOperation(expr, operand);
  return checkDereferenceOperation(expr, operand);
}

function checkAddressOperation(expr: PostfixPointerExpr, operand: TypeName): PointerOperationCheck {
  if (isAddressable(expr.operand)) return { type: `${operand}&`, diagnostics: [] };
  return {
    type: `${operand}&`,
    diagnostics: [{
      message: "Cannot take address of non-addressable expression",
      span: expr.span,
    }],
  };
}

function checkDereferenceOperation(
  expr: PostfixPointerExpr,
  operand: TypeName,
): PointerOperationCheck {
  if (isPointerLikeTypeName(operand)) return { type: pointeeTypeName(operand), diagnostics: [] };
  return {
    type: "<error>",
    diagnostics: [{
      message: `Cannot dereference non-pointer-like type '${operand}'`,
      span: expr.span,
    }],
  };
}
