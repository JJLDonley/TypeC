import { readHeaderFunction } from "../src/c_header_function.ts";

type Str = string;
type b8 = boolean;

Deno.test("reads C header function metadata", () => {
  const fn = readHeaderFunction({
    kind: "FunctionDecl",
    name: "add",
    type: { qualType: "int32_t (int32_t, int32_t)" },
    loc: { file: "/project/math.h" },
    storageClass: "extern",
    inner: [param("left", "int32_t"), param("right", "int32_t")],
  });

  assertText(fn?.name ?? "", "add");
  assertText(fn?.returnType ?? "", "int32_t");
  assertText(fn?.sourceFile ?? "", "/project/math.h");
  assertText(fn?.storageClass ?? "", "extern");
  assertSame(fn?.hasBody ?? true, false);
  assertText(fn?.params[0]?.name ?? "", "left");
});

Deno.test("reads included source files and function bodies", () => {
  const fn = readHeaderFunction({
    kind: "FunctionDecl",
    name: "defined",
    type: { qualType: "void (void)" },
    loc: { includedFrom: { file: "/project/header.h" } },
    inner: [{ kind: "CompoundStmt" }],
  });

  assertText(fn?.sourceFile ?? "", "/project/header.h");
  assertSame(fn?.hasBody ?? false, true);
});

Deno.test("skips malformed C header functions", () => {
  assertSame(readHeaderFunction({ kind: "FunctionDecl", name: "bad" }) === null, true);
  assertSame(readHeaderFunction({ kind: "FunctionDecl", name: "bad", type: { qualType: "not a function" } }) === null, true);
});

function param(name: Str, type: Str): unknown {
  return { kind: "ParmVarDecl", name, type: { qualType: type } };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
