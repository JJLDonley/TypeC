type Str = string;
type i32 = number;

type CommandResult = {
  code: i32;
  stdout: Str;
  stderr: Str;
};

Deno.test("CLI formats multiple source files", async () => {
  const first = await tempSource("function one():i32{return 1;}");
  const second = await tempSource("function two():i32{return 2;}");
  const result = await runTypeC(["fmt", first, second]);

  assertSame(result.code, 0);
  assertText(await Deno.readTextFile(first), "function one(): i32 {\n  return 1;\n}\n");
  assertText(await Deno.readTextFile(second), "function two(): i32 {\n  return 2;\n}\n");
});

Deno.test("CLI does not rewrite unsupported syntax", async () => {
  const source = "function main(: i32 {";
  const path = await tempSource(source);
  const result = await runTypeC(["fmt", path]);

  assertSame(result.code, 1);
  assertText(await Deno.readTextFile(path), source);
});

Deno.test("CLI emits C header externs to stdout", async () => {
  const header = await tempHeader("#define KEY_A 65\nint add_i32(int left, int right);\n");
  const result = await runTypeC(["emit-externs", header]);

  assertSame(result.code, 0);
  assertIncludes(result.stdout, "export const KEY_A: i32 = 65;");
  assertIncludes(result.stdout, "extern function add_i32(left: c_int, right: c_int): c_int;");
});

Deno.test("CLI writes C header externs to TypeC file", async () => {
  const header = await tempHeader("#define LIMIT 4\n");
  const outputPath = await Deno.makeTempFile({ suffix: ".tc" });
  const result = await runTypeC(["emit-externs", header, "-o", outputPath]);

  assertSame(result.code, 0);
  assertIncludes(result.stdout, `Wrote ${outputPath}`);
  assertIncludes(await Deno.readTextFile(outputPath), "export const LIMIT: i32 = 4;");
});

Deno.test("CLI invalid arguments exit with failure", async () => {
  const result = await runTypeC(["build"]);

  assertSame(result.code, 1);
  assertIncludes(result.stderr, "Error: missing source file");
  assertIncludes(result.stderr, "Usage:");
});

async function tempSource(source: Str): Promise<Str> {
  const path = await Deno.makeTempFile({ suffix: ".tc" });
  await Deno.writeTextFile(path, source);
  return path;
}

async function tempHeader(source: Str): Promise<Str> {
  const path = await Deno.makeTempFile({ suffix: ".h" });
  await Deno.writeTextFile(path, source);
  return path;
}

async function runTypeC(args: Str[]): Promise<CommandResult> {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", "src/driver/main.ts", ...args],
  }).output();
  return {
    code: output.code,
    stdout: decode(output.stdout),
    stderr: decode(output.stderr),
  };
}

function decode(bytes: Uint8Array): Str {
  return new TextDecoder().decode(bytes);
}

function assertSame(actual: i32, expected: i32): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertIncludes(haystack: Str, needle: Str): void {
  if (!haystack.includes(needle)) throw new Error(`Expected output to include ${needle}`);
}
