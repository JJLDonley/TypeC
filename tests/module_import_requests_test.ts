import { collectImportRequests } from "module/import_requests.ts";
import type { ProjectConfig } from "project/config.ts";
import { lex } from "core/lexer.ts";
import { parse } from "parser";

type Str = string;
type usize = number;

Deno.test("collects merged import requests", () => {
  const program = parse(lex(`
    import { add } from "./math.tc";
    import { sub } from "./math.tc";
    import { max_i32 } from "basic/math";
  `));
  const requests = collectImportRequests("/project/main.tc", program, projectConfig());

  assertSame(requests.length, 2);
  assertText(requests[0]?.path ?? "", "/project/math.tc");
  assertText(formatNames([...(requests[0]?.names.values() ?? [])]), "add:add,sub:sub");
  assertSuffix(requests[1]?.path ?? "", "/std/math.tc");
  assertText(formatNames([...(requests[1]?.names.values() ?? [])]), "max_i32:max_i32");
});

Deno.test("collects aliased import requests", () => {
  const program = parse(lex(`
    import { add as plus } from "./math.tc";
  `));
  const requests = collectImportRequests("/project/main.tc", program, projectConfig());

  assertText(formatNames([...(requests[0]?.names.values() ?? [])]), "add:plus");
});

Deno.test("collects namespace import requests", () => {
  const program = parse(lex(`
    import * as Math from "basic/math";
    function main(): i32 { return Math.abs_i32(-1); }
  `));
  const requests = collectImportRequests("/project/main.tc", program, projectConfig());

  assertText([...(requests[0]?.namespaces.keys() ?? [])].join(","), "Math");
  assertText([...(requests[0]?.namespaces.get("Math") ?? [])].join(","), "abs_i32");
});

function projectConfig(): ProjectConfig {
  return {
    projectDir: "/project",
    dependencies: new Map<Str, Str>([["basic/math", "std/math.tc"]]),
    compilerFlags: [],
  };
}

function formatNames(names: { imported: Str; local: Str }[]): Str {
  return names.map((name) => `${name.imported}:${name.local}`).join(",");
}

function assertSame(actual: usize, expected: usize): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertSuffix(actual: Str, expected: Str): void {
  if (!actual.endsWith(expected)) throw new Error(`Expected ${actual} to end with ${expected}`);
}
