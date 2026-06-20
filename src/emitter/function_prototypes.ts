import type { FunctionDecl } from "core/ast.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitFunctionPrototype } from "emitter/functions.ts";

type Str = string;

export function collectFunctionPrototypes(functions: FunctionDecl[], context: EmitContext): Str[] {
  const emitted = new Set<Str>();
  const prototypes: Str[] = [];
  for (const fn of functions) collectFunctionPrototype(fn, context, emitted, prototypes);
  return prototypes;
}

function collectFunctionPrototype(
  fn: FunctionDecl,
  context: EmitContext,
  emitted: Set<Str>,
  prototypes: Str[],
): void {
  const prototype = emitFunctionPrototype(fn, context);
  if (emitted.has(prototype)) return;
  emitted.add(prototype);
  prototypes.push(prototype);
}
