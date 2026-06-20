import type { CheckedProgram } from "checker";
import { emitCPrelude } from "c/prelude.ts";
import { createEmitContext } from "emitter/context.ts";
import { emitFunctionDefinition } from "emitter/function_definitions.ts";
import { collectFunctionPrototypes } from "emitter/function_prototypes.ts";
import { collectEmittedTypeAliases } from "emitter/type_alias_collection.ts";

type Str = string;

export function emitC(program: CheckedProgram): Str {
  const out: Str[] = [];
  const context = createEmitContext(program);
  out.push(...emitCPrelude());
  for (const typeAlias of collectEmittedTypeAliases(program.typeAliases, context)) {
    out.push(typeAlias.text);
    out.push("");
  }
  out.push(...collectFunctionPrototypes(program.functions.filter((fn) => fn.external), context));
  out.push(...collectFunctionPrototypes(program.functions.filter((fn) => !fn.external), context));
  out.push("");
  for (const fn of program.functions.filter((fn) => fn.body)) {
    out.push(emitFunctionDefinition(fn, context));
    out.push("");
  }
  return out.join("\n");
}
