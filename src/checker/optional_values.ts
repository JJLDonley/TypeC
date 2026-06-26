import type { Expression, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { isAssignable } from "checker/types.ts";
import { checkTypeRef } from "checker/type_validation.ts";
import { checkValueType } from "checker/value_types.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export interface OptionalConstructorCheck {
  handled: b8;
  diagnostics: Diagnostic[];
  type: TypeName;
}

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkOptionalConstructorCall(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  aliases: Map<Str, TypeRef>,
  resolveExpectedType: ExpectedTypeResolver,
): OptionalConstructorCheck {
  if (expr.callee !== "Some" && expr.callee !== "None") return unhandled();
  const typeArg = singleTypeArg(expr);
  const diagnostics: Diagnostic[] = [];
  if (typeArg === null) {
    diagnostics.push({
      message: `${expr.callee} requires exactly one type argument`,
      span: expr.span,
    });
  } else {
    diagnostics.push(...checkTypeRef(typeArg, aliases));
    diagnostics.push(
      ...checkValueType(typeArg, "Optional constructor type cannot be 'void'", typeArg.span),
    );
  }
  if (expr.callee === "Some") {
    diagnostics.push(...checkArity(expr, 1));
    if (typeArg !== null && expr.args[0]) {
      const expected = typeName(typeArg);
      const actual = resolveExpectedType(expr.args[0], expected);
      if (!isAssignable(actual, expected)) {
        diagnostics.push({
          message: `Type '${actual}' is not assignable to '${expected}'`,
          span: expr.args[0].span,
        });
      }
    }
  } else {
    diagnostics.push(...checkArity(expr, 0));
  }
  return {
    handled: true,
    diagnostics,
    type: typeArg === null ? "<error>" : `${typeName(typeArg)}?`,
  };
}

function singleTypeArg(expr: Extract<Expression, { kind: "CallExpr" }>): TypeRef | null {
  const typeArgs = expr.typeArgs ?? [];
  return typeArgs.length === 1 ? typeArgs[0]! : null;
}

function checkArity(
  expr: Extract<Expression, { kind: "CallExpr" }>,
  expected: usize,
): Diagnostic[] {
  return expr.args.length === expected ? [] : [{
    message: `${expr.callee} expects ${expected} arguments, got ${expr.args.length}`,
    span: expr.span,
  }];
}

function unhandled(): OptionalConstructorCheck {
  return { handled: false, diagnostics: [], type: "<error>" };
}
