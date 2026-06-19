import { hasParentTraversal } from "paths/security.ts";

type b8 = boolean;

Deno.test("detects parent traversal through slash variants", () => {
  assertSame(hasParentTraversal("std/../math.tc"), true);
  assertSame(hasParentTraversal("std/..\\math.tc"), true);
  assertSame(hasParentTraversal("std/%2e%2e/math.tc"), true);
  assertSame(hasParentTraversal("std/..%5cmath.tc"), true);
  assertSame(hasParentTraversal("std/math.tc"), false);
});

Deno.test("treats malformed encoded paths as traversal", () => {
  assertSame(hasParentTraversal("std/%zz/math.tc"), true);
});

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
