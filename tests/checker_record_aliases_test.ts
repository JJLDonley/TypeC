import type { RecordTypeRef, TypeRef } from "core/ast.ts";
import type { SourceSpan } from "core/diagnostics.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";

type Str = string;

const span: SourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("looks up record aliases", () => {
  const aliases = new Map<Str, TypeRef>([["Vec2", record()], ["Scalar", named("i32")]]);

  assertSame(lookupRecordAlias("Vec2", aliases)?.kind ?? "", "RecordTypeRef");
  assertSame(lookupRecordAlias("Scalar", aliases), null);
  assertSame(lookupRecordAlias("Missing", aliases), null);
});

function record(): RecordTypeRef {
  return { kind: "RecordTypeRef", fields: [], span };
}

function named(name: Str): TypeRef {
  return { kind: "NamedTypeRef", name, span };
}

function assertSame<T>(actual: T, expected: T): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
