import type { FunctionDecl } from "core/ast.ts";
import { emitCParamDeclarator, emitCType } from "c/type.ts";

type Str = string;

export function emitFunctionPrototype(fn: FunctionDecl): Str {
  return `${emitFunctionSignature(fn)};`;
}

export function emitFunctionSignature(fn: FunctionDecl): Str {
  return `${emitFunctionStorage(fn)}${emitCType(fn.returnType)} ${fn.name}(${emitParams(fn)})`;
}

function emitFunctionStorage(fn: FunctionDecl): Str {
  if (fn.external || fn.exported || fn.name === "main") return "";
  return "static ";
}

function emitParams(fn: FunctionDecl): Str {
  if (fn.params.length === 0) return "void";
  return fn.params.map((param) => emitCParamDeclarator(param.type, param.name)).join(", ");
}
