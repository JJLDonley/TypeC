import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type IntLiteralValue = bigint;
type f64 = number;
type b8 = boolean;

export interface CastProgram {
  kind: "Program";
  imports: CastImportDecl[];
  typeAliases: CastTypeAliasDecl[];
  functions: CastFunctionDecl[];
  span: SourceSpan;
}

export interface CastImportDecl {
  kind: "ImportDecl";
  names: Str[];
  path: Str;
  span: SourceSpan;
}

export interface CastTypeAliasDecl {
  kind: "TypeAliasDecl";
  exported: b8;
  name: Str;
  type: CastTypeRef;
  span: SourceSpan;
}

export interface CastFunctionDecl {
  kind: "FunctionDecl";
  exported: b8;
  external: b8;
  name: Str;
  params: CastParam[];
  returnType: CastTypeRef;
  body: CastBlockStmt | null;
  span: SourceSpan;
}

export interface CastParam {
  name: Str;
  type: CastTypeRef;
  span: SourceSpan;
}

export type CastTypeRef =
  | CastNamedTypeRef
  | CastPointerTypeRef
  | CastReferenceTypeRef
  | CastInferredArrayTypeRef
  | CastFixedArrayTypeRef
  | CastRecordTypeRef;

export interface CastNamedTypeRef {
  kind: "NamedTypeRef";
  name: Str;
  span: SourceSpan;
}

export interface CastPointerTypeRef {
  kind: "PointerTypeRef";
  element: CastTypeRef;
  span: SourceSpan;
}

export interface CastReferenceTypeRef {
  kind: "ReferenceTypeRef";
  element: CastTypeRef;
  span: SourceSpan;
}

export interface CastInferredArrayTypeRef {
  kind: "InferredArrayTypeRef";
  element: CastTypeRef;
  span: SourceSpan;
}

export interface CastFixedArrayTypeRef {
  kind: "FixedArrayTypeRef";
  element: CastTypeRef;
  sizeText: Str;
  span: SourceSpan;
}

export interface CastRecordTypeRef {
  kind: "RecordTypeRef";
  fields: CastRecordField[];
  span: SourceSpan;
}

export interface CastRecordField {
  name: Str;
  type: CastTypeRef;
  span: SourceSpan;
}

export interface CastBlockStmt {
  kind: "BlockStmt";
  statements: CastStatement[];
  span: SourceSpan;
}

export type CastStatement = CastReturnStmt | CastVarDeclStmt | CastAssignmentStmt | CastWhileStmt | CastIfStmt;

export interface CastReturnStmt {
  kind: "ReturnStmt";
  expression: CastExpression | null;
  span: SourceSpan;
}

export interface CastVarDeclStmt {
  kind: "VarDeclStmt";
  mutable: b8;
  name: Str;
  type: CastTypeRef;
  initializer: CastExpression;
  span: SourceSpan;
}

export interface CastAssignmentStmt {
  kind: "AssignmentStmt";
  name: Str;
  expression: CastExpression;
  span: SourceSpan;
}

export interface CastWhileStmt {
  kind: "WhileStmt";
  condition: CastExpression;
  body: CastBlockStmt;
  span: SourceSpan;
}

export interface CastIfStmt {
  kind: "IfStmt";
  condition: CastExpression;
  thenBody: CastBlockStmt;
  elseBody: CastBlockStmt | null;
  span: SourceSpan;
}

export type CastExpression =
  | CastIntegerLiteral
  | CastFloatLiteral
  | CastBoolLiteral
  | CastIdentifierExpr
  | CastBinaryExpr
  | CastCallExpr
  | CastPostfixPointerExpr
  | CastFieldAccessExpr
  | CastRecordLiteralExpr
  | CastArrayLiteralExpr
  | CastIndexExpr;

export interface CastIntegerLiteral {
  kind: "IntegerLiteral";
  value: IntLiteralValue;
  text: Str;
  span: SourceSpan;
}

export interface CastFloatLiteral {
  kind: "FloatLiteral";
  value: f64;
  text: Str;
  span: SourceSpan;
}

export interface CastBoolLiteral {
  kind: "BoolLiteral";
  value: b8;
  text: "true" | "false";
  span: SourceSpan;
}

export interface CastIdentifierExpr {
  kind: "IdentifierExpr";
  name: Str;
  span: SourceSpan;
}

export interface CastBinaryExpr {
  kind: "BinaryExpr";
  operator: Str;
  left: CastExpression;
  right: CastExpression;
  span: SourceSpan;
}

export interface CastCallExpr {
  kind: "CallExpr";
  callee: Str;
  args: CastExpression[];
  span: SourceSpan;
}

export interface CastPostfixPointerExpr {
  kind: "PostfixPointerExpr";
  operator: ".*" | ".&";
  operand: CastExpression;
  span: SourceSpan;
}

export interface CastFieldAccessExpr {
  kind: "FieldAccessExpr";
  operand: CastExpression;
  field: Str;
  span: SourceSpan;
}

export interface CastRecordLiteralExpr {
  kind: "RecordLiteralExpr";
  fields: CastRecordLiteralField[];
  span: SourceSpan;
}

export interface CastRecordLiteralField {
  name: Str;
  expression: CastExpression;
  span: SourceSpan;
}

export interface CastArrayLiteralExpr {
  kind: "ArrayLiteralExpr";
  elements: CastExpression[];
  span: SourceSpan;
}

export interface CastIndexExpr {
  kind: "IndexExpr";
  operand: CastExpression;
  index: CastExpression;
  span: SourceSpan;
}
