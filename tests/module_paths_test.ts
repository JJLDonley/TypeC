import { canonicalModulePath, isCHeaderPath, resolveModuleImportPath } from "../src/module_paths.ts";
import type { ProjectConfig } from "../src/project_config.ts";
import { TypeCError } from "../src/diagnostics.ts";

type Str = string;
type b8 = boolean;

Deno.test("resolves relative module imports", () => {
  const config = projectConfig("/project", []);
  assertText(resolveModuleImportPath("/project/src/main.tc", "./math.tc", config), "/project/src/math.tc");
  assertText(resolveModuleImportPath("/project/src/main.tc", "../math.tc", config), "/project/math.tc");
});

Deno.test("resolves project dependency module imports", () => {
  const config = projectConfig("/project", [["basic/math", "vendor/math.tc"], ["abs/math", "/opt/math.tc"]]);
  assertText(resolveModuleImportPath("/project/src/main.tc", "basic/math", config), "/project/vendor/math.tc");
  assertText(resolveModuleImportPath("/project/src/main.tc", "abs/math", config), "/opt/math.tc");
});

Deno.test("resolves std module imports", () => {
  const config = projectConfig("/project", [["basic/math", "std/math.tc"]]);
  assertSame(resolveModuleImportPath("/project/src/main.tc", "std/math.tc", config).endsWith("/std/math.tc"), true);
  assertSame(resolveModuleImportPath("/project/src/main.tc", "basic/math", config).endsWith("/std/math.tc"), true);
});

Deno.test("classifies C header paths", () => {
  assertSame(isCHeaderPath("math.h"), true);
  assertSame(isCHeaderPath("math.tc"), false);
});

Deno.test("reports missing canonical module paths", async () => {
  try {
    await canonicalModulePath("/definitely/missing/typec/module.tc");
  } catch (error) {
    if (error instanceof TypeCError && error.diagnostics[0]?.message === "Module not found '/definitely/missing/typec/module.tc'") return;
    throw error;
  }
  throw new Error("Expected missing module error");
});

function projectConfig(projectDir: Str, dependencies: [Str, Str][]): ProjectConfig {
  return { projectDir, dependencies: new Map<Str, Str>(dependencies), compilerFlags: [] };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSame(actual: b8, expected: b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
