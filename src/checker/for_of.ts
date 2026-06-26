import type { Statement } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { parseArrayTypeName, parseSliceTypeName } from "checker/type_name_shapes.ts";

export type Str = string;

type ForOfStmt = Extract<Statement, { kind: "ForOfStmt" }>;

export interface ForOfIterableInfo {
  elementType: TypeName;
  diagnostics: Diagnostic[];
}

export function checkForOfIterable(stmt: ForOfStmt, iterableType: TypeName): ForOfIterableInfo {
  const elementType = forOfElementType(iterableType);
  if (elementType !== null) return { elementType, diagnostics: [] };
  return {
    elementType: "<error>",
    diagnostics: [{ message: "For-of iterable must be an array or slice", span: stmt.iterable.span }],
  };
}

function forOfElementType(iterableType: TypeName): TypeName | null {
  const array = parseArrayTypeName(iterableType);
  if (array !== null) return array.element;
  const slice = parseSliceTypeName(iterableType);
  if (slice !== null) return slice.element;
  return null;
}
