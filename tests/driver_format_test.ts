import { formatSourceFile, sourceFileIsFormatted } from "driver/format.ts";

type Str = string;

Deno.test("formats source files", async () => {
  const path = await tempTypeCFile("function main():i32{return 0;}");
  const changed = await formatSourceFile(path);
  const formatted = await Deno.readTextFile(path);
  if (!changed) throw new Error("Expected formatter changes");
  assertText(formatted, "function main(): i32 {\n  return 0;\n}\n");
  await Deno.remove(path);
});

Deno.test("does not rewrite formatted source files", async () => {
  const path = await tempTypeCFile("function main(): i32 {\n  return 0;\n}\n");
  const changed = await formatSourceFile(path);
  const formatted = await Deno.readTextFile(path);
  if (changed) throw new Error("Expected no formatter changes");
  assertText(formatted, "function main(): i32 {\n  return 0;\n}\n");
  await Deno.remove(path);
});

Deno.test("checks formatted source files without writing", async () => {
  const path = await tempTypeCFile("function main():i32{return 0;}");
  const ok = await sourceFileIsFormatted(path);
  const unchanged = await Deno.readTextFile(path);
  if (ok) throw new Error("Expected unformatted source");
  assertText(unchanged, "function main():i32{return 0;}");
  await Deno.remove(path);
});

async function tempTypeCFile(source: Str): Promise<Str> {
  const path = await Deno.makeTempFile({ suffix: ".tc" });
  await Deno.writeTextFile(path, source);
  return path;
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
