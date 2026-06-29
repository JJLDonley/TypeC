import type { ConstDecl, FunctionDecl, InterfaceDecl, TypeAliasDecl, TypeRef } from "core/ast.ts";

type Str = string;

export function lowerStaticReflectionTypeAliases(
  typeAliases: TypeAliasDecl[],
  constants: ConstDecl[],
  functions: FunctionDecl[],
  interfaces: InterfaceDecl[],
): TypeAliasDecl[] {
  const context = staticReflectionContext(typeAliases, constants, functions, interfaces);
  return typeAliases.map((alias) => lowerStaticReflectionTypeAlias(alias, context));
}

interface StaticReflectionContext {
  aliases: Map<Str, TypeRef>;
  constants: Map<Str, ConstDecl>;
  functions: Map<Str, FunctionDecl>;
  interfaces: Map<Str, InterfaceDecl>;
}

function staticReflectionContext(
  typeAliases: TypeAliasDecl[],
  constants: ConstDecl[],
  functions: FunctionDecl[],
  interfaces: InterfaceDecl[],
): StaticReflectionContext {
  return {
    aliases: new Map(typeAliases.map((alias) => [alias.name, alias.type])),
    constants: new Map(constants.map((constant) => [constant.name, constant])),
    functions: new Map(functions.map((fn) => [fn.name, fn])),
    interfaces: new Map(interfaces.map((iface) => [iface.name, iface])),
  };
}

function lowerStaticReflectionTypeAlias(
  alias: TypeAliasDecl,
  context: StaticReflectionContext,
): TypeAliasDecl {
  const type = lowerStaticReflectionTypeRef(alias.type, context);
  return type === alias.type ? alias : { ...alias, type };
}

function lowerStaticReflectionTypeRef(
  type: TypeRef,
  context: StaticReflectionContext,
): TypeRef {
  switch (type.kind) {
    case "KeyofTypeRef":
      return keyofType(type, context) ?? type;
    case "TypeofTypeRef":
      return typeofType(type, context) ?? type;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return { ...type, element: lowerStaticReflectionTypeRef(type.element, context) };
    case "TupleTypeRef":
      return {
        ...type,
        elements: type.elements.map((element) => lowerStaticReflectionTypeRef(element, context)),
      };
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      return {
        ...type,
        members: type.members.map((member) => lowerStaticReflectionTypeRef(member, context)),
      };
    case "ConditionalTypeRef":
      return {
        ...type,
        checkType: lowerStaticReflectionTypeRef(type.checkType, context),
        extendsType: lowerStaticReflectionTypeRef(type.extendsType, context),
        trueType: lowerStaticReflectionTypeRef(type.trueType, context),
        falseType: lowerStaticReflectionTypeRef(type.falseType, context),
      };
    case "IndexedAccessTypeRef":
      return { ...type, objectType: lowerStaticReflectionTypeRef(type.objectType, context) };
    case "MappedTypeRef":
      return {
        ...type,
        sourceType: lowerStaticReflectionTypeRef(type.sourceType, context),
        valueType: lowerStaticReflectionTypeRef(type.valueType, context),
      };
    case "FunctionTypeRef":
      return {
        ...type,
        params: type.params.map((param) => ({
          ...param,
          type: lowerStaticReflectionTypeRef(param.type, context),
        })),
        returnType: lowerStaticReflectionTypeRef(type.returnType, context),
      };
    case "RecordTypeRef":
      return {
        ...type,
        fields: type.fields.map((field) => ({
          ...field,
          type: lowerStaticReflectionTypeRef(field.type, context),
        })),
      };
    case "NamedTypeRef":
    case "LiteralTypeRef":
      return type;
  }
}

function keyofType(
  type: Extract<TypeRef, { kind: "KeyofTypeRef" }>,
  context: StaticReflectionContext,
): TypeRef | null {
  const target = resolveNamedType(type.target, context);
  if (target.kind === "RecordTypeRef") {
    return literalUnion(target.fields.map((field) => field.name), type);
  }
  if (target.kind === "NamedTypeRef") {
    const iface = context.interfaces.get(target.name) ?? null;
    if (iface !== null) return literalUnion(iface.methods.map((method) => method.name), type);
  }
  return null;
}

function typeofType(
  type: Extract<TypeRef, { kind: "TypeofTypeRef" }>,
  context: StaticReflectionContext,
): TypeRef | null {
  const constant = context.constants.get(type.name) ?? null;
  if (constant !== null) return constant.type;
  const fn = context.functions.get(type.name) ?? null;
  if (fn === null) return null;
  return { kind: "FunctionTypeRef", params: fn.params, returnType: fn.returnType, span: type.span };
}

function resolveNamedType(type: TypeRef, context: StaticReflectionContext): TypeRef {
  if (type.kind !== "NamedTypeRef") return type;
  return context.aliases.get(type.name) ?? type;
}

function literalUnion(names: Str[], source: TypeRef): TypeRef | null {
  if (names.length === 0) return null;
  const members = names.map((name) => ({
    kind: "LiteralTypeRef" as const,
    value: name,
    text: name,
    span: source.span,
  }));
  return members.length === 1 ? members[0]! : { kind: "UnionTypeRef", members, span: source.span };
}
