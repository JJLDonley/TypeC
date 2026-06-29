import { parseSource, parseSourceFile } from "driver/syntax.ts";

type Str = string;
type usize = number;

Deno.test("parses source text", () => {
  const program = parseSource("function value(): i32 { return 1; }");
  assertSame(program.functions.length, 1);
});

Deno.test("parses source files", async () => {
  const path = await tempTypeCFile("function value(): i32 { return 1; }");
  const program = await parseSourceFile(path);
  assertSame(program.functions.length, 1);
  await Deno.remove(path);
});

async function tempTypeCFile(source: Str): Promise<Str> {
  const path = await Deno.makeTempFile({ suffix: ".tc" });
  await Deno.writeTextFile(path, source);
  return path;
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
