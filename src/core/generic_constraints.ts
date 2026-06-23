import type { FunctionDecl, GenericParam, InterfaceDecl, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { typeName } from "core/type_ref.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

export interface ConstraintContext {
  interfaces: InterfaceDecl[];
  functions: FunctionDecl[];
}

export function checkGenericConstraints(
  params: GenericParam[],
  typeArgs: TypeRef[],
  context: ConstraintContext,
  span: Diagnostic["span"],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (let index: usize = 0; index < params.length; index += 1) {
    const constraint = params[index].constraint;
    const typeArg = typeArgs[index];
    if (!constraint || !typeArg) continue;
    diagnostics.push(...checkGenericConstraint(params[index], typeArg, constraint, context, span));
  }
  return diagnostics;
}

function checkGenericConstraint(
  param: GenericParam,
  typeArg: TypeRef,
  constraint: TypeRef,
  context: ConstraintContext,
  span: Diagnostic["span"],
): Diagnostic[] {
  if (constraint.kind !== "NamedTypeRef") return [invalidConstraint(param, span)];
  const interfaceDecl = context.interfaces.find((candidate) => candidate.name === constraint.name);
  if (!interfaceDecl) return [invalidConstraint(param, span)];
  if (typeArg.kind !== "NamedTypeRef") return [unsatisfiedConstraint(typeArg, interfaceDecl, span)];
  return missingInterfaceMethods(typeArg.name, interfaceDecl, context.functions, span).map((
    method,
  ) => ({
    message:
      `Type '${typeArg.name}' does not satisfy '${interfaceDecl.name}': missing method '${method}'`,
    span,
  }));
}

function invalidConstraint(param: GenericParam, span: Diagnostic["span"]): Diagnostic {
  return { message: `Invalid constraint for generic parameter '${param.name}'`, span };
}

function unsatisfiedConstraint(
  typeArg: TypeRef,
  interfaceDecl: InterfaceDecl,
  span: Diagnostic["span"],
): Diagnostic {
  return { message: `Type '${typeName(typeArg)}' does not satisfy '${interfaceDecl.name}'`, span };
}

function missingInterfaceMethods(
  typeNameText: Str,
  interfaceDecl: InterfaceDecl,
  functions: FunctionDecl[],
  span: Diagnostic["span"],
): Str[] {
  const missing: Str[] = [];
  for (const method of interfaceDecl.methods) {
    const fn = functions.find((candidate) => candidate.name === `${typeNameText}.${method.name}`);
    if (!fn || !methodSignatureMatches(fn, method)) missing.push(method.name);
  }
  return missing;
}

function methodSignatureMatches(
  fn: FunctionDecl,
  method: InterfaceDecl["methods"][usize],
): b8 {
  const params = fn.params.slice(1);
  if (params.length !== method.params.length) return false;
  if (typeName(fn.returnType) !== typeName(method.returnType)) return false;
  return params.every((param, index) =>
    typeName(param.type) === typeName(method.params[index].type)
  );
}
