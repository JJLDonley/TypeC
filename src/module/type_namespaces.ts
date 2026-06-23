import type {
  FunctionDecl,
  InterfaceDecl,
  Program,
  TaggedUnionDecl,
  TypeAliasDecl,
  TypeRef,
} from "core/ast.ts";

type Str = string;

export function namespaceProgramTypes(program: Program, namespace: Str): Program {
  const aliases = new Set<Str>([
    ...program.typeAliases.map((typeAlias) => typeAlias.name),
    ...(program.interfaces ?? []).map((interfaceDecl) => interfaceDecl.name),
    ...(program.enums ?? []).map((enumDecl) => enumDecl.name),
    ...(program.taggedUnions ?? []).map((unionDecl) => unionDecl.name),
  ]);
  return {
    ...program,
    typeAliases: program.typeAliases.map((typeAlias) =>
      namespaceTypeAlias(typeAlias, namespace, aliases)
    ),
    interfaces: (program.interfaces ?? []).map((interfaceDecl) =>
      namespaceInterface(interfaceDecl, namespace, aliases)
    ),
    taggedUnions: (program.taggedUnions ?? []).map((unionDecl) =>
      namespaceTaggedUnion(unionDecl, namespace, aliases)
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

function namespaceInterface(
  interfaceDecl: InterfaceDecl,
  namespace: Str,
  aliases: Set<Str>,
): InterfaceDecl {
  return {
    ...interfaceDecl,
    methods: interfaceDecl.methods.map((method) => ({
      ...method,
      params: method.params.map((param) => ({
        ...param,
        type: namespaceTypeRef(param.type, namespace, aliases),
      })),
      returnType: namespaceTypeRef(method.returnType, namespace, aliases),
    })),
  };
}

function namespaceTaggedUnion(
  unionDecl: TaggedUnionDecl,
  namespace: Str,
  aliases: Set<Str>,
): TaggedUnionDecl {
  return {
    ...unionDecl,
    variants: unionDecl.variants.map((variant) => ({
      ...variant,
      payload: variant.payload ? namespaceTypeRef(variant.payload, namespace, aliases) : null,
    })),
  };
}

function namespaceFunctionTypes(fn: FunctionDecl, namespace: Str, aliases: Set<Str>): FunctionDecl {
  return {
    ...fn,
    genericParams: (fn.genericParams ?? []).map((param) => ({
      ...param,
      constraint: param.constraint ? namespaceTypeRef(param.constraint, namespace, aliases) : null,
    })),
    params: fn.params.map((param) => ({
      ...param,
      type: namespaceTypeRef(param.type, namespace, aliases),
    })),
    returnType: namespaceTypeRef(fn.returnType, namespace, aliases),
  };
}

function namespaceTypeRef(type: TypeRef, namespace: Str, aliases: Set<Str>): TypeRef {
  switch (type.kind) {
    case "NamedTypeRef": {
      const typeArgs = type.typeArgs?.map((typeArg) =>
        namespaceTypeRef(typeArg, namespace, aliases)
      );
      const name = aliases.has(type.name) ? `${namespace}.${type.name}` : type.name;
      return { ...type, name, typeArgs };
    }
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
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
