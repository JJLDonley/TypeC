import type { CHeaderFunction } from "c/header/ast.ts";
import { isIncludedHeaderFunction, isSupportedHeaderFunction } from "c/header/support.ts";

type Str = string;
type b8 = boolean;

Deno.test("classifies included header functions", () => {
  assertSame(
    isIncludedHeaderFunction(fn("inside", "/project/include/math.h"), "/project/include"),
    true,
  );
  assertSame(
    isIncludedHeaderFunction(fn("outside", "/usr/include/math.h"), "/project/include"),
    false,
  );
  assertSame(isIncludedHeaderFunction(fn("unknown", null), "/project/include"), false);
  assertSame(isIncludedHeaderFunction(fn("any", null), null), true);
});

Deno.test("classifies supported header functions", () => {
  assertSame(isSupportedHeaderFunction(fn("add", "/project/header.h")), true);
  assertSame(
    isSupportedHeaderFunction(
      fn("log", "/project/header.h", "int32_t (const char *, ...)", [{
        name: "format",
        type: "const char *",
      }]),
    ),
    false,
  );
  assertSame(isSupportedHeaderFunction(fn("old", "/project/header.h", "void ()")), false);
  assertSame(
    isSupportedHeaderFunction(
      fn("callback", "/project/header.h", "void (int32_t (*)(int32_t))", [{
        name: "callback",
        type: "int32_t (*)(int32_t)",
      }]),
    ),
    false,
  );
  assertSame(
    isSupportedHeaderFunction(
      fn("array_return", "/project/header.h", "int32_t[4] (void)", [], null, false, "int32_t[4]"),
    ),
    false,
  );
  assertSame(
    isSupportedHeaderFunction(fn("helper", "/project/header.h", "int32_t (void)", [], "static")),
    false,
  );
  assertSame(
    isSupportedHeaderFunction(fn("defined", "/project/header.h", "int32_t (void)", [], null, true)),
    false,
  );
  assertSame(isSupportedHeaderFunction(fn("export", "/project/header.h")), false);
});

function fn(
  name: Str,
  sourceFile: Str | null,
  functionType: Str = "int32_t (void)",
  params: CHeaderFunction["params"] = [],
  storageClass: Str | null = null,
  hasBody: b8 = false,
  returnType: Str = "int32_t",
): CHeaderFunction {
  return { name, functionType, returnType, params, sourceFile, storageClass, hasBody };
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
