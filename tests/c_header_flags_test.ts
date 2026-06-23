import { headerCompilerFlags } from "c/header/flags.ts";

type Str = string;

Deno.test("selects flags relevant to header parsing", () => {
  assertSame(
    headerCompilerFlags(
      ["-Iinclude", "-DDEBUG", "-UNDEBUG", "-isystemvendor", "-Llib", "-lm"],
      "/project",
    ),
    [
      "-I/project/include",
      "-DDEBUG",
      "-UNDEBUG",
      "-isystem/project/vendor",
    ],
  );
});

Deno.test("preserves absolute and empty joined header paths", () => {
  assertSame(
    headerCompilerFlags(["-I/usr/include", "-I", "-isystem/opt/include", "-isystem"], "/project"),
    [
      "-I/usr/include",
      "-I",
      "-isystem/opt/include",
      "-isystem",
    ],
  );
});

function assertSame(actual: Str[], expected: Str[]): void {
  const actualText = actual.join("\n");
  const expectedText = expected.join("\n");
  if (actualText !== expectedText) throw new Error(`Expected ${expectedText}, got ${actualText}`);
}
