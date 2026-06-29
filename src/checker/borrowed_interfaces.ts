import type { Expression, FunctionDecl, InterfaceDecl } from "core/ast.ts";
import { BORROWED_INTERFACE_MISSING_METHOD } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;
type b8 = boolean;
type usize = number;

export interface BorrowedInterfaceConversionResult {
  handled: b8;
  type: TypeName;
  diagnostics: Diagnostic[];
}

export function checkBorrowedInterfaceConversion(
  expr: Expression,
  actual: TypeName,
  expected: TypeName,
  interfaces: InterfaceDecl[],
  functions: Map<Str, FunctionDecl>,
): BorrowedInterfaceConversionResult {
  if (actual === expected) return unhandled();
  const target = borrowedInterfaceName(expected, interfaces);
  if (target === null) return unhandled();
  const source = borrowedSourceName(actual);
  if (source === null) return unhandled();
  const interfaceDecl = interfaces.find((candidate) => candidate.name === target);
  if (interfaceDecl === undefined) return unhandled();
  const issues = interfaceMethodIssues(source, interfaceDecl, functions);
  if (issues.length === 0) return handled(expected, []);
  return handled(
    "<error>",
    issues.map((issue) => ({
      message: borrowedInterfaceIssueMessage(source, target, issue),
      code: BORROWED_INTERFACE_MISSING_METHOD,
      span: expr.span,
    })),
  );
}

export function borrowedInterfaceName(type: TypeName, interfaces: InterfaceDecl[]): Str | null {
  const source = borrowedSourceName(type);
  if (source === null) return null;
  return interfaces.some((candidate) => candidate.name === source) ? source : null;
}

export function borrowedSourceName(type: TypeName): Str | null {
  return type.endsWith("&") ? type.slice(0, type.length - 1) : null;
}

type InterfaceMethodIssue =
  | { kind: "MissingMethod"; method: Str }
  | { kind: "MismatchedMethod"; method: Str };

function interfaceMethodIssues(
  source: Str,
  interfaceDecl: InterfaceDecl,
  functions: Map<Str, FunctionDecl>,
): InterfaceMethodIssue[] {
  const issues: InterfaceMethodIssue[] = [];
  for (const method of interfaceDecl.methods) {
    const fn = functions.get(`${source}.${method.name}`) ?? null;
    if (fn === null) {
      issues.push({ kind: "MissingMethod", method: method.name });
    } else if (!methodSignatureMatches(fn, method)) {
      issues.push({ kind: "MismatchedMethod", method: method.name });
    }
  }
  return issues;
}

function borrowedInterfaceIssueMessage(
  source: Str,
  target: Str,
  issue: InterfaceMethodIssue,
): Str {
  if (issue.kind === "MissingMethod") {
    return `Cannot borrow '${source}' as interface '${target}': missing method '${issue.method}'`;
  }
  return `Cannot borrow '${source}' as interface '${target}': method '${issue.method}' signature does not match`;
}

function methodSignatureMatches(
  fn: FunctionDecl,
  method: InterfaceDecl["methods"][usize],
): b8 {
  const params = fn.params.slice(1);
  if (params.length !== method.params.length) return false;
  if (typeName(fn.returnType) !== typeName(method.returnType)) return false;
  return params.every((param, index) =>
    typeName(param.type) === typeName(method.params[index]!.type)
  );
}

function handled(type: TypeName, diagnostics: Diagnostic[]): BorrowedInterfaceConversionResult {
  return { handled: true, type, diagnostics };
}

function unhandled(): BorrowedInterfaceConversionResult {
  return { handled: false, type: "<error>", diagnostics: [] };
}
