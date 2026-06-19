import type { BlockStmt } from "../src/ast.ts";
import { TypeCError } from "../src/diagnostics.ts";
import { lex } from "../src/lexer.ts";
import { parse } from "../src/parser.ts";
import { typeName } from "../src/type_ref.ts";

type Str = string;

Deno.test("parses extern functions", () => {
  const program = parse(lex(`extern function puts(s: u8*): i32; function main(): i32 { return 0; }`));
  const fn = program.functions[0];
  if (!fn.external) throw new Error("Expected extern function");
  if (fn.body) throw new Error("Expected no extern body");
});

Deno.test("rejects invalid declaration modifiers", () => {
  assertParseError(`export import { add } from "./math.tc";`, "Imports cannot be exported");
  assertParseError(`extern type Vec2 = { x: f32; };`, "Type aliases cannot be extern");
  assertParseError(`export extern function add(a: i32, b: i32): i32;`, "Extern functions cannot be exported");
});

Deno.test("parses imports", () => {
  const program = parse(lex(`import { add } from "./math.tc"; function main(): i32 { return add(1, 2); }`));
  if (program.imports.length !== 1) throw new Error("Expected one import");
  if (program.imports[0].names[0] !== "add") throw new Error("Expected add import");
});

Deno.test("parses exported functions", () => {
  const program = parse(lex(`export function add(a: i32, b: i32): i32 { return a + b; }`));
  if (!program.functions[0].exported) throw new Error("Expected exported function");
});

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
  const statement = requireBody(program.functions[0].body).statements[0];
  if (statement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (statement.expression.kind !== "PostfixPointerExpr") throw new Error("Expected postfix pointer expression");
  if (statement.expression.operator !== ".*") throw new Error("Expected .* operator");
});

Deno.test("parses array literals and indexing", () => {
  const program = parse(lex(`function main(): i32 { const xs: i32[] = [1, 2, 3]; return xs[0]; }`));
  const returnStatement = requireBody(program.functions[0].body).statements[1];
  if (returnStatement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (returnStatement.expression.kind !== "IndexExpr") throw new Error("Expected index expression");
});

Deno.test("parses while and assignment statements", () => {
  const program = parse(lex(`function main(): i32 { let x: i32 = 0; while (x < 3) { x = x + 1; } return x; }`));
  const statement = requireBody(program.functions[0].body).statements[1];
  if (statement.kind !== "WhileStmt") throw new Error("Expected while statement");
});

Deno.test("parses bool literals", () => {
  const program = parse(lex(`function flag(): bool { return true; }`));
  const statement = requireBody(program.functions[0].body).statements[0];
  if (statement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (statement.expression.kind !== "BoolLiteral") throw new Error("Expected bool literal");
});

Deno.test("parses if else statements", () => {
  const program = parse(lex(`function main(): i32 { if (true) { return 1; } else { return 0; } }`));
  const statement = requireBody(program.functions[0].body).statements[0];
  if (statement.kind !== "IfStmt") throw new Error("Expected if statement");
  if (!statement.elseBody) throw new Error("Expected else body");
});

function assertParseError(source: Str, message: Str): void {
  try {
    parse(lex(source));
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics.some((diagnostic) => diagnostic.message === message)) return;
  }
  throw new Error(`Expected parser error: ${message}`);
}

function requireBody(body: BlockStmt | null): BlockStmt {
  if (!body) throw new Error("Expected function body");
  return body;
}

function assertEqualText(actual: Str[], expected: Str[]): void {
  const sameLength = actual.length === expected.length;
  const sameItems = actual.every((value, index) => value === expected[index]);
  if (!sameLength || !sameItems) throw new Error(formatMismatch(actual, expected));
}

function formatMismatch(actual: Str[], expected: Str[]): Str {
  return `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}
