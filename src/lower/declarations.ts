import {
  classConstructorFunction,
  classMethodFunction,
  classTypeAlias,
  classVTableDecl,
  classVTableTypeName,
} from "core/classes.ts";
import type {
  ClassVTableDecl,
  ConstDecl,
  EnumDecl,
  FunctionDecl,
  ImportDecl,
  InterfaceDecl,
  Param,
  RecordField,
  Statement,
  TaggedUnionDecl,
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
  CastRecordField,
  CastStructDecl,
  CastTaggedUnionDecl,
  CastTypeAliasDecl,
} from "core/cast.ts";
import { lowerExpression } from "lower/expressions.ts";
import { lowerBlockStmt } from "lower/statements.ts";
import { lowerTypeRef } from "lower/types.ts";
import { optionalTypeRef } from "core/optional_types.ts";

type Str = string;

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

export function lowerClassVTableTypeAlias(classDecl: CastClassDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: false,
    name: classVTableTypeName(classDecl.name),
    cName: classVTableTypeName(classDecl.name),
    type: {
      kind: "RecordTypeRef",
      fields: classDecl.methods.map((method) => ({
        name: method.name,
        type: {
          kind: "FunctionTypeRef",
          params: [receiverParam(classDecl.name, method.span), ...method.params.map(lowerParam)],
          returnType: lowerTypeRef(method.returnType),
          span: method.span,
        },
        span: method.span,
      })),
      span: classDecl.span,
    },
    span: classDecl.span,
  };
}

export function lowerClassVTableDecl(classDecl: CastClassDecl): ClassVTableDecl {
  return classVTableDecl(classDecl);
}

function receiverParam(className: Str, span: CastClassDecl["span"]): Param {
  return {
    name: "this",
    type: {
      kind: "PointerTypeRef",
      element: { kind: "NamedTypeRef", name: className, span },
      span,
    },
    span,
  };
}

export function lowerStructTypeAlias(structDecl: CastStructDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: structDecl.exported,
    name: structDecl.name,
    cName: structDecl.name,
    type: {
      kind: "RecordTypeRef",
      fields: structDecl.fields.map(lowerRecordField),
      span: structDecl.span,
    },
    span: structDecl.span,
  };
}

function lowerRecordField(field: CastRecordField): RecordField {
  return { name: field.name, type: lowerTypeRef(field.type), span: field.span };
}

export function lowerClassMethods(classDecl: CastClassDecl): FunctionDecl[] {
  const constructorFn = classDecl.constructorDecl
    ? [classConstructorFunction(
      classDecl,
      classDecl.constructorDecl,
      classDecl.constructorDecl.params.map(lowerParam),
      lowerConstructorBody(classDecl),
    )]
    : [];
  return [
    ...constructorFn,
    ...classDecl.methods.map((method) =>
      classMethodFunction(
        classDecl,
        method,
        method.params.map(lowerParam),
        lowerTypeRef(method.returnType),
        lowerBlockStmt(method.body),
      )
    ),
  ];
}

function lowerConstructorBody(classDecl: CastClassDecl): NonNullable<FunctionDecl["body"]> {
  const constructorDecl = classDecl.constructorDecl;
  if (!constructorDecl) throw new Error("Expected constructor declaration");
  const thisDecl: Statement = {
    kind: "VarDeclStmt",
    mutable: true,
    name: "this",
    type: { kind: "NamedTypeRef", name: classDecl.name, span: classDecl.span },
    initializer: { kind: "ZeroValueExpr", span: constructorDecl.span },
    span: constructorDecl.span,
  };
  const ret: Statement = {
    kind: "ReturnStmt",
    expression: { kind: "IdentifierExpr", name: "this", span: constructorDecl.span },
    span: constructorDecl.span,
  };
  return {
    kind: "BlockStmt",
    statements: [thisDecl, ...lowerBlockStmt(constructorDecl.body).statements, ret],
    span: constructorDecl.body.span,
  };
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

export function lowerTaggedUnionDecl(unionDecl: CastTaggedUnionDecl): TaggedUnionDecl {
  return {
    kind: "TaggedUnionDecl",
    exported: unionDecl.exported,
    name: unionDecl.name,
    cName: unionDecl.cName,
    variants: unionDecl.variants.map((variant) => ({
      name: variant.name,
      cName: variant.cName,
      payload: variant.payload ? lowerTypeRef(variant.payload) : null,
      span: variant.span,
    })),
    span: unionDecl.span,
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
    overload: fn.overload,
    name: fn.name,
    cName: fn.cName,
    genericParams: fn.genericParams?.map((param) => ({
      ...param,
      constraint: param.constraint ? lowerTypeRef(param.constraint) : null,
    })) ?? [],
    params: fn.params.map(lowerParam),
    variadic: fn.variadic,
    returnType: lowerTypeRef(fn.returnType),
    body: fn.body ? lowerBlockStmt(fn.body) : null,
    span: fn.span,
  };
}

function lowerParam(param: CastParam): Param {
  const type = lowerTypeRef(param.type);
  return {
    name: param.name,
    optional: param.optional,
    type: param.optional === true ? optionalTypeRef(type) : type,
    defaultValue: param.defaultValue ? lowerExpression(param.defaultValue) : null,
    span: param.span,
  };
}
