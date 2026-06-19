import { collectImportRequests } from "../src/module_import_requests.ts";
import type { ProjectConfig } from "../src/project_config.ts";
import { lex } from "../src/lexer.ts";
import { parse } from "../src/parser.ts";

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
  assertText([...(requests[0]?.names ?? [])].join(","), "add,sub");
  assertSuffix(requests[1]?.path ?? "", "/std/math.tc");
  assertText([...(requests[1]?.names ?? [])].join(","), "max_i32");
});

function projectConfig(): ProjectConfig {
  return { projectDir: "/project", dependencies: new Map<Str, Str>([["basic/math", "std/math.tc"]]), compilerFlags: [] };
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
