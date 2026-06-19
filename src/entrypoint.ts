import type { Program } from "./ast.ts";

type b8 = boolean;

export function hasMain(program: Program): b8 {
  return program.functions.some((fn) => fn.name === "main" && !fn.external);
}
