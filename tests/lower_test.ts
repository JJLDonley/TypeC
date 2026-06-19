import { printAst } from "../src/ast_printer.ts";
import { lex } from "../src/lexer.ts";
import { lowerCast } from "../src/lower.ts";
import { parseCast } from "../src/parser.ts";

type Str = string;

Deno.test("lowers CAST to AST", () => {
  const ast = lowerCast(parseCast(lex(`function main(): i32 { return 0; }`)));
  assertIncludes(printAst(ast), "FunctionDecl main -> i32");
});

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}
