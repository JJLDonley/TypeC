import type { FunctionDecl } from "core/ast.ts";
import { emitCParamDeclarator, emitCType } from "c/type.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;

export function emitFunctionPrototype(fn: FunctionDecl, context: EmitContext): Str {
  return `${emitFunctionSignature(fn, context)};`;
}

export function emitFunctionSignature(fn: FunctionDecl, context: EmitContext): Str {
  return `${emitFunctionStorage(fn)}${emitCType(fn.returnType, context.typeAliases)} ${
    emitFunctionCName(fn)
  }(${emitParams(fn, context)})`;
}

function emitFunctionCName(fn: FunctionDecl): Str {
  return fn.cName ?? fn.name;
}

function emitFunctionStorage(fn: FunctionDecl): Str {
  if (fn.external || fn.exported || fn.name === "main") return "";
  return "static ";
}

function emitParams(fn: FunctionDecl, context: EmitContext): Str {
  const params = fn.params.map((param) =>
    emitCParamDeclarator(param.type, param.name, context.typeAliases)
  );
  if (fn.variadic === true) return [...params, "..."].join(", ");
  if (params.length === 0) return "void";
  return params.join(", ");
}
