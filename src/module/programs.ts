import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type {
  ConstDecl,
  EnumDecl,
  FunctionDecl,
  ImportSpecifier,
  InterfaceDecl,
  Program,
  TaggedUnionDecl,
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
    taggedUnions: uniqueRefs([
      ...imports.flatMap((program) => program.taggedUnions ?? []),
      ...(local.taggedUnions ?? []),
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

export function selectImports(
  program: Program,
  specifiers: ImportSpecifier[],
  span: Diagnostic["span"],
): Program {
  const selected = specifiers.map((specifier) => selectImport(program, specifier, span));
  return mergeProgram(emptyProgram(program), selected);
}

function selectImport(
  program: Program,
  specifier: ImportSpecifier,
  span: Diagnostic["span"],
): Program {
  const imported = specifier.imported;
  const typeAliases = selectTypeAlias(program.typeAliases, imported);
  const interfaces = selectInterface(program.interfaces ?? [], imported);
  const taggedUnions = selectTaggedUnion(program.taggedUnions ?? [], imported);
  const enums = selectEnum(program.enums ?? [], imported);
  const constants = selectConstant(program.constants ?? [], imported);
  const functions = selectFunction(program.functions, imported);
  if (
    typeAliases.length + interfaces.length + taggedUnions.length + enums.length +
        constants.length + functions.length === 0
  ) {
    throw new TypeCError([{ message: `Module does not export '${imported}'`, span }]);
  }
  const selected = selectDependencyClosure(
    program,
    [
      ...typeAliases.map((typeAlias) => typeAlias.name),
      ...interfaces.map((interfaceDecl) => interfaceDecl.name),
      ...taggedUnions.map((unionDecl) => unionDecl.name),
      ...enums.map((enumDecl) => enumDecl.name),
    ],
    constants.map((constant) => constant.name),
    functions.map((fn) => fn.name),
  );
  return aliasImportRoots(selected, specifier);
}

function emptyProgram(program: Program): Program {
  return {
    kind: "Program",
    imports: [],
    typeAliases: [],
    interfaces: [],
    taggedUnions: [],
    enums: [],
    constants: [],
    functions: [],
    span: program.span,
  };
}

function aliasImportRoots(program: Program, specifier: ImportSpecifier): Program {
  if (specifier.imported === specifier.local) return program;
  return {
    ...program,
    typeAliases: program.typeAliases.map((typeAlias) =>
      typeAlias.name === specifier.imported
        ? { ...typeAlias, exported: false, name: specifier.local }
        : typeAlias
    ),
    interfaces: (program.interfaces ?? []).map((interfaceDecl) =>
      interfaceDecl.name === specifier.imported
        ? { ...interfaceDecl, exported: false, name: specifier.local }
        : interfaceDecl
    ),
    taggedUnions: (program.taggedUnions ?? []).map((unionDecl) =>
      unionDecl.name === specifier.imported
        ? { ...unionDecl, exported: false, name: specifier.local }
        : unionDecl
    ),
    enums: (program.enums ?? []).map((enumDecl) =>
      enumDecl.name === specifier.imported
        ? { ...enumDecl, exported: false, name: specifier.local }
        : enumDecl
    ),
    constants: (program.constants ?? []).map((constant) =>
      constant.name === specifier.imported
        ? { ...constant, exported: false, name: specifier.local }
        : constant
    ),
    functions: program.functions.map((fn) =>
      fn.name === specifier.imported ? aliasFunction(fn, specifier.local) : fn
    ),
  };
}

export function selectNamespaceImports(
  program: Program,
  namespace: Str,
  members: Str[] = [
    ...exportedTypeNames(program),
    ...exportedInterfaceNames(program),
    ...exportedTaggedUnionNames(program),
    ...exportedEnumNames(program),
    ...exportedConstantNames(program),
    ...exportedFunctionNames(program),
  ],
): Program {
  const selected = selectDependencyClosure(
    program,
    exportedNamespaceTypeNames(program, members),
    exportedNamespaceConstantNames(program, members),
    exportedNamespaceFunctionNames(program, members),
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
  const taggedUnions = (namespaced.taggedUnions ?? []).map((unionDecl) =>
    namespaceTaggedUnion(unionDecl, namespace)
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
    taggedUnions,
    enums,
    constants,
    functions,
    span: program.span,
  };
}

function exportedNamespaceTypeNames(program: Program, members: Str[]): Str[] {
  const memberSet = new Set(members);
  return [
    ...exportedTypeNames(program),
    ...exportedInterfaceNames(program),
    ...exportedTaggedUnionNames(program),
    ...exportedEnumNames(program),
  ].filter((name) => memberSet.has(name));
}

function exportedNamespaceConstantNames(program: Program, _members: Str[]): Str[] {
  return exportedConstantNames(program);
}

function exportedNamespaceFunctionNames(program: Program, members: Str[]): Str[] {
  const memberSet = new Set(members);
  return exportedFunctionNames(program).filter((name) => memberSet.has(name));
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

function exportedTaggedUnionNames(program: Program): Str[] {
  return (program.taggedUnions ?? []).filter((unionDecl) => unionDecl.exported).map((unionDecl) =>
    unionDecl.name
  );
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

function namespaceTaggedUnion(unionDecl: TaggedUnionDecl, namespace: Str): TaggedUnionDecl {
  return {
    ...unionDecl,
    name: `${namespace}.${unionDecl.name}`,
    cName: namespaceCName(namespace, unionDecl.name),
  };
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

function aliasFunction(fn: FunctionDecl, local: Str): FunctionDecl {
  return {
    ...fn,
    exported: false,
    name: local,
    cName: fn.external ? fn.cName ?? fn.name : fn.cName,
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

function selectTaggedUnion(unions: TaggedUnionDecl[], name: Str): TaggedUnionDecl[] {
  return unions.filter((unionDecl) => unionDecl.exported && unionDecl.name === name);
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
