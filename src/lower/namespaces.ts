import { cSymbolName } from "core/c_names.ts";
import type {
  CastClassDecl,
  CastConstDecl,
  CastEnumDecl,
  CastFunctionDecl,
  CastInterfaceDecl,
  CastNamespaceDecl,
  CastNamespaceMemberDecl,
  CastProgram,
  CastStructDecl,
  CastTaggedUnionDecl,
  CastTypeAliasDecl,
} from "core/cast.ts";

type Str = string;

export function flattenNamespaces(program: CastProgram): CastProgram {
  const members = (program.namespaces ?? []).flatMap(flattenNamespace);
  return {
    ...program,
    namespaces: [],
    typeAliases: [...program.typeAliases, ...selectTypeAliases(members)],
    classes: [...(program.classes ?? []), ...selectClasses(members)],
    structs: [...(program.structs ?? []), ...selectStructs(members)],
    interfaces: [...(program.interfaces ?? []), ...selectInterfaces(members)],
    taggedUnions: [...(program.taggedUnions ?? []), ...selectTaggedUnions(members)],
    enums: [...(program.enums ?? []), ...selectEnums(members)],
    constants: [...(program.constants ?? []), ...selectConstants(members)],
    functions: [...program.functions, ...selectFunctions(members)],
  };
}

function flattenNamespace(namespaceDecl: CastNamespaceDecl): CastNamespaceMemberDecl[] {
  return namespaceDecl.declarations.map((declaration) =>
    prefixDeclaration(namespaceDecl, declaration)
  );
}

function prefixDeclaration(
  namespaceDecl: CastNamespaceDecl,
  declaration: CastNamespaceMemberDecl,
): CastNamespaceMemberDecl {
  const name = qualifiedName(namespaceDecl.name, declaration.name);
  const exported = namespaceDecl.exported || declaration.exported;
  switch (declaration.kind) {
    case "TypeAliasDecl":
      return { ...declaration, exported, name, cName: cSymbolName(name) };
    case "ClassDecl":
      return { ...declaration, exported, name };
    case "StructDecl":
      return { ...declaration, exported, name };
    case "InterfaceDecl":
      return { ...declaration, exported, name };
    case "TaggedUnionDecl":
      return { ...declaration, exported, name, cName: cSymbolName(name) };
    case "EnumDecl":
      return { ...declaration, exported, name, cName: cSymbolName(name) };
    case "ConstDecl":
      return { ...declaration, exported, name, cName: cSymbolName(name) };
    case "FunctionDecl":
      return { ...declaration, exported, name, cName: cSymbolName(name) };
  }
}

function qualifiedName(namespaceName: Str, memberName: Str): Str {
  return `${namespaceName}.${memberName}`;
}

function selectTypeAliases(declarations: CastNamespaceMemberDecl[]): CastTypeAliasDecl[] {
  return declarations.filter((decl): decl is CastTypeAliasDecl => decl.kind === "TypeAliasDecl");
}

function selectClasses(declarations: CastNamespaceMemberDecl[]): CastClassDecl[] {
  return declarations.filter((decl): decl is CastClassDecl => decl.kind === "ClassDecl");
}

function selectStructs(declarations: CastNamespaceMemberDecl[]): CastStructDecl[] {
  return declarations.filter((decl): decl is CastStructDecl => decl.kind === "StructDecl");
}

function selectInterfaces(declarations: CastNamespaceMemberDecl[]): CastInterfaceDecl[] {
  return declarations.filter((decl): decl is CastInterfaceDecl => decl.kind === "InterfaceDecl");
}

function selectTaggedUnions(declarations: CastNamespaceMemberDecl[]): CastTaggedUnionDecl[] {
  return declarations.filter((decl): decl is CastTaggedUnionDecl =>
    decl.kind === "TaggedUnionDecl"
  );
}

function selectEnums(declarations: CastNamespaceMemberDecl[]): CastEnumDecl[] {
  return declarations.filter((decl): decl is CastEnumDecl => decl.kind === "EnumDecl");
}

function selectConstants(declarations: CastNamespaceMemberDecl[]): CastConstDecl[] {
  return declarations.filter((decl): decl is CastConstDecl => decl.kind === "ConstDecl");
}

function selectFunctions(declarations: CastNamespaceMemberDecl[]): CastFunctionDecl[] {
  return declarations.filter((decl): decl is CastFunctionDecl => decl.kind === "FunctionDecl");
}
