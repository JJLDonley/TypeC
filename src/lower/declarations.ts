import { cSymbolName } from "core/c_names.ts";
import { classConstructorFunction, classMethodFunction, classTypeAlias } from "core/classes.ts";
import type {
  ConstDecl,
  EnumDecl,
  ExportDecl,
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
  CastExportDecl,
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
    typeOnly: importDecl.typeOnly,
    reExport: importDecl.reExport,
    path: importDecl.path,
    span: importDecl.span,
  };
}

export function lowerExportDecl(exportDecl: CastExportDecl): ExportDecl {
  return {
    kind: "ExportDecl",
    names: exportDecl.names,
    typeOnly: exportDecl.typeOnly,
    path: exportDecl.path,
    span: exportDecl.span,
  };
}

export function lowerTypeAliasDecl(typeAlias: CastTypeAliasDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: typeAlias.exported,
    name: typeAlias.name,
    cName: typeAlias.cName,
    generated: typeAlias.generated,
    type: lowerTypeRef(typeAlias.type),
    span: typeAlias.span,
  };
}

export function lowerClassTypeAlias(classDecl: CastClassDecl): TypeAliasDecl {
  return classTypeAlias(classDecl, {
    kind: "RecordTypeRef",
    fields: classDecl.fields.filter((field) => !field.static).map((field) => ({
      name: field.name,
      type: lowerTypeRef(field.type),
      access: field.access,
      readonly: field.readonly,
      span: field.span,
    })),
    span: classDecl.span,
  });
}

export function lowerClassConstants(classDecl: CastClassDecl): ConstDecl[] {
  return classDecl.fields.filter((field) => field.static && field.initializer !== null).map((
    field,
  ) => ({
    kind: "ConstDecl",
    exported: classDecl.exported,
    name: `${classDecl.name}.${field.name}`,
    cName: cSymbolName(`${classDecl.name}_${field.name}`),
    type: lowerTypeRef(field.type),
    initializer: lowerExpression(field.initializer!),
    span: field.span,
  }));
}

export function lowerStructTypeAlias(structDecl: CastStructDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: structDecl.exported,
    name: structDecl.name,
    cName: cSymbolName(structDecl.name),
    type: {
      kind: "RecordTypeRef",
      fields: structDecl.fields.map(lowerRecordField),
      span: structDecl.span,
    },
    span: structDecl.span,
  };
}

function lowerRecordField(field: CastRecordField): RecordField {
  const type = lowerTypeRef(field.type);
  return {
    name: field.name,
    type: field.optional === true ? optionalTypeRef(type) : type,
    readonly: field.readonly,
    optional: field.optional,
    span: field.span,
  };
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
    backingType: enumDecl.backingType ? lowerTypeRef(enumDecl.backingType) : null,
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
    rest: param.rest,
    type: lowerParamType(param, type),
    defaultValue: param.defaultValue ? lowerExpression(param.defaultValue) : null,
    span: param.span,
  };
}

function lowerParamType(param: CastParam, type: Param["type"]): Param["type"] {
  if (param.optional === true) return optionalTypeRef(type);
  if (param.rest === true && type.kind === "InferredArrayTypeRef") {
    return { kind: "SliceTypeRef", element: type.element, span: type.span };
  }
  return type;
}
