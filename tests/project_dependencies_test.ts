import { TypeCError } from "core/diagnostics.ts";
import { readProjectDependencies } from "project/dependencies.ts";

type Str = string;

Deno.test("reads project dependencies", () => {
  const dependencies = readProjectDependencies({
    "basic/math": "std/math.tc",
    raylib: "vendor/raylib.h",
  });
  assertSame(dependencies.get("basic/math"), "std/math.tc");
  assertSame(dependencies.get("raylib"), "vendor/raylib.h");
});

Deno.test("rejects invalid project dependencies", () => {
  assertDependencyError("bad", "project.json dependencies must be an object", "E2903");
  assertDependencyError(
    { "basic/math.tc": "std/math.tc" },
    "Dependency alias 'basic/math.tc' must not include a file extension",
    "E2904",
  );
  assertDependencyError(
    { "basic/%2e/math": "std/math.tc" },
    "Dependency alias 'basic/%2e/math' must be a project dependency import path",
    "E2904",
  );
  assertDependencyError(
    { "basic/math": 1 },
    "Dependency 'basic/math' must map to a string path",
    "E2905",
  );
  assertDependencyError(
    { "basic/math": "std/math" },
    "Dependency 'basic/math' target must be a .tc or .h file",
    "E2905",
  );
  assertDependencyError(
    { "basic/math": "vendor%2fmath.tc" },
    "Dependency 'basic/math' target must be a local dependency path",
    "E2905",
  );
  assertDependencyError(
    { "basic/math": "../math.tc" },
    "Dependency 'basic/math' target must stay within the project",
    "E2905",
  );
});

function assertDependencyError(value: unknown, message: Str, code: Str): void {
  try {
    readProjectDependencies(value);
  } catch (error) {
    if (
      error instanceof TypeCError &&
      error.diagnostics.some((diagnostic) =>
        diagnostic.message === message && diagnostic.code === code
      )
    ) return;
  }
  throw new Error(`Expected dependency error: ${message}`);
}

function assertSame(actual: Str | undefined, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
