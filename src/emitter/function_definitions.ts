import type { FunctionDecl } from "core/ast.ts";
import { emitCType } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitFunctionSignature } from "emitter/functions.ts";
import { emitStatement } from "emitter/statements.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;

export function emitFunctionDefinition(fn: FunctionDecl, context: EmitContext): Str {
  if (!fn.body) throw new Error("Function definition requires a body");
  const out: Str[] = [];
  out.push(`${emitFunctionSignature(fn, context)} {`);
  const locals = functionParamLocals(fn, context);
  for (const stmt of fn.body.statements) {
    out.push(`  ${emitStatement(stmt, functionReturnType(fn, context), context, locals)}`);
  }
  out.push("}");
  return out.join("\n");
}

function functionParamLocals(fn: FunctionDecl, context: EmitContext): Map<Str, Str> {
  return new Map<Str, Str>(
    fn.params.map((param) => [param.name, emitCTypeName(param.type, context.typeAliases)]),
  );
}

function functionReturnType(fn: FunctionDecl, context: EmitContext): Str {
  return emitCType(fn.returnType, context.typeAliases);
}
