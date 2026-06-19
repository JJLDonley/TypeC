import { parseCliArgs, usageText } from "../src/cli.ts";

type Str = string;

Deno.test("parses valid CLI request", () => {
  const request = parseCliArgs(["build", "examples/main.tc"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "build");
  assertEquals(request.inputPath, "examples/main.tc");
});

Deno.test("rejects invalid CLI request", () => {
  if (parseCliArgs(["bad", "examples/main.tc"]) !== null) throw new Error("Expected invalid command");
  if (parseCliArgs(["build"]) !== null) throw new Error("Expected missing input");
});

Deno.test("prints usage", () => {
  assertEquals(usageText(), "Usage: deno run -A src/main.ts <build|run|emit-c|emit-ast|watch> <file.tc>");
});

function assertEquals(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
