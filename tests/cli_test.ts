import { parseCliArgs, parseCliArgsDetailed, usageText } from "driver/cli.ts";

type Str = string;
type usize = number;

Deno.test("parses valid CLI request", () => {
  const request = parseCliArgs(["build", "examples/main.tc"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "build");
  assertEquals(request.inputPath ?? "", "examples/main.tc");
});

Deno.test("parses build directory option", () => {
  const request = parseCliArgs(["build", "examples/main.tc", "--build-dir", "out"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "build");
  assertEquals(request.inputPath ?? "", "examples/main.tc");
  assertEquals(request.buildDir ?? "", "out");
});

Deno.test("rejects empty build directory option", () => {
  const request = parseCliArgs(["build", "examples/main.tc", "--build-dir", ""]);
  if (request !== null) throw new Error("Expected invalid build directory option");
});

Deno.test("rejects non TypeC source inputs", () => {
  const request = parseCliArgs(["build", "examples/main.txt"]);
  if (request !== null) throw new Error("Expected invalid source extension");
});

Deno.test("parses clean CLI request", () => {
  const request = parseCliArgs(["clean", "examples/main.tc", "--build-dir", "out"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "clean");
  assertEquals(request.inputPath ?? "", "examples/main.tc");
  assertEquals(request.buildDir ?? "", "out");
});

Deno.test("parses syntax CLI request", () => {
  const request = parseCliArgs(["parse", "examples/main.tc"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "parse");
  assertEquals(request.inputPath ?? "", "examples/main.tc");
});

Deno.test("parses check CLI request", () => {
  const request = parseCliArgs(["check", "examples/main.tc"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "check");
  assertEquals(request.inputPath ?? "", "examples/main.tc");
});

Deno.test("parses formatter CLI request", () => {
  const request = parseCliArgs(["fmt", "examples/main.tc"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "fmt");
  assertEquals(request.inputPath ?? "", "examples/main.tc");
});

Deno.test("parses formatter CLI request with multiple paths", () => {
  const request = parseCliArgs(["fmt", "examples/main.tc", "examples/math.tc"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "fmt");
  assertTextList(request.inputPaths ?? [], ["examples/main.tc", "examples/math.tc"]);
});

Deno.test("parses formatter check CLI request", () => {
  const request = parseCliArgs(["fmt-check", "examples/main.tc", "examples/math.tc"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "fmt-check");
  assertEquals(request.inputPath ?? "", "examples/main.tc");
  assertTextList(request.inputPaths ?? [], ["examples/main.tc", "examples/math.tc"]);
});

Deno.test("parses C header extern emission CLI request", () => {
  const request = parseCliArgs(["emit-externs", "include/raylib.h", "-o", "raylib.tc"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "emit-externs");
  assertEquals(request.inputPath ?? "", "include/raylib.h");
  assertEquals(request.outputPath ?? "", "raylib.tc");
});

Deno.test("parses C header extern clang flags", () => {
  const request = parseCliArgs(["emit-externs", "include/raylib.h", "--", "-Iinclude"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "emit-externs");
  assertTextList(request.compilerFlags ?? [], ["-Iinclude"]);
});

Deno.test("parses version CLI request", () => {
  const request = parseCliArgs(["version"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "version");
  assertEquals(request.inputPath ?? "", "");
});

Deno.test("parses help CLI request", () => {
  const request = parseCliArgs(["help"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "help");
  assertEquals(request.inputPath ?? "", "");
});

Deno.test("parses standard help and version flags", () => {
  const help = parseCliArgs(["--help"]);
  const version = parseCliArgs(["--version"]);
  if (!help) throw new Error("Expected help request");
  if (!version) throw new Error("Expected version request");
  assertEquals(help.command, "help");
  assertEquals(version.command, "version");
});

Deno.test("parses watch build directory option", () => {
  const request = parseCliArgs(["watch", "examples/main.tc", "--build-dir", "out"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "watch");
  assertEquals(request.inputPath ?? "", "examples/main.tc");
  assertEquals(request.buildDir ?? "", "out");
});

Deno.test("parses LSP CLI request", () => {
  const request = parseCliArgs(["lsp"]);
  if (!request) throw new Error("Expected CLI request");
  assertEquals(request.command, "lsp");
  assertEquals(request.inputPath ?? "", "");
});

Deno.test("rejects invalid CLI request", () => {
  if (parseCliArgs(["bad", "examples/main.tc"]) !== null) {
    throw new Error("Expected invalid command");
  }
  if (parseCliArgs(["build"]) !== null) throw new Error("Expected missing input");
  if (parseCliArgs(["check", "examples/main.tc", "--build-dir", "out"]) !== null) {
    throw new Error("Expected invalid build directory option");
  }
  if (parseCliArgs(["fmt", "examples/main.tc", "README.md"]) !== null) {
    throw new Error("Expected invalid formatter source extension");
  }
  if (parseCliArgs(["--help", "examples/main.tc"]) !== null) {
    throw new Error("Expected invalid help flag input");
  }
  if (parseCliArgs(["emit-externs", "raylib.tc"]) !== null) {
    throw new Error("Expected invalid header extension");
  }
});

Deno.test("reports CLI parse error reasons", () => {
  assertParseError([], "missing command");
  assertParseError(["bad"], "unknown command");
  assertParseError(["help", "main.tc"], "command does not take a source file");
  assertParseError(["build"], "missing source file");
  assertParseError(["build", "main.txt"], "source file must end with .tc");
  assertParseError(["emit-externs", "raylib.tc"], "header file must end with .h");
  assertParseError(["emit-externs", "raylib.h", "-o", "raylib.h"], "output file must end with .tc");
  assertParseError(["build", "main.tc", "--build-dir", ""], "build directory must not be empty");
  assertParseError(
    ["check", "main.tc", "--build-dir", "out"],
    "build directory option is not accepted",
  );
  assertParseError(["run", "main.tc", "--bad", "out"], "invalid option");
});

Deno.test("prints usage", () => {
  assertEquals(
    usageText(),
    [
      "Usage:",
      "  STC build <file.tc> [--build-dir <dir>]",
      "  STC run <file.tc> [--build-dir <dir>]",
      "  STC clean <file.tc> [--build-dir <dir>]",
      "  STC watch <file.tc> [--build-dir <dir>]",
      "  STC check <file.tc>",
      "  STC parse <file.tc>",
      "  STC emit-c <file.tc>",
      "  STC emit-ast <file.tc>",
      "  STC emit-externs <header.h> [-o <file.tc>] [-- <clang flags...>]",
      "  STC fmt <paths...>",
      "  STC fmt-check <paths...>",
      "  STC lsp",
      "  STC version | --version",
      "  STC help | --help",
    ].join("\n"),
  );
});

function assertParseError(args: Str[], expected: Str): void {
  const result = parseCliArgsDetailed(args);
  assertEquals(result.error ?? "", expected);
}

function assertEquals(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertTextList(actual: Str[], expected: Str[]): void {
  if (actual.length !== expected.length) {
    throw new Error(`Expected ${expected.length}, got ${actual.length}`);
  }
  for (let index: usize = 0; index < expected.length; index += 1) {
    assertEquals(actual[index] ?? "", expected[index] ?? "");
  }
}
