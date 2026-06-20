import type { FunctionDecl, Program, TypeAliasDecl, TypeRef } from "core/ast.ts";

type Str = string;

export function namespaceProgramTypes(program: Program, namespace: Str): Program {
  const aliases = new Set<Str>(program.typeAliases.map((typeAlias) => typeAlias.name));
  return {
    ...program,
    typeAliases: program.typeAliases.map((typeAlias) =>
      namespaceTypeAlias(typeAlias, namespace, aliases)
    ),
    functions: program.functions.map((fn) => namespaceFunctionTypes(fn, namespace, aliases)),
  };
}

function namespaceTypeAlias(
  typeAlias: TypeAliasDecl,
  namespace: Str,
  aliases: Set<Str>,
): TypeAliasDecl {
  return {
    ...typeAlias,
    type: namespaceTypeRef(typeAlias.type, namespace, aliases),
  };
}

function namespaceFunctionTypes(fn: FunctionDecl, namespace: Str, aliases: Set<Str>): FunctionDecl {
  return {
    ...fn,
    params: fn.params.map((param) => ({
      ...param,
      type: namespaceTypeRef(param.type, namespace, aliases),
    })),
    returnType: namespaceTypeRef(fn.returnType, namespace, aliases),
  };
}

function namespaceTypeRef(type: TypeRef, namespace: Str, aliases: Set<Str>): TypeRef {
  switch (type.kind) {
    case "NamedTypeRef":
      return aliases.has(type.name) ? { ...type, name: `${namespace}.${type.name}` } : type;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "InferredArrayTypeRef":
      return { ...type, element: namespaceTypeRef(type.element, namespace, aliases) };
    case "FixedArrayTypeRef":
      return { ...type, element: namespaceTypeRef(type.element, namespace, aliases) };
    case "SliceTypeRef":
      return { ...type, element: namespaceTypeRef(type.element, namespace, aliases) };
    case "FunctionTypeRef":
      return {
        ...type,
        params: type.params.map((param) => ({
          ...param,
          type: namespaceTypeRef(param.type, namespace, aliases),
        })),
        returnType: namespaceTypeRef(type.returnType, namespace, aliases),
      };
    case "RecordTypeRef":
      return {
        ...type,
        fields: type.fields.map((field) => ({
          ...field,
          type: namespaceTypeRef(field.type, namespace, aliases),
        })),
      };
  }
}
