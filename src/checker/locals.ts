import type { FunctionDecl } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;

export interface LocalInfo {
  type: TypeName;
  mutable: b8;
}

export function createFunctionLocals(fn: FunctionDecl): Map<Str, LocalInfo> {
  const locals = new Map<Str, LocalInfo>();
  for (const param of fn.params) {
    locals.set(param.name, { type: typeName(param.type), mutable: false });
  }
  return locals;
}
