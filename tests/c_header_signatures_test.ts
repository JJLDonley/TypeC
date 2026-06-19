import type { CHeaderFunction } from "../src/c_header_ast.ts";
import { headerFunctionTypeCSignature, unambiguousHeaderFunctions, uniqueHeaderFunctions } from "../src/c_header_signatures.ts";

type Str = string;
type b8 = boolean;
type usize = number;

Deno.test("builds TypeC header signatures", () => {
  assertText(headerFunctionTypeCSignature(fn("add", "int32_t", ["int32_t", "int32_t"])) ?? "", "i32(i32,i32)");
  assertText(headerFunctionTypeCSignature(fn("bad", "long", [])) ?? "", "");
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
    fn("skip", "long", ["long"]),
  ]);

  assertSame(functions.length, 1);
  assertText(functions[0]?.name ?? "", "ok");
});

function fn(name: Str, returnType: Str, paramTypes: Str[], functionType: Str | null = null): CHeaderFunction {
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
