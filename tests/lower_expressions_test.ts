import type { SourceSpan } from "../src/diagnostics.ts";
import type { CastExpression } from "../src/cast.ts";
import { lowerExpression } from "../src/lower_expressions.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("lowers nested expressions", () => {
  const expr: CastExpression = {
    kind: "BinaryExpr",
    operator: "+",
    left: call("add", [integer("1"), identifier("x")]),
    right: {
      kind: "IndexExpr",
      operand: { kind: "ArrayLiteralExpr", elements: [integer("2")], span },
      index: integer("0"),
      span,
    },
    span,
  };

  assertText(lowerExpression(expr).kind, "BinaryExpr");
});

Deno.test("lowers record and pointer expressions", () => {
  const expr: CastExpression = {
    kind: "PostfixPointerExpr",
    operator: ".&",
    operand: {
      kind: "FieldAccessExpr",
      operand: {
        kind: "RecordLiteralExpr",
        fields: [{ name: "value", expression: { kind: "BoolLiteral", value: true, text: "true", span }, span }],
        span,
      },
      field: "value",
      span,
    },
    span,
  };

  assertText(lowerExpression(expr).kind, "PostfixPointerExpr");
});

function integer(text: Str): CastExpression {
  return { kind: "IntegerLiteral", value: BigInt(text), text, span };
}

function identifier(name: Str): CastExpression {
  return { kind: "IdentifierExpr", name, span };
}

function call(callee: Str, args: CastExpression[]): CastExpression {
  return { kind: "CallExpr", callee, args, span };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
