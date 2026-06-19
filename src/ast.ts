import type { SourceSpan } from "./diagnostics.ts";

type Str = string;
type i64 = bigint;
type f64 = number;
type b8 = boolean;

export interface Program {
  kind: "Program";
  functions: FunctionDecl[];
  span: SourceSpan;
}

export interface FunctionDecl {
  kind: "FunctionDecl";
  name: Str;
  params: Param[];
  returnType: TypeRef;
  body: BlockStmt;
  span: SourceSpan;
}

export interface Param {
  name: Str;
  type: TypeRef;
  span: SourceSpan;
}

export type TypeRef = NamedTypeRef | PointerTypeRef | ReferenceTypeRef | InferredArrayTypeRef | FixedArrayTypeRef;

export interface NamedTypeRef {
  kind: "NamedTypeRef";
  name: Str;
  span: SourceSpan;
}

export interface PointerTypeRef {
  kind: "PointerTypeRef";
  element: TypeRef;
  span: SourceSpan;
}

export interface ReferenceTypeRef {
  kind: "ReferenceTypeRef";
  element: TypeRef;
  span: SourceSpan;
}

export interface InferredArrayTypeRef {
  kind: "InferredArrayTypeRef";
  element: TypeRef;
  span: SourceSpan;
}

export interface FixedArrayTypeRef {
  kind: "FixedArrayTypeRef";
  element: TypeRef;
  sizeText: Str;
  span: SourceSpan;
}

export interface BlockStmt {
  kind: "BlockStmt";
  statements: Statement[];
  span: SourceSpan;
}

export type Statement = ReturnStmt | VarDeclStmt;

export interface ReturnStmt {
  kind: "ReturnStmt";
  expression: Expression;
  span: SourceSpan;
}

export interface VarDeclStmt {
  kind: "VarDeclStmt";
  mutable: b8;
  name: Str;
  type: TypeRef;
  initializer: Expression;
  span: SourceSpan;
}

export type Expression = IntegerLiteral | FloatLiteral | IdentifierExpr | BinaryExpr | CallExpr | PostfixPointerExpr;

export interface IntegerLiteral {
  kind: "IntegerLiteral";
  value: i64;
  text: Str;
  span: SourceSpan;
}

export interface FloatLiteral {
  kind: "FloatLiteral";
  value: f64;
  text: Str;
  span: SourceSpan;
}

export interface IdentifierExpr {
  kind: "IdentifierExpr";
  name: Str;
  span: SourceSpan;
}

export interface BinaryExpr {
  kind: "BinaryExpr";
  operator: Str;
  left: Expression;
  right: Expression;
  span: SourceSpan;
}

export interface CallExpr {
  kind: "CallExpr";
  callee: Str;
  args: Expression[];
  span: SourceSpan;
}

export interface PostfixPointerExpr {
  kind: "PostfixPointerExpr";
  operator: ".*" | ".&";
  operand: Expression;
  span: SourceSpan;
}
