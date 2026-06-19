import { printAst } from "core/ast_printer.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";

type Str = string;

Deno.test("prints normalized AST", () => {
  const source = `function add(a: i32, b: i32): i32 { const x: i32 = a + b; return x; }`;
  const text = printAst(parse(lex(source)));
  assertIncludes(text, "FunctionDecl add -> i32");
  assertIncludes(text, "Param a: i32");
  assertIncludes(text, "Const x: i32");
  assertIncludes(text, "BinaryExpr +");
});

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}
