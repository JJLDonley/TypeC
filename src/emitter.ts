import type { FunctionDecl } from "./ast.ts";
import type { CheckedProgram } from "checker";
import { emitCPrelude } from "./c_prelude.ts";
import { emitCType } from "./c_type.ts";
import { createEmitContext, type EmitContext } from "./emitter_context.ts";
import { emitFunctionPrototype, emitFunctionSignature } from "./emitter_functions.ts";
import { emitStatement } from "./emitter_statements.ts";
import { emitTypeAlias } from "./emitter_type_aliases.ts";

type Str = string;

export function emitC(program: CheckedProgram): Str {
  const out: Str[] = [];
  const context = createEmitContext(program);
  out.push(...emitCPrelude());
  for (const typeAlias of program.typeAliases) {
    out.push(emitTypeAlias(typeAlias));
    out.push("");
  }
  for (const fn of program.functions.filter((fn) => fn.external)) out.push(emitFunctionPrototype(fn));
  for (const fn of program.functions.filter((fn) => !fn.external)) out.push(emitFunctionPrototype(fn));
  out.push("");
  for (const fn of program.functions.filter((fn) => fn.body)) {
    out.push(emitFunctionDefinition(fn, context));
    out.push("");
  }
  return out.join("\n");
}

function emitFunctionDefinition(fn: FunctionDecl, context: EmitContext): Str {
  if (!fn.body) throw new Error("Function definition requires a body");
  const out: Str[] = [];
  out.push(`${emitFunctionSignature(fn)} {`);
  for (const stmt of fn.body.statements) out.push(`  ${emitStatement(stmt, emitCType(fn.returnType), context)}`);
  out.push("}");
  return out.join("\n");
}


