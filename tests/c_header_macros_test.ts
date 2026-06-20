import { collectHeaderMacroConstants } from "c/header/macros.ts";

type Str = string;
type usize = number;

Deno.test("collects safe object-like macro constants", () => {
  const constants = collectHeaderMacroConstants(
    `
#define WIDTH 800
#define HEIGHT (600u)
#define SCALE 2.5f
#define SUM (1 + 2)
#define MIXED (1u + 2u)
#define HEX (0x10 + 2)
#define EXP 1e3
#define BAD_BIG_EXP 1e100
#define BAD_IDENT (WIDTH + 2)
#define BAD_CALL(x) (x)
#define i32 1
#define TEXT "hi"
`,
    "/project/include/config.h",
  );

  assertSame(constants.length, 7);
  assertConstant(constants[0], "WIDTH", "i32", "800");
  assertConstant(constants[1], "HEIGHT", "u32", "600");
  assertConstant(constants[2], "SCALE", "f64", "2.5");
  assertConstant(constants[3], "SUM", "i32", "1 + 2");
  assertConstant(constants[4], "MIXED", "u32", "1 + 2");
  assertConstant(constants[5], "HEX", "i32", "16 + 2");
  assertConstant(constants[6], "EXP", "f64", "1000.0");
});

function assertConstant(
  constant: { name: Str; type: Str; value: Str },
  name: Str,
  type: Str,
  value: Str,
): void {
  if (constant.name !== name || constant.type !== type || constant.value !== value) {
    throw new Error(`Expected ${name}: ${type} = ${value}`);
  }
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
