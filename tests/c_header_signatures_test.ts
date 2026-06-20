import type { CHeaderFunction } from "c/header/ast.ts";
import {
  headerFunctionTypeCSignature,
  unambiguousHeaderFunctions,
  uniqueHeaderFunctions,
} from "c/header/signatures.ts";

type Str = string;
type b8 = boolean;
type usize = number;

Deno.test("builds TypeC header signatures", () => {
  assertText(
    headerFunctionTypeCSignature(fn("add", "int32_t", ["int32_t", "int32_t"])) ?? "",
    "i32(i32,i32)",
  );
  assertText(headerFunctionTypeCSignature(fn("platform", "long", [])) ?? "", "c_long()");
  assertText(headerFunctionTypeCSignature(fn("bad", "__unsupported_t", [])) ?? "", "");
});

Deno.test("deduplicates equivalent array and pointer header signatures", () => {
  const functions = uniqueHeaderFunctions(unambiguousHeaderFunctions([
    fn("fill", "void", ["int32_t[4]"], "void (int32_t[4])"),
    fn("fill", "void", ["int32_t *"], "void (int32_t *)"),
  ]));

  assertSame(functions.length, 1);
});

Deno.test("deduplicates equivalent header signatures", () => {
  const functions = uniqueHeaderFunctions([
    fn("same", "int32_t", ["int32_t"], "int32_t (int32_t)"),
    fn("same", "__int32_t", ["__int32_t"], "__int32_t (__int32_t)"),
    fn("same", "int64_t", ["int64_t"], "int64_t (int64_t)"),
  ]);

  assertSame(functions.length, 2);
});

Deno.test("keeps only unambiguous header signatures", () => {
  const functions = unambiguousHeaderFunctions([
    fn("same", "int32_t", ["int32_t"]),
    fn("same", "int64_t", ["int64_t"]),
    fn("ok", "int32_t", ["int32_t"]),
    fn("skip", "__unsupported_t", ["__unsupported_t"]),
  ]);

  assertSame(functions.length, 1);
  assertText(functions[0]?.name ?? "", "ok");
});

function fn(
  name: Str,
  returnType: Str,
  paramTypes: Str[],
  functionType: Str | null = null,
): CHeaderFunction {
  return {
    name,
    functionType: functionType ?? `${returnType} (${paramTypes.join(", ")})`,
    returnType,
    params: paramTypes.map((type, index) => ({ name: `param${index}`, type })),
    sourceFile: "/project/header.h",
    storageClass: null,
    hasBody: false,
  };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame(actual: usize | b8, expected: usize | b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
