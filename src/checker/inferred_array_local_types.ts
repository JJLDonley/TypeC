import type { Expression } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isAssignable } from "checker/types.ts";

export type Str = string;
type usize = number;

type ArrayLiteralExpr = Extract<Expression, { kind: "ArrayLiteralExpr" }>;
type ElementTypeResolver = (expr: Expression) => TypeName;

export interface InferredArrayLocalTypeCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkInferredArrayLocalType(
  expr: ArrayLiteralExpr,
  resolveElementType: ElementTypeResolver,
): InferredArrayLocalTypeCheck {
  if (expr.elements.length === 0) {
    return {
      diagnostics: [{ message: "Cannot infer empty array type", span: expr.span }],
      type: "<error>",
    };
  }
  const elementTypes = expr.elements.map(resolveElementType);
  const elementType = elementTypes[0] ?? "<error>";
  return {
    diagnostics: elementDiagnostics(expr.elements, elementTypes, elementType),
    type: `${elementType}[${expr.elements.length}]`,
  };
}

function elementDiagnostics(
  elements: Expression[],
  actualTypes: TypeName[],
  expectedType: TypeName,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (let index: usize = 0; index < elements.length; index++) {
    const actualType = actualTypes[index] ?? "<error>";
    if (isAssignable(actualType, expectedType)) continue;
    diagnostics.push({
      message: `Array element type '${actualType}' is not assignable to '${expectedType}'`,
      span: elements[index].span,
    });
  }
  return diagnostics;
}
