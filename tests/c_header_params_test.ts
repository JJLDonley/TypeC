import { TypeCError } from "core/diagnostics.ts";
import { readHeaderParams } from "c/header/params.ts";

type Str = string;
type usize = number;

Deno.test("reads C header parameters", () => {
  const params = readHeaderParams([
    param("left", "int32_t"),
    param("right", "int32_t"),
    { kind: "CompoundStmt" },
  ]);

  assertSame(params.length, 2);
  assertText(params[0]?.name ?? "", "left");
  assertText(params[1]?.type ?? "", "int32_t");
});

Deno.test("sanitizes and deduplicates C header parameters", () => {
  const params = readHeaderParams([
    param("export", "int32_t"),
    param("export", "int32_t"),
    param("", "int32_t"),
  ]);

  assertText(params[0]?.name ?? "", "arg_export");
  assertText(params[1]?.name ?? "", "arg_export_1");
  assertText(params[2]?.name ?? "", "arg2");
});

Deno.test("rejects malformed C header parameters", () => {
  assertParamError([{ kind: "ParmVarDecl" }], "Parameter has no type");
  assertParamError([{ kind: "ParmVarDecl", type: {} }], "Parameter has no type");
});

function param(name: Str, type: Str): unknown {
  return { kind: "ParmVarDecl", name, type: { qualType: type } };
}

function assertParamError(value: unknown, message: Str): void {
  try {
    readHeaderParams(value);
  } catch (error) {
    if (
      error instanceof TypeCError && error.diagnostics[0]?.message === message &&
      error.diagnostics[0]?.code === "E2805"
    ) return;
    throw error;
  }
  throw new Error(`Expected ${message}`);
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
