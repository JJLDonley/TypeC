import { lex } from "../src/lexer.ts";
import { parse } from "../src/parser.ts";
import { typeName } from "../src/type_ref.ts";

type Str = string;

Deno.test("parses record type alias", () => {
  const program = parse(lex(`type Vec2 = { x: f32; y: f32; }; function main(): i32 { return 0; }`));
  if (program.typeAliases.length !== 1) throw new Error("Expected one type alias");
  if (program.typeAliases[0].type.kind !== "RecordTypeRef") throw new Error("Expected record type");
});

Deno.test("parses pointer reference and array type syntax", () => {
  const program = parse(lex(`function f(a: i32*, b: i32&, c: i32[], d: i32[16]): void { return 0; }`));
  const types = program.functions[0].params.map((param) => typeName(param.type));
  assertEqualText(types, ["i32*", "i32&", "i32[]", "i32[16]"]);
});

Deno.test("parses postfix pointer expressions", () => {
  const program = parse(lex(`function f(p: i32*): i32 { return p.*; }`));
  const statement = program.functions[0].body.statements[0];
  if (statement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (statement.expression.kind !== "PostfixPointerExpr") throw new Error("Expected postfix pointer expression");
  if (statement.expression.operator !== ".*") throw new Error("Expected .* operator");
});

Deno.test("parses array literals and indexing", () => {
  const program = parse(lex(`function main(): i32 { const xs: i32[] = [1, 2, 3]; return xs[0]; }`));
  const returnStatement = program.functions[0].body.statements[1];
  if (returnStatement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (returnStatement.expression.kind !== "IndexExpr") throw new Error("Expected index expression");
});

function assertEqualText(actual: Str[], expected: Str[]): void {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) throw new Error(formatMismatch(actual, expected));
}

function formatMismatch(actual: Str[], expected: Str[]): Str {
  return `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}
