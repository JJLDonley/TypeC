import type { BlockStmt, Expression, FunctionDecl, Statement, TypeRef } from "core/ast.ts";
import { INFERRED_RETURN_BARE_MIX, INFERRED_RETURN_TYPE } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { normalizeInferredLocalType } from "checker/inferred_local_types.ts";
import { isAssignable } from "checker/types.ts";

export type Str = string;
type b8 = boolean;

type ReturnTypeResolver = (expr: Expression) => TypeName;

interface ReturnEntry {
  expression: Expression | null;
  span: FunctionDecl["span"];
}

export interface FunctionReturnInference {
  diagnostics: Diagnostic[];
  inferred: b8;
  type: TypeRef;
  typeName: TypeName;
}

export function isInferredFunctionReturn(fn: FunctionDecl): b8 {
  return fn.returnType.kind === "NamedTypeRef" && fn.returnType.name === "<infer>";
}

export function inferFunctionReturnType(
  fn: FunctionDecl,
  resolveType: ReturnTypeResolver,
): FunctionReturnInference {
  if (!isInferredFunctionReturn(fn)) {
    return { diagnostics: [], inferred: false, type: fn.returnType, typeName: "<error>" };
  }
  const inferred = inferBlockReturnType(fn.body, resolveType);
  const type = typeRefFromInferredType(inferred.typeName, fn);
  return { diagnostics: inferred.diagnostics, inferred: true, type, typeName: inferred.typeName };
}

function inferBlockReturnType(
  body: BlockStmt | null,
  resolveType: ReturnTypeResolver,
): { diagnostics: Diagnostic[]; typeName: TypeName } {
  const returns = collectReturnExpressions(body);
  if (returns.length === 0) return { diagnostics: [], typeName: "void" };
  if (returns.every((entry) => entry.expression === null)) {
    return { diagnostics: [], typeName: "void" };
  }
  const first = returns.find((entry) => entry.expression !== null)?.expression ?? null;
  if (first === null) return { diagnostics: [], typeName: "void" };
  const expected = normalizeInferredLocalType(resolveType(first));
  const diagnostics = inferReturnDiagnostics(returns, expected, resolveType);
  return { diagnostics, typeName: diagnostics.length === 0 ? expected : "<error>" };
}

function inferReturnDiagnostics(
  returns: ReturnEntry[],
  expected: TypeName,
  resolveType: ReturnTypeResolver,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const entry of returns) {
    if (entry.expression === null) {
      diagnostics.push({
        message: `Cannot mix bare returns with inferred return type '${expected}'`,
        code: INFERRED_RETURN_BARE_MIX,
        span: entry.span,
      });
      continue;
    }
    const actual = normalizeInferredLocalType(resolveType(entry.expression));
    if (isAssignable(actual, expected)) continue;
    diagnostics.push({
      message: `Return type '${actual}' is not assignable to inferred return type '${expected}'`,
      code: INFERRED_RETURN_TYPE,
      span: entry.expression.span,
    });
  }
  return diagnostics;
}

function collectReturnExpressions(body: BlockStmt | null): ReturnEntry[] {
  if (body === null) return [];
  return body.statements.flatMap(collectStatementReturnExpressions);
}

function collectStatementReturnExpressions(stmt: Statement): ReturnEntry[] {
  switch (stmt.kind) {
    case "ReturnStmt":
      return [{ expression: stmt.expression, span: stmt.span }];
    case "SwitchStmt":
      return [
        ...stmt.cases.flatMap((switchCase) =>
          switchCase.statements.flatMap(collectStatementReturnExpressions)
        ),
        ...(stmt.defaultCase?.statements ?? []).flatMap(collectStatementReturnExpressions),
      ];
    case "WhileStmt":
    case "DoWhileStmt":
    case "ForOfStmt":
    case "ForInStmt":
      return stmt.body.statements.flatMap(collectStatementReturnExpressions);
    case "ForStmt":
      return stmt.body.statements.flatMap(collectStatementReturnExpressions);
    case "IfStmt":
      return [
        ...stmt.thenBody.statements.flatMap(collectStatementReturnExpressions),
        ...(stmt.elseBody?.statements ?? []).flatMap(collectStatementReturnExpressions),
      ];
    default:
      return [];
  }
}

function typeRefFromInferredType(type: TypeName, fn: FunctionDecl): TypeRef {
  return { kind: "NamedTypeRef", name: type, span: fn.span };
}
