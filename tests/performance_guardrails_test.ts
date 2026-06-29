import { check } from "checker";
import {
  GENERIC_CONSTRAINT_UNSATISFIED,
  GENERIC_INSTANTIATION_CYCLE,
  IMPORT_CYCLE,
  TYPE_ALIAS_CYCLE,
} from "core/diagnostic_codes.ts";
import { TypeCError } from "core/diagnostics.ts";
import { instantiateGenerics } from "core/generics.ts";
import { lex } from "core/lexer.ts";
import { resolve } from "core/resolver.ts";
import { parse } from "parser";
import { loadProgram } from "module/loader.ts";

export type Str = string;
type b8 = boolean;
type usize = number;
type i32 = number;

const LARGE_PROGRAM_LIMIT_MS: i32 = 5_000;

type SourceCase = {
  source: Str;
  code: Str;
};

Deno.test("recursive type aliases fail with diagnostics", () => {
  assertSourceDiagnostic({
    source: `type A = B; type B = A; function main(): i32 { return 0; }`,
    code: TYPE_ALIAS_CYCLE,
  });
});

Deno.test("recursive generic instantiations fail with diagnostics", () => {
  assertSourceDiagnostic({
    source:
      `function loop<T>(value: T): i32 { return loop<i32>(1); } function main(): i32 { return loop<i32>(1); }`,
    code: GENERIC_INSTANTIATION_CYCLE,
  });
});

Deno.test("cyclic module projects fail with diagnostics", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.writeTextFile(
    `${dir}/a.tc`,
    `import { b } from "./b.tc"; export function a(): i32 { return b(); }`,
  );
  await Deno.writeTextFile(
    `${dir}/b.tc`,
    `import { a } from "./a.tc"; export function b(): i32 { return a(); }`,
  );
  try {
    await loadProgram(`${dir}/a.tc`);
  } catch (error) {
    if (error instanceof TypeCError && hasDiagnosticCode(error, IMPORT_CYCLE)) return;
    throw error;
  }
  throw new Error("Expected import cycle diagnostic");
});

Deno.test("record-shape recursion limit fails with diagnostics", () => {
  assertSourceDiagnostic({
    source: `${deepRecordTypes(72)} function take<T extends ${
      deepRecordConstraint(72)
    }>(value: T): i32 { return 0; } function main(): i32 { const value: Have0 = ${
      deepRecordValue(72)
    }; return take<Have0>(value); }`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
  });
});

Deno.test("large representative 0.1 program compiles within limit", () => {
  const started: i32 = Date.now();
  check(resolve(instantiateGenerics(parse(lex(largeValidProgram(180))))));
  assertWithinLimit(Date.now() - started, LARGE_PROGRAM_LIMIT_MS);
});

function assertWithinLimit(elapsedMs: i32, limitMs: i32): void {
  if (elapsedMs > limitMs) {
    throw new Error(`Expected compile time <= ${limitMs}ms, got ${elapsedMs}ms`);
  }
}

function assertSourceDiagnostic(testCase: SourceCase): void {
  try {
    check(resolve(instantiateGenerics(parse(lex(testCase.source)))));
  } catch (error) {
    if (error instanceof TypeCError && hasDiagnosticCode(error, testCase.code)) return;
    throw error;
  }
  throw new Error(`Expected diagnostic ${testCase.code}`);
}

function hasDiagnosticCode(error: TypeCError, code: Str): b8 {
  return error.diagnostics.some((diagnostic) => diagnostic.code === code);
}

function deepRecordTypes(depth: usize): Str {
  const declarations: Str[] = [];
  for (let index: usize = 0; index <= depth; index += 1) {
    declarations.push(`type Have${index} = ${haveShape(index, depth)};`);
  }
  return declarations.join("\n");
}

function deepRecordConstraint(depth: usize): Str {
  let constraint: Str = `{ value: i32; }`;
  for (let index: usize = 0; index < depth; index += 1) constraint = `{ next: ${constraint}; }`;
  return constraint;
}

function haveShape(index: usize, depth: usize): Str {
  if (index === depth) return `{ missing: i32; }`;
  return `{ next: Have${index + 1}; }`;
}

function deepRecordValue(depth: usize): Str {
  let value: Str = `{ missing: 1 }`;
  for (let index: usize = 0; index < depth; index += 1) value = `{ next: ${value} }`;
  return value;
}

function largeValidProgram(count: usize): Str {
  const functions: Str[] = [];
  for (let index: usize = 0; index < count; index += 1) {
    functions.push(`function f${index}(value: i32): i32 { return value + ${index}; }`);
  }
  return `${functions.join("\n")}\nfunction main(): i32 { return ${largeCallExpression(count)}; }`;
}

function largeCallExpression(count: usize): Str {
  let expression: Str = "0";
  for (let index: usize = 0; index < count; index += 1) expression = `f${index}(${expression})`;
  return expression;
}
