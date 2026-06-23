import type { FunctionDecl, Param, TypeAliasDecl, TypeRef } from "core/ast.ts";
import type { CastClassDecl, CastClassMethod } from "core/cast.ts";

export type Str = string;

type ClassMethodParts = {
  className: Str;
  methodName: Str;
};

export function classMethodName(className: Str, methodName: Str): Str {
  return `${className}.${methodName}`;
}

export function classMethodCName(className: Str, methodName: Str): Str {
  return `${className}_${methodName}`;
}

export function classTypeRef(className: Str, typeSpan: TypeRef["span"]): TypeRef {
  return { kind: "NamedTypeRef", name: className, span: typeSpan };
}

export function classTypeAlias(
  classDecl: CastClassDecl,
  fields: TypeAliasDecl["type"],
): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: classDecl.exported,
    name: classDecl.name,
    cName: null,
    type: fields,
    span: classDecl.span,
  };
}

export function classMethodFunction(
  classDecl: CastClassDecl,
  method: CastClassMethod,
  params: Param[],
  returnType: TypeRef,
  body: FunctionDecl["body"],
): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: method.exported,
    external: false,
    name: classMethodName(classDecl.name, method.name),
    cName: classMethodCName(classDecl.name, method.name),
    params: [receiverParam(classDecl.name, method), ...params],
    returnType,
    body,
    span: method.span,
  };
}

export function methodParts(name: Str): ClassMethodParts | null {
  const index = name.lastIndexOf(".");
  if (index < 1 || index === name.length - 1) return null;
  return { className: name.slice(0, index), methodName: name.slice(index + 1) };
}

function receiverParam(className: Str, method: CastClassMethod): Param {
  return {
    name: "this",
    type: classTypeRef(className, method.span),
    span: { start: method.span.start, end: method.span.start },
  };
}
