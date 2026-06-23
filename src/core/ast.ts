import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type IntLiteralValue = bigint;
type f64 = number;
type b8 = boolean;

export interface Program {
  kind: "Program";
  imports: ImportDecl[];
  typeAliases: TypeAliasDecl[];
  enums?: EnumDecl[];
  constants?: ConstDecl[];
  functions: FunctionDecl[];
  span: SourceSpan;
}

export interface ImportDecl {
  kind: "ImportDecl";
  names: Str[];
  namespace?: Str | null;
  path: Str;
  span: SourceSpan;
}

export interface TypeAliasDecl {
  kind: "TypeAliasDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  type: TypeRef;
  span: SourceSpan;
}

export interface EnumDecl {
  kind: "EnumDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  members: EnumMember[];
  span: SourceSpan;
}

export interface EnumMember {
  name: Str;
  cName?: Str | null;
  initializer: Expression | null;
  span: SourceSpan;
}

export interface ConstDecl {
  kind: "ConstDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  type: TypeRef;
  initializer: Expression;
  span: SourceSpan;
}

export interface FunctionDecl {
  kind: "FunctionDecl";
  exported: b8;
  external: b8;
  name: Str;
  cName?: Str | null;
  params: Param[];
  variadic?: b8;
  returnType: TypeRef;
  body: BlockStmt | null;
  span: SourceSpan;
}

export interface Param {
  name: Str;
  type: TypeRef;
  span: SourceSpan;
}

export type TypeRef =
  | NamedTypeRef
  | PointerTypeRef
  | ReferenceTypeRef
  | SliceTypeRef
  | InferredArrayTypeRef
  | FixedArrayTypeRef
  | FunctionTypeRef
  | RecordTypeRef;

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

export interface SliceTypeRef {
  kind: "SliceTypeRef";
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

export interface FunctionTypeRef {
  kind: "FunctionTypeRef";
  params: Param[];
  returnType: TypeRef;
  span: SourceSpan;
}

export interface RecordTypeRef {
  kind: "RecordTypeRef";
  fields: RecordField[];
  span: SourceSpan;
}

export interface RecordField {
  name: Str;
  type: TypeRef;
  span: SourceSpan;
}

export interface BlockStmt {
  kind: "BlockStmt";
  statements: Statement[];
  span: SourceSpan;
}

export type Statement =
  | ReturnStmt
  | ExpressionStmt
  | BreakStmt
  | VarDeclStmt
  | AssignmentStmt
  | SwitchStmt
  | WhileStmt
  | IfStmt;

export interface ReturnStmt {
  kind: "ReturnStmt";
  expression: Expression | null;
  span: SourceSpan;
}

export interface ExpressionStmt {
  kind: "ExpressionStmt";
  expression: Expression;
  span: SourceSpan;
}

export interface BreakStmt {
  kind: "BreakStmt";
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

export interface AssignmentStmt {
  kind: "AssignmentStmt";
  name: Str;
  expression: Expression;
  span: SourceSpan;
}

export interface SwitchStmt {
  kind: "SwitchStmt";
  expression: Expression;
  cases: SwitchCase[];
  defaultCase: SwitchDefaultCase | null;
  span: SourceSpan;
}

export interface SwitchCase {
  labels: Expression[];
  statements: Statement[];
  span: SourceSpan;
}

export interface SwitchDefaultCase {
  statements: Statement[];
  span: SourceSpan;
}

export interface WhileStmt {
  kind: "WhileStmt";
  condition: Expression;
  body: BlockStmt;
  span: SourceSpan;
}

export interface IfStmt {
  kind: "IfStmt";
  condition: Expression;
  thenBody: BlockStmt;
  elseBody: BlockStmt | null;
  span: SourceSpan;
}

export type Expression =
  | IntegerLiteral
  | FloatLiteral
  | BoolLiteral
  | StringLiteral
  | IdentifierExpr
  | UnaryExpr
  | BinaryExpr
  | CallExpr
  | MethodCallExpr
  | PostfixPointerExpr
  | FieldAccessExpr
  | RecordLiteralExpr
  | ArrayLiteralExpr
  | IndexExpr;

export interface IntegerLiteral {
  kind: "IntegerLiteral";
  value: IntLiteralValue;
  text: Str;
  span: SourceSpan;
}

export interface FloatLiteral {
  kind: "FloatLiteral";
  value: f64;
  text: Str;
  span: SourceSpan;
}

export interface BoolLiteral {
  kind: "BoolLiteral";
  value: b8;
  text: "true" | "false";
  span: SourceSpan;
}

export interface StringLiteral {
  kind: "StringLiteral";
  text: Str;
  span: SourceSpan;
}

export interface IdentifierExpr {
  kind: "IdentifierExpr";
  name: Str;
  span: SourceSpan;
}

export interface UnaryExpr {
  kind: "UnaryExpr";
  operator: "+" | "-";
  operand: Expression;
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

export interface MethodCallExpr {
  kind: "MethodCallExpr";
  receiver: Expression;
  method: Str;
  args: Expression[];
  span: SourceSpan;
}

export interface PostfixPointerExpr {
  kind: "PostfixPointerExpr";
  operator: ".*" | ".&";
  operand: Expression;
  span: SourceSpan;
}

export interface FieldAccessExpr {
  kind: "FieldAccessExpr";
  operand: Expression;
  field: Str;
  span: SourceSpan;
}

export interface RecordLiteralExpr {
  kind: "RecordLiteralExpr";
  fields: RecordLiteralField[];
  span: SourceSpan;
}

export interface RecordLiteralField {
  name: Str;
  expression: Expression;
  span: SourceSpan;
}

export interface ArrayLiteralExpr {
  kind: "ArrayLiteralExpr";
  elements: Expression[];
  span: SourceSpan;
}

export interface IndexExpr {
  kind: "IndexExpr";
  operand: Expression;
  index: Expression;
  span: SourceSpan;
}
