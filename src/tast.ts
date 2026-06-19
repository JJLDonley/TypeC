import type { ResolvedProgram } from "./rast.ts";

type Str = string;

export type TypeName = Str;

export interface ExpressionTypeInfo {
  type: TypeName;
}

export interface TypedProgram extends ResolvedProgram {
  expressionTypes: Map<Str, ExpressionTypeInfo>;
}
