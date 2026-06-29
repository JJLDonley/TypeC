import { formatTypeCSource } from "formatter";

type Str = string;

Deno.test("formats TypeC declarations and statements", () => {
  assertText(
    formatTypeCSource(
      `function main( ):i32{const value:i32=1+2;if(value>0){return value;}return 0;}`,
    ),
    `function main(): i32 {
  const value: i32 = 1 + 2;
  if (value > 0) {
    return value;
  }
  return 0;
}
`,
  );
});

Deno.test("preserves line and block comments", () => {
  assertText(
    formatTypeCSource(`// file\nfunction main():i32{/* keep */return 0;}`),
    `// file
function main(): i32 {
  /* keep */
  return 0;
}
`,
  );
});

Deno.test("formats idempotently", () => {
  const source = `function main(): i32 {
  return 0;
}
`;
  assertText(formatTypeCSource(formatTypeCSource(source)), source);
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected:\n${expected}\nActual:\n${actual}`);
}
