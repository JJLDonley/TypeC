import type { Statement } from "core/ast.ts";

type Str = string;

type IncDecStmt = Extract<Statement, { kind: "IncDecStmt" }>;

export function emitIncDec(stmt: IncDecStmt): Str {
  return `${stmt.name}${stmt.operator};`;
}
