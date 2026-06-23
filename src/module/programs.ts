import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type {
  ConstDecl,
  EnumDecl,
  FunctionDecl,
  InterfaceDecl,
  Program,
  TypeAliasDecl,
} from "core/ast.ts";
import { namespaceCName } from "module/c_names.ts";
import { selectDependencyClosure } from "module/dependencies.ts";
import { namespaceProgramFunctions } from "module/function_namespaces.ts";
import { namespaceProgramTypes } from "module/type_namespaces.ts";

type Str = string;

export function exportAllFunctions(program: Program): Program {
  return { ...program, functions: program.functions.map((fn) => ({ ...fn, exported: true })) };
}

export function mergeProgram(local: Program, imports: Program[]): Program {
  return {
    kind: "Program",
    imports: [],
    typeAliases: uniqueRefs([
      ...imports.flatMap((program) => program.typeAliases),
      ...local.typeAliases,
    ]),
    interfaces: uniqueRefs([
      ...imports.flatMap((program) => program.interfaces ?? []),
      ...(local.interfaces ?? []),
    ]),
    enums: uniqueRefs([
      ...imports.flatMap((program) => program.enums ?? []),
      ...(local.enums ?? []),
    ]),
    constants: uniqueRefs([
      ...imports.flatMap((program) => program.constants ?? []),
      ...(local.constants ?? []),
    ]),
    functions: uniqueRefs([...imports.flatMap((program) => program.functions), ...local.functions]),
    span: local.span,
  };
}

export function selectImports(program: Program, names: Str[], span: Diagnostic["span"]): Program {
  const typeAliases = names.flatMap((name) => selectTypeAlias(program.typeAliases, name));
  const interfaces = names.flatMap((name) => selectInterface(program.interfaces ?? [], name));
  const enums = names.flatMap((name) => selectEnum(program.enums ?? [], name));
  const constants = names.flatMap((name) => selectConstant(program.constants ?? [], name));
  const functions = names.flatMap((name) => selectFunction(program.functions, name));
  const found = new Set<Str>([
    ...typeAliases.map((decl) => decl.name),
    ...interfaces.map((decl) => decl.name),
    ...enums.map((decl) => decl.name),
    ...constants.map((decl) => decl.name),
    ...functions.map((decl) => decl.name),
  ]);
  const missing = names.filter((name) => !found.has(name));
  if (missing.length > 0) {
    throw new TypeCError(
      missing.map((name) => ({ message: `Module does not export '${name}'`, span })),
    );
  }
  return selectDependencyClosure(
    program,
    [
      ...typeAliases.map((typeAlias) => typeAlias.name),
      ...interfaces.map((interfaceDecl) => interfaceDecl.name),
      ...enums.map((enumDecl) => enumDecl.name),
    ],
    constants.map((constant) => constant.name),
    functions.map((fn) => fn.name),
  );
}

export function selectNamespaceImports(program: Program, namespace: Str): Program {
  const selected = selectDependencyClosure(
    program,
    [
      ...exportedTypeNames(program),
      ...exportedInterfaceNames(program),
      ...exportedEnumNames(program),
    ],
    exportedConstantNames(program),
    exportedFunctionNames(program),
  );
  const namespaced = namespaceProgramFunctions(
    namespaceProgramTypes(selected, namespace),
    namespace,
  );
  const typeAliases = namespaced.typeAliases.map((typeAlias) =>
    namespaceTypeAlias(typeAlias, namespace)
  );
  const interfaces = (namespaced.interfaces ?? []).map((interfaceDecl) =>
    namespaceInterface(interfaceDecl, namespace)
  );
  const enums = (namespaced.enums ?? []).map((enumDecl) => namespaceEnum(enumDecl, namespace));
  const constants = (namespaced.constants ?? []).map((constant) =>
    namespaceConstant(constant, namespace)
  );
  const functions = namespaced.functions.map((fn) => namespaceFunction(fn, namespace));
  return {
    kind: "Program",
    imports: [],
    typeAliases,
    interfaces,
    enums,
    constants,
    functions,
    span: program.span,
  };
}

function exportedTypeNames(program: Program): Str[] {
  return program.typeAliases.filter((typeAlias) => typeAlias.exported).map((typeAlias) =>
    typeAlias.name
  );
}

function exportedInterfaceNames(program: Program): Str[] {
  return (program.interfaces ?? []).filter((interfaceDecl) => interfaceDecl.exported).map((
    interfaceDecl,
  ) => interfaceDecl.name);
}

function exportedEnumNames(program: Program): Str[] {
  return (program.enums ?? []).filter((enumDecl) => enumDecl.exported).map((enumDecl) =>
    enumDecl.name
  );
}

function exportedConstantNames(program: Program): Str[] {
  return (program.constants ?? []).filter((constant) => constant.exported).map((constant) =>
    constant.name
  );
}

function exportedFunctionNames(program: Program): Str[] {
  return program.functions.filter((fn) => fn.exported).map((fn) => fn.name);
}

function namespaceTypeAlias(typeAlias: TypeAliasDecl, namespace: Str): TypeAliasDecl {
  return {
    ...typeAlias,
    exported: false,
    name: `${namespace}.${typeAlias.name}`,
    cName: typeAlias.cName ?? namespaceCName(namespace, typeAlias.name),
  };
}

function namespaceInterface(interfaceDecl: InterfaceDecl, namespace: Str): InterfaceDecl {
  return { ...interfaceDecl, exported: false, name: `${namespace}.${interfaceDecl.name}` };
}

function namespaceEnum(enumDecl: EnumDecl, namespace: Str): EnumDecl {
  return {
    ...enumDecl,
    exported: false,
    name: `${namespace}.${enumDecl.name}`,
    cName: enumDecl.cName ?? namespaceCName(namespace, enumDecl.name),
    members: enumDecl.members.map((member) => ({
      ...member,
      cName: member.cName ?? namespaceCName(namespace, `${enumDecl.name}_${member.name}`),
    })),
  };
}

function namespaceConstant(constant: ConstDecl, namespace: Str): ConstDecl {
  return {
    ...constant,
    exported: false,
    name: `${namespace}.${constant.name}`,
    cName: constant.cName ?? namespaceCName(namespace, constant.name),
  };
}

function namespaceFunction(fn: FunctionDecl, namespace: Str): FunctionDecl {
  return {
    ...fn,
    exported: false,
    name: `${namespace}.${fn.name}`,
    cName: fn.cName ?? namespaceFunctionCName(fn, namespace),
  };
}

function namespaceFunctionCName(fn: FunctionDecl, namespace: Str): Str {
  return fn.external ? fn.name : namespaceCName(namespace, fn.name);
}

function uniqueRefs<T>(items: T[]): T[] {
  return [...new Set<T>(items)];
}

function selectTypeAlias(typeAliases: TypeAliasDecl[], name: Str): TypeAliasDecl[] {
  return typeAliases.filter((typeAlias) => typeAlias.exported && typeAlias.name === name);
}

function selectInterface(interfaces: InterfaceDecl[], name: Str): InterfaceDecl[] {
  return interfaces.filter((interfaceDecl) =>
    interfaceDecl.exported && interfaceDecl.name === name
  );
}

function selectEnum(enums: EnumDecl[], name: Str): EnumDecl[] {
  return enums.filter((enumDecl) => enumDecl.exported && enumDecl.name === name);
}

function selectConstant(constants: ConstDecl[], name: Str): ConstDecl[] {
  return constants.filter((constant) => constant.exported && constant.name === name);
}

function selectFunction(functions: FunctionDecl[], name: Str): FunctionDecl[] {
  return functions.filter((fn) => fn.exported && fn.name === name);
}
