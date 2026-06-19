import { loadProgram } from "../src/module_loader.ts";

type Str = string;

Deno.test("loads imported exports", async () => {
  const program = await loadProgram("examples/import_main.tc");
  assertIncludes(program.functions.map((fn) => fn.name), "add");
  assertIncludes(program.functions.map((fn) => fn.name), "main");
});

function assertIncludes(values: Str[], expected: Str): void {
  if (!values.includes(expected)) throw new Error(`Expected ${JSON.stringify(values)} to include ${expected}`);
}
