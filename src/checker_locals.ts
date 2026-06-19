import type { FunctionDecl } from "./ast.ts";
import type { TypeName } from "./tast.ts";
import { typeName } from "./type_ref.ts";

type Str = string;
type b8 = boolean;

export interface LocalInfo {
  type: TypeName;
  mutable: b8;
}

export function createFunctionLocals(fn: FunctionDecl): Map<Str, LocalInfo> {
  const locals = new Map<Str, LocalInfo>();
  for (const param of fn.params) locals.set(param.name, { type: typeName(param.type), mutable: false });
  return locals;
}
