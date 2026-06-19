import type { Diagnostic, SourceSpan } from "../diagnostics.ts";
import type { TypeName } from "../tast.ts";

type Str = string;

export function checkWhileCondition(type: TypeName, span: SourceSpan): Diagnostic[] {
  return checkBoolCondition(type, "While", span);
}

export function checkIfCondition(type: TypeName, span: SourceSpan): Diagnostic[] {
  return checkBoolCondition(type, "If", span);
}

function checkBoolCondition(type: TypeName, label: Str, span: SourceSpan): Diagnostic[] {
  if (type === "bool") return [];
  return [{ message: `${label} condition type '${type}' is not assignable to 'bool'`, span }];
}
