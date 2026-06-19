import type { Program } from "./ast.ts";

type Str = string;
type b8 = boolean;

export function hasMain(program: Program): b8 {
  return program.functions.some((fn) => fn.name === "main" && !fn.external);
}

export function missingMainMessage(): Str {
  return "Program entrypoint 'main' not found";
}
