import type { AssignmentTarget, Expression } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import type { LocalInfo } from "checker/locals.ts";

type Str = string;
type b8 = boolean;

export interface AssignmentTargetInfo {
  type: TypeName;
  mutable: b8;
  rootName: Str;
  wholeLocal: b8;
}

type LocalLookup = (name: Str) => LocalInfo | undefined;
type TypeResolver = (expr: Expression) => TypeName;

export function assignmentTargetInfo(
  target: AssignmentTarget,
  lookupLocal: LocalLookup,
  resolveType: TypeResolver,
): AssignmentTargetInfo | null {
  switch (target.kind) {
    case "IdentifierExpr":
      return identifierTargetInfo(target.name, lookupLocal);
    case "FieldAccessExpr":
      return nestedTargetInfo(target.operand, lookupLocal, resolveType, resolveType(target));
    case "IndexExpr":
      return nestedTargetInfo(target.operand, lookupLocal, resolveType, resolveType(target));
  }
}

function identifierTargetInfo(name: Str, lookupLocal: LocalLookup): AssignmentTargetInfo | null {
  const local = lookupLocal(name);
  if (!local) return null;
  return { type: local.type, mutable: local.mutable, rootName: name, wholeLocal: true };
}

function nestedTargetInfo(
  operand: Expression,
  lookupLocal: LocalLookup,
  resolveType: TypeResolver,
  type: TypeName,
): AssignmentTargetInfo | null {
  const root = assignmentRootInfo(operand, lookupLocal, resolveType);
  if (!root) return null;
  return { ...root, type, wholeLocal: false };
}

function assignmentRootInfo(
  expression: Expression,
  lookupLocal: LocalLookup,
  resolveType: TypeResolver,
): AssignmentTargetInfo | null {
  switch (expression.kind) {
    case "IdentifierExpr":
      return identifierTargetInfo(expression.name, lookupLocal);
    case "FieldAccessExpr":
      return nestedTargetInfo(
        expression.operand,
        lookupLocal,
        resolveType,
        resolveType(expression),
      );
    case "IndexExpr":
      return nestedTargetInfo(
        expression.operand,
        lookupLocal,
        resolveType,
        resolveType(expression),
      );
    default:
      return null;
  }
}
