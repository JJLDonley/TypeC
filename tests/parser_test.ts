import type { BlockStmt } from "core/ast.ts";
import { TypeCError } from "core/diagnostics.ts";
import { lex } from "core/lexer.ts";
import { parse, parseCast } from "parser";
import { typeName } from "core/type_ref.ts";

type Str = string;

Deno.test("parses extern functions", () => {
  const program = parse(
    lex(`extern function puts(s: u8*): i32; function main(): i32 { return 0; }`),
  );
  const fn = program.functions[0];
  if (!fn.external) throw new Error("Expected extern function");
  if (fn.body) throw new Error("Expected no extern body");
});

Deno.test("rejects invalid declaration modifiers", () => {
  assertParseError(`export import { add } from "./math.tc";`, "Imports cannot be exported");
  assertParseError(`extern type Vec2 = { x: f32; };`, "Type aliases cannot be extern");
  assertParseError(
    `export extern function add(a: i32, b: i32): i32;`,
    "Extern functions cannot be exported",
  );
});

Deno.test("parses imports", () => {
  const program = parse(
    lex(`import { add } from "./math.tc"; function main(): i32 { return add(1, 2); }`),
  );
  if (program.imports.length !== 1) throw new Error("Expected one import");
  if (program.imports[0].names[0]?.local !== "add") throw new Error("Expected add import");
});

Deno.test("parses namespace imports and calls", () => {
  const program = parse(
    lex(`import * as Math from "./math.tc"; function main(): i32 { return Math.add(1, 2); }`),
  );
  if (program.imports[0].namespace !== "Math") throw new Error("Expected namespace import");
  const statement = requireBody(program.functions[0].body).statements[0];
  if (statement.kind !== "ReturnStmt" || statement.expression?.kind !== "MethodCallExpr") {
    throw new Error("Expected namespace call");
  }
  if (statement.expression.method !== "add") throw new Error("Expected namespace method");
});

Deno.test("rejects empty imports", () => {
  assertParseError(
    `import { } from "./math.tc"; function main(): i32 { return 0; }`,
    "Import must name at least one symbol",
  );
});

Deno.test("rejects duplicate import names", () => {
  assertParseError(
    `import { add, add } from "./math.tc"; function main(): i32 { return 0; }`,
    "Duplicate imported name 'add'",
  );
});

Deno.test("parses class declarations", () => {
  const program = parse(
    lex(`class Vec2 { x: f64; y: f64; lengthSquared(): f64 { return this.x; } }
function main(): i32 { const v: Vec2 = { x: 1.0, y: 2.0 }; return 0; }`),
  );
  if (program.typeAliases.length !== 1) throw new Error("Expected class type alias");
  if (program.typeAliases[0].name !== "Vec2") throw new Error("Expected class type name");
  if (program.functions.length !== 2) throw new Error("Expected method and main functions");
  const method = program.functions.find((fn) => fn.name === "Vec2.lengthSquared");
  if (!method) throw new Error("Expected method");
  const methodReturn = requireBody(method.body).statements[0];
  if (methodReturn.kind !== "ReturnStmt") throw new Error("Expected method return");
  if (methodReturn.expression?.kind !== "FieldAccessExpr") throw new Error("Expected this field");
});

Deno.test("parses method call expressions", () => {
  const program = parse(
    lex(`class Vec2 { x: f64; lengthSquared(): f64 { return this.x; } }
function main(): i32 { const v: Vec2 = { x: 1.0 }; const d: f64 = v.lengthSquared(); return 0; }`),
  );
  const main = program.functions.find((fn) => fn.name === "main");
  if (!main) throw new Error("Expected main");
  const statements = requireBody(main.body).statements;
  const local = statements[1];
  if (local.kind !== "VarDeclStmt") throw new Error("Expected local declaration");
  if (local.initializer.kind !== "MethodCallExpr") throw new Error("Expected method call");
  if (local.initializer.method !== "lengthSquared") throw new Error("Expected method name");
});

Deno.test("parses defer statements", () => {
  const program = parse(
    lex(
      `function cleanup(): void { return; } function main(): i32 { defer cleanup(); return 42; }`,
    ),
  );
  const statement = program.functions[1].body?.statements[0];
  if (statement?.kind !== "DeferStmt") throw new Error("Expected defer statement");
});

Deno.test("parses generic class declarations and type refs", () => {
  const program = parse(
    lex(
      `class Box<T> { value: T; } function main(): i32 { const box: Box<i32> = { value: 42 }; return 0; }`,
    ),
  );
  const classDecl = program.typeAliases.find((typeAlias) => typeAlias.name === "Box_i32");
  if (!classDecl) throw new Error("Expected instantiated class type alias");
  const main = program.functions[0];
  const statement = main.body?.statements[0];
  if (statement?.kind !== "VarDeclStmt" || statement.type.kind !== "NamedTypeRef") {
    throw new Error("Expected generic class local type");
  }
  if (statement.type.name !== "Box_i32") throw new Error("Expected instantiated class type");
});

Deno.test("parses generic function declarations and calls", () => {
  const program = parse(
    lex(
      `function identity<T>(value: T): T { return value; } function main(): i32 { return identity<i32>(42); }`,
    ),
  );
  const fn = program.functions[0];
  if ((fn.genericParams ?? []).length !== 1) throw new Error("Expected generic parameter");
  const main = program.functions[1];
  const statement = main.body?.statements[0];
  if (statement?.kind !== "ReturnStmt" || statement.expression?.kind !== "CallExpr") {
    throw new Error("Expected generic call");
  }
  if ((statement.expression.typeArgs ?? []).length !== 1) throw new Error("Expected type argument");
});

Deno.test("parses class implements declarations", () => {
  const program = parseCast(
    lex(
      `interface Drawable { draw(): void; } class Ship implements Drawable { draw(): void { return; } } function main(): i32 { return 0; }`,
    ),
  );

  const classes = program.classes ?? [];
  if (classes.length !== 1) throw new Error("Expected class declaration");
  if ((classes[0].implements ?? []).length !== 1) throw new Error("Expected implemented interface");
});

Deno.test("parses interface declarations", () => {
  const program = parse(
    lex(
      `interface Drawable { draw(): void; move(dx: f64, dy: f64): void; } function main(): i32 { return 0; }`,
    ),
  );
  const interfaces = program.interfaces ?? [];
  if (interfaces.length !== 1) throw new Error("Expected interface declaration");
  if (interfaces[0].name !== "Drawable") throw new Error("Expected interface name");
  if (interfaces[0].methods.length !== 2) throw new Error("Expected interface methods");
  if (interfaces[0].methods[1].params.length !== 2) throw new Error("Expected method params");
});

Deno.test("parses tagged union declarations", () => {
  const program = parse(lex(`union MaybeI32 { Some: i32; None; }`));
  const unionDecl = program.taggedUnions?.[0];
  if (unionDecl?.name !== "MaybeI32") throw new Error("Expected tagged union declaration");
  if (unionDecl.variants.length !== 2) throw new Error("Expected tagged union variants");
});

Deno.test("parses enum declarations", () => {
  const program = parse(lex(`enum Key { Space = 32, Escape } function main(): i32 { return 0; }`));
  if ((program.enums ?? []).length !== 1) throw new Error("Expected enum declaration");
  if (program.enums?.[0]?.members.length !== 2) throw new Error("Expected enum members");
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
  const program = parse(
    lex(`function f(a: i32*, b: i32&, c: i32[], d: i32[16]): void { return; }`),
  );
  const types = program.functions[0].params.map((param) => typeName(param.type));
  assertEqualText(types, ["i32*", "i32&", "i32[]", "i32[16]"]);
});

Deno.test("parses canonical pointer reference and array type syntax", () => {
  const program = parse(
    lex(
      `function f(a: Ptr<i32>, b: Ref<i32>, c: Array<i32>, d: Array<i32, 16>, e: Slice<i32>): void { return; }`,
    ),
  );
  const types = program.functions[0].params.map((param) => typeName(param.type));
  assertEqualText(types, ["i32*", "i32&", "i32[]", "i32[16]", "Slice<i32>"]);
});

Deno.test("parses postfix pointer expressions", () => {
  const program = parse(lex(`function f(p: i32*): i32 { return p.*; }`));
  const statement = requireBody(program.functions[0].body).statements[0];
  if (statement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (!statement.expression || statement.expression.kind !== "PostfixPointerExpr") {
    throw new Error("Expected postfix pointer expression");
  }
  if (statement.expression.operator !== ".*") throw new Error("Expected .* operator");
});

Deno.test("parses array literals and indexing", () => {
  const program = parse(lex(`function main(): i32 { const xs: i32[] = [1, 2, 3]; return xs[0]; }`));
  const returnStatement = requireBody(program.functions[0].body).statements[1];
  if (returnStatement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (!returnStatement.expression || returnStatement.expression.kind !== "IndexExpr") {
    throw new Error("Expected index expression");
  }
});

Deno.test("parses while and assignment statements", () => {
  const program = parse(
    lex(`function main(): i32 { let x: i32 = 0; while (x < 3) { x = x + 1; } return x; }`),
  );
  const statement = requireBody(program.functions[0].body).statements[1];
  if (statement.kind !== "WhileStmt") throw new Error("Expected while statement");
});

Deno.test("parses bool literals", () => {
  const program = parse(lex(`function flag(): bool { return true; }`));
  const statement = requireBody(program.functions[0].body).statements[0];
  if (statement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (!statement.expression || statement.expression.kind !== "BoolLiteral") {
    throw new Error("Expected bool literal");
  }
});

Deno.test("parses string literals", () => {
  const program = parse(
    lex(`extern function puts(s: u8*): i32; function main(): i32 { return puts("hello"); }`),
  );
  const statement = requireBody(program.functions[1].body).statements[0];
  if (statement.kind !== "ReturnStmt" || statement.expression?.kind !== "CallExpr") {
    throw new Error("Expected call return");
  }
  if (statement.expression.args[0]?.kind !== "StringLiteral") {
    throw new Error("Expected string literal argument");
  }
});

Deno.test("parses expression statements", () => {
  const program = parse(
    lex(`extern function tick(): void; function main(): i32 { tick(); return 0; }`),
  );
  const statement = requireBody(program.functions[1].body).statements[0];
  if (statement.kind !== "ExpressionStmt" || statement.expression.kind !== "CallExpr") {
    throw new Error("Expected call expression statement");
  }
});

Deno.test("rejects out-of-range float literals", () => {
  const huge = `1${"0".repeat(400)}.0`;
  assertParseError(
    `function value(): f64 { return ${huge}; }`,
    `Float literal '${huge}' is out of range for 'f64'`,
  );
});

Deno.test("parses bare returns", () => {
  const program = parse(lex(`function done(): void { return; }`));
  const statement = requireBody(program.functions[0].body).statements[0];
  if (statement.kind !== "ReturnStmt") throw new Error("Expected return statement");
  if (statement.expression) throw new Error("Expected bare return");
});

Deno.test("parses switch statements", () => {
  const program = parse(
    lex(`function main(): i32 { switch (1) { case 0: return 0; default: return 1; } }`),
  );
  const statement = requireBody(program.functions[0].body).statements[0];
  if (statement.kind !== "SwitchStmt") throw new Error("Expected switch statement");
});

Deno.test("rejects duplicate default cases", () => {
  assertParseError(
    `function main(): i32 { switch (1) { default: return 0; default: return 1; } }`,
    "Duplicate default case",
  );
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
    if (
      error instanceof TypeCError &&
      error.diagnostics.some((diagnostic) => diagnostic.message === message)
    ) return;
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
