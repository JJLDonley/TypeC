import type {
  ArrayLiteralExpr,
  AssignmentStmt,
  BinaryExpr,
  BlockStmt,
  BoolLiteral,
  CallExpr,
  Expression,
  FieldAccessExpr,
  FixedArrayTypeRef,
  FloatLiteral,
  FunctionDecl,
  IdentifierExpr,
  IfStmt,
  ImportDecl,
  IndexExpr,
  InferredArrayTypeRef,
  IntegerLiteral,
  Param,
  PointerTypeRef,
  RecordField,
  RecordLiteralExpr,
  RecordTypeRef,
  PostfixPointerExpr,
  Program,
  ReferenceTypeRef,
  Statement,
  TypeAliasDecl,
  TypeRef,
  VarDeclStmt,
  WhileStmt,
} from "./ast.ts";
import type {
  CastArrayLiteralExpr,
  CastAssignmentStmt,
  CastBinaryExpr,
  CastBlockStmt,
  CastBoolLiteral,
  CastCallExpr,
  CastExpression,
  CastFieldAccessExpr,
  CastFixedArrayTypeRef,
  CastFloatLiteral,
  CastFunctionDecl,
  CastIdentifierExpr,
  CastIfStmt,
  CastImportDecl,
  CastIndexExpr,
  CastInferredArrayTypeRef,
  CastIntegerLiteral,
  CastParam,
  CastPointerTypeRef,
  CastRecordField,
  CastRecordLiteralExpr,
  CastRecordTypeRef,
  CastPostfixPointerExpr,
  CastProgram,
  CastReferenceTypeRef,
  CastStatement,
  CastTypeAliasDecl,
  CastTypeRef,
  CastVarDeclStmt,
  CastWhileStmt,
} from "./cast.ts";

export function lowerCast(program: CastProgram): Program {
  return {
    kind: "Program",
    imports: program.imports.map(lowerImportDecl),
    typeAliases: program.typeAliases.map(lowerTypeAliasDecl),
    functions: program.functions.map(lowerFunctionDecl),
    span: program.span,
  };
}

function lowerImportDecl(importDecl: CastImportDecl): ImportDecl {
  return { kind: "ImportDecl", names: importDecl.names, path: importDecl.path, span: importDecl.span };
}

function lowerTypeAliasDecl(typeAlias: CastTypeAliasDecl): TypeAliasDecl {
  return {
    kind: "TypeAliasDecl",
    exported: typeAlias.exported,
    name: typeAlias.name,
    type: lowerTypeRef(typeAlias.type),
    span: typeAlias.span,
  };
}

function lowerFunctionDecl(fn: CastFunctionDecl): FunctionDecl {
  return {
    kind: "FunctionDecl",
    exported: fn.exported,
    external: fn.external,
    name: fn.name,
    params: fn.params.map(lowerParam),
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

function lowerTypeRef(type: CastTypeRef): TypeRef {
  switch (type.kind) {
    case "NamedTypeRef":
      return { kind: "NamedTypeRef", name: type.name, span: type.span };
    case "PointerTypeRef":
      return lowerPointerTypeRef(type);
    case "ReferenceTypeRef":
      return lowerReferenceTypeRef(type);
    case "InferredArrayTypeRef":
      return lowerInferredArrayTypeRef(type);
    case "FixedArrayTypeRef":
      return lowerFixedArrayTypeRef(type);
    case "RecordTypeRef":
      return lowerRecordTypeRef(type);
  }
}

function lowerPointerTypeRef(type: CastPointerTypeRef): PointerTypeRef {
  return { kind: "PointerTypeRef", element: lowerTypeRef(type.element), span: type.span };
}

function lowerReferenceTypeRef(type: CastReferenceTypeRef): ReferenceTypeRef {
  return { kind: "ReferenceTypeRef", element: lowerTypeRef(type.element), span: type.span };
}

function lowerInferredArrayTypeRef(type: CastInferredArrayTypeRef): InferredArrayTypeRef {
  return { kind: "InferredArrayTypeRef", element: lowerTypeRef(type.element), span: type.span };
}

function lowerFixedArrayTypeRef(type: CastFixedArrayTypeRef): FixedArrayTypeRef {
  return {
    kind: "FixedArrayTypeRef",
    element: lowerTypeRef(type.element),
    sizeText: type.sizeText,
    span: type.span,
  };
}

function lowerRecordTypeRef(type: CastRecordTypeRef): RecordTypeRef {
  return { kind: "RecordTypeRef", fields: type.fields.map(lowerRecordField), span: type.span };
}

function lowerRecordField(field: CastRecordField): RecordField {
  return { name: field.name, type: lowerTypeRef(field.type), span: field.span };
}

function lowerBlockStmt(block: CastBlockStmt): BlockStmt {
  return {
    kind: "BlockStmt",
    statements: block.statements.map(lowerStatement),
    span: block.span,
  };
}

function lowerStatement(statement: CastStatement): Statement {
  switch (statement.kind) {
    case "ReturnStmt":
      return { kind: "ReturnStmt", expression: lowerExpression(statement.expression), span: statement.span };
    case "VarDeclStmt":
      return lowerVarDeclStmt(statement);
    case "AssignmentStmt":
      return lowerAssignmentStmt(statement);
    case "WhileStmt":
      return lowerWhileStmt(statement);
    case "IfStmt":
      return lowerIfStmt(statement);
  }
}

function lowerIfStmt(statement: CastIfStmt): IfStmt {
  return {
    kind: "IfStmt",
    condition: lowerExpression(statement.condition),
    thenBody: lowerBlockStmt(statement.thenBody),
    elseBody: statement.elseBody ? lowerBlockStmt(statement.elseBody) : null,
    span: statement.span,
  };
}

function lowerAssignmentStmt(statement: CastAssignmentStmt): AssignmentStmt {
  return { kind: "AssignmentStmt", name: statement.name, expression: lowerExpression(statement.expression), span: statement.span };
}

function lowerWhileStmt(statement: CastWhileStmt): WhileStmt {
  return { kind: "WhileStmt", condition: lowerExpression(statement.condition), body: lowerBlockStmt(statement.body), span: statement.span };
}

function lowerVarDeclStmt(statement: CastVarDeclStmt): VarDeclStmt {
  return {
    kind: "VarDeclStmt",
    mutable: statement.mutable,
    name: statement.name,
    type: lowerTypeRef(statement.type),
    initializer: lowerExpression(statement.initializer),
    span: statement.span,
  };
}

function lowerExpression(expression: CastExpression): Expression {
  switch (expression.kind) {
    case "IntegerLiteral":
      return lowerIntegerLiteral(expression);
    case "FloatLiteral":
      return lowerFloatLiteral(expression);
    case "BoolLiteral":
      return lowerBoolLiteral(expression);
    case "IdentifierExpr":
      return lowerIdentifierExpr(expression);
    case "BinaryExpr":
      return lowerBinaryExpr(expression);
    case "CallExpr":
      return lowerCallExpr(expression);
    case "PostfixPointerExpr":
      return lowerPostfixPointerExpr(expression);
    case "FieldAccessExpr":
      return lowerFieldAccessExpr(expression);
    case "RecordLiteralExpr":
      return lowerRecordLiteralExpr(expression);
    case "ArrayLiteralExpr":
      return lowerArrayLiteralExpr(expression);
    case "IndexExpr":
      return lowerIndexExpr(expression);
  }
}

function lowerIntegerLiteral(expression: CastIntegerLiteral): IntegerLiteral {
  return { kind: "IntegerLiteral", value: expression.value, text: expression.text, span: expression.span };
}

function lowerFloatLiteral(expression: CastFloatLiteral): FloatLiteral {
  return { kind: "FloatLiteral", value: expression.value, text: expression.text, span: expression.span };
}

function lowerBoolLiteral(expression: CastBoolLiteral): BoolLiteral {
  return { kind: "BoolLiteral", value: expression.value, text: expression.text, span: expression.span };
}

function lowerIdentifierExpr(expression: CastIdentifierExpr): IdentifierExpr {
  return { kind: "IdentifierExpr", name: expression.name, span: expression.span };
}

function lowerBinaryExpr(expression: CastBinaryExpr): BinaryExpr {
  return {
    kind: "BinaryExpr",
    operator: expression.operator,
    left: lowerExpression(expression.left),
    right: lowerExpression(expression.right),
    span: expression.span,
  };
}

function lowerCallExpr(expression: CastCallExpr): CallExpr {
  return {
    kind: "CallExpr",
    callee: expression.callee,
    args: expression.args.map(lowerExpression),
    span: expression.span,
  };
}

function lowerPostfixPointerExpr(expression: CastPostfixPointerExpr): PostfixPointerExpr {
  return {
    kind: "PostfixPointerExpr",
    operator: expression.operator,
    operand: lowerExpression(expression.operand),
    span: expression.span,
  };
}

function lowerFieldAccessExpr(expression: CastFieldAccessExpr): FieldAccessExpr {
  return {
    kind: "FieldAccessExpr",
    operand: lowerExpression(expression.operand),
    field: expression.field,
    span: expression.span,
  };
}

function lowerRecordLiteralExpr(expression: CastRecordLiteralExpr): RecordLiteralExpr {
  return {
    kind: "RecordLiteralExpr",
    fields: expression.fields.map((field) => ({
      name: field.name,
      expression: lowerExpression(field.expression),
      span: field.span,
    })),
    span: expression.span,
  };
}

function lowerArrayLiteralExpr(expression: CastArrayLiteralExpr): ArrayLiteralExpr {
  return { kind: "ArrayLiteralExpr", elements: expression.elements.map(lowerExpression), span: expression.span };
}

function lowerIndexExpr(expression: CastIndexExpr): IndexExpr {
  return {
    kind: "IndexExpr",
    operand: lowerExpression(expression.operand),
    index: lowerExpression(expression.index),
    span: expression.span,
  };
}
