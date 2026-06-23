import { classMethodFunction, classTypeAlias } from "core/classes.ts";
import type {
  ConstDecl,
  EnumDecl,
  FunctionDecl,
  ImportDecl,
  InterfaceDecl,
  Param,
  TypeAliasDecl,
} from "core/ast.ts";
import type {
  CastClassDecl,
  CastConstDecl,
  CastEnumDecl,
  CastFunctionDecl,
  CastImportDecl,
  CastInterfaceDecl,
  CastParam,
  CastTypeAliasDecl,
} from "core/cast.ts";
import { lowerExpression } from "lower/expressions.ts";
import { lowerBlockStmt } from "lower/statements.ts";
import { lowerTypeRef } from "lower/types.ts";

export function lowerImportDecl(importDecl: CastImportDecl): ImportDecl {
  return {
    kind: "ImportDecl",
    names: importDecl.names,
    namespace: importDecl.namespace,
    path: importDecl.path,
    span: importDecl.span,
  };
}

export function lowerTypeAliasDecl(typeAlias: CastTypeAliasDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: typeAlias.exported,
    name: typeAlias.name,
    cName: typeAlias.cName,
    type: lowerTypeRef(typeAlias.type),
    span: typeAlias.span,
  };
}

export function lowerClassTypeAlias(classDecl: CastClassDecl): TypeAliasDecl {
  return classTypeAlias(classDecl, {
    kind: "RecordTypeRef",
    fields: classDecl.fields.map((field) => ({
      name: field.name,
      type: lowerTypeRef(field.type),
      span: field.span,
    })),
    span: classDecl.span,
  });
}

export function lowerClassMethods(classDecl: CastClassDecl): FunctionDecl[] {
  return classDecl.methods.map((method) =>
    classMethodFunction(
      classDecl,
      method,
      method.params.map(lowerParam),
      lowerTypeRef(method.returnType),
      lowerBlockStmt(method.body),
    )
  );
}

export function lowerInterfaceDecl(interfaceDecl: CastInterfaceDecl): InterfaceDecl {
  return {
    kind: "InterfaceDecl",
    exported: interfaceDecl.exported,
    name: interfaceDecl.name,
    methods: interfaceDecl.methods.map((method) => ({
      name: method.name,
      params: method.params.map(lowerParam),
      returnType: lowerTypeRef(method.returnType),
      span: method.span,
    })),
    span: interfaceDecl.span,
  };
}

export function lowerEnumDecl(enumDecl: CastEnumDecl): EnumDecl {
  return {
    kind: "EnumDecl",
    exported: enumDecl.exported,
    name: enumDecl.name,
    cName: enumDecl.cName,
    members: enumDecl.members.map((member) => ({
      name: member.name,
      cName: member.cName,
      initializer: member.initializer ? lowerExpression(member.initializer) : null,
      span: member.span,
    })),
    span: enumDecl.span,
  };
}

export function lowerConstDecl(constant: CastConstDecl): ConstDecl {
  return {
    kind: "ConstDecl",
    exported: constant.exported,
    name: constant.name,
    cName: constant.cName,
    type: lowerTypeRef(constant.type),
    initializer: lowerExpression(constant.initializer),
    span: constant.span,
  };
}

export function lowerFunctionDecl(fn: CastFunctionDecl): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: fn.exported,
    external: fn.external,
    name: fn.name,
    cName: fn.cName,
    params: fn.params.map(lowerParam),
    variadic: fn.variadic,
    returnType: lowerTypeRef(fn.returnType),
    body: fn.body ? lowerBlockStmt(fn.body) : null,
    span: fn.span,
  };
}

function lowerParam(param: CastParam): Param {
  return {
    name: param.name,
    type: lowerTypeRef(param.type),
    span: param.span,
  };
}
