import { TypeCError } from "../src/diagnostics.ts";
import { isDependencyImportPath, isStdImportPath, validateImportPath } from "../src/import_paths.ts";
import type { ProjectConfig } from "../src/project_config.ts";

type Str = string;
type b8 = boolean;

Deno.test("classifies import paths", () => {
  const config = projectConfig(new Map<Str, Str>([["basic/math", "std/math.tc"]]));
  assertSame(isStdImportPath("std/math.tc"), true);
  assertSame(isDependencyImportPath("basic/math", config), true);
  assertSame(isDependencyImportPath("basic/other", config), false);
});

Deno.test("validates accepted import paths", () => {
  const config = projectConfig(new Map<Str, Str>([["basic/math", "std/math.tc"]]));
  validateImportPath("./math.tc", undefined, config);
  validateImportPath("../math.h", undefined, config);
  validateImportPath("std/math.tc", undefined, config);
  validateImportPath("basic/math", undefined, config);
});

Deno.test("rejects invalid import paths", () => {
  const config = projectConfig(new Map<Str, Str>());
  assertImportError("math.tc", config, "Import path 'math.tc' must be relative, std, or a project dependency");
  assertImportError("./math", config, "Import path './math' must target a .tc or .h file");
  assertImportError("./math\\ops.tc", config, "Import path './math\\ops.tc' must use / separators");
  assertImportError("./math%2fops.tc", config, "Import path './math%2fops.tc' must use / separators");
  assertImportError("./math%zz.tc", config, "Import path './math%zz.tc' contains invalid percent encoding");
  assertImportError("./%2e/math.tc", config, "Import path './%2e/math.tc' must not contain encoded path segments");
  assertImportError("std/../math.tc", config, "Std import path 'std/../math.tc' must stay within std");
});

function projectConfig(dependencies: Map<Str, Str>): ProjectConfig {
  return { projectDir: "/project", dependencies, compilerFlags: [] };
}

function assertImportError(path: Str, config: ProjectConfig, message: Str): void {
  try {
    validateImportPath(path, undefined, config);
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics.some((diagnostic) => diagnostic.message === message)) return;
  }
  throw new Error(`Expected import path error: ${message}`);
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
