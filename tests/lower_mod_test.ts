import { lowerCast, lowerTypeRef } from "lower";
import type { CastProgram, CastTypeRef } from "core/cast.ts";
import type { SourcePos, SourceSpan } from "core/diagnostics.ts";

type Str = string;
type usize = number;

Deno.test("exports lower public helpers", () => {
  assertText(typeof lowerCast, "function");
  const type = lowerTypeRef(namedType("i32"));
  if (type.kind !== "NamedTypeRef") throw new Error(`Expected NamedTypeRef, got ${type.kind}`);
  assertText(type.name, "i32");
});

Deno.test("exports lower entrypoint", () => {
  const program = lowerCast(emptyCastProgram());
  assertText(program.kind, "Program");
});

function emptyCastProgram(): CastProgram {
  return { kind: "Program", imports: [], typeAliases: [], functions: [], span: span() };
}

function namedType(name: Str): CastTypeRef {
  return { kind: "NamedTypeRef", name, span: span() };
}

function span(): SourceSpan {
  return { start: sourcePos(0), end: sourcePos(0) };
}

function sourcePos(offset: usize): SourcePos {
  return { offset, line: 1, column: offset + 1 };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
