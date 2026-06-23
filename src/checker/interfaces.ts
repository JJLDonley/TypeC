import type { Diagnostic } from "core/diagnostics.ts";
import type { InterfaceDecl, TypeRef } from "core/ast.ts";
import { checkTypeRef } from "checker/type_validation.ts";

export type Str = string;
type usize = number;

export function checkInterfaces(
  interfaces: InterfaceDecl[],
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  return interfaces.flatMap((interfaceDecl) => checkInterface(interfaceDecl, typeAliases));
}

function checkInterface(
  interfaceDecl: InterfaceDecl,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const methods = new Set<Str>();
  for (const method of interfaceDecl.methods) {
    diagnostics.push(...checkInterfaceMethod(method, methods, typeAliases));
  }
  return diagnostics;
}

function checkInterfaceMethod(
  method: InterfaceDecl["methods"][usize],
  methods: Set<Str>,
  typeAliases: Map<Str, TypeRef>,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (methods.has(method.name)) {
    diagnostics.push({ message: `Duplicate interface method '${method.name}'`, span: method.span });
  }
  methods.add(method.name);
  for (const param of method.params) diagnostics.push(...checkTypeRef(param.type, typeAliases));
  diagnostics.push(...checkTypeRef(method.returnType, typeAliases));
  return diagnostics;
}
