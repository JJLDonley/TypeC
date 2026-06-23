import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type IntLiteralValue = bigint;
type f64 = number;
type b8 = boolean;

export interface CastProgram {
  kind: "Program";
  imports: CastImportDecl[];
  typeAliases: CastTypeAliasDecl[];
  classes?: CastClassDecl[];
  interfaces?: CastInterfaceDecl[];
  enums?: CastEnumDecl[];
  constants?: CastConstDecl[];
  functions: CastFunctionDecl[];
  span: SourceSpan;
}

export interface CastImportDecl {
  kind: "ImportDecl";
  names: Str[];
  namespace?: Str | null;
  path: Str;
  span: SourceSpan;
}

export interface CastTypeAliasDecl {
  kind: "TypeAliasDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  type: CastTypeRef;
  span: SourceSpan;
}

export interface CastClassDecl {
  kind: "ClassDecl";
  exported: b8;
  name: Str;
  fields: CastClassField[];
  methods: CastClassMethod[];
  span: SourceSpan;
}

export interface CastClassField {
  name: Str;
  type: CastTypeRef;
  span: SourceSpan;
}

export interface CastClassMethod {
  exported: b8;
  name: Str;
  params: CastParam[];
  returnType: CastTypeRef;
  body: CastBlockStmt;
  span: SourceSpan;
}

export interface CastInterfaceDecl {
  kind: "InterfaceDecl";
  exported: b8;
  name: Str;
  methods: CastInterfaceMethod[];
  span: SourceSpan;
}

export interface CastInterfaceMethod {
  name: Str;
  params: CastParam[];
  returnType: CastTypeRef;
  span: SourceSpan;
}

export interface CastEnumDecl {
  kind: "EnumDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  members: CastEnumMember[];
  span: SourceSpan;
}

export interface CastEnumMember {
  name: Str;
  cName?: Str | null;
  initializer: CastExpression | null;
  span: SourceSpan;
}

export interface CastConstDecl {
  kind: "ConstDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  type: CastTypeRef;
  initializer: CastExpression;
  span: SourceSpan;
}

export interface CastFunctionDecl {
  kind: "FunctionDecl";
  exported: b8;
  external: b8;
  name: Str;
  cName?: Str | null;
  genericParams?: CastGenericParam[];
  params: CastParam[];
  variadic?: b8;
  returnType: CastTypeRef;
  body: CastBlockStmt | null;
  span: SourceSpan;
}

export interface CastGenericParam {
  name: Str;
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
  | CastSliceTypeRef
  | CastInferredArrayTypeRef
  | CastFixedArrayTypeRef
  | CastFunctionTypeRef
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

export interface CastSliceTypeRef {
  kind: "SliceTypeRef";
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

export interface CastFunctionTypeRef {
  kind: "FunctionTypeRef";
  params: CastParam[];
  returnType: CastTypeRef;
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

export type CastStatement =
  | CastReturnStmt
  | CastExpressionStmt
  | CastBreakStmt
  | CastVarDeclStmt
  | CastAssignmentStmt
  | CastSwitchStmt
  | CastWhileStmt
  | CastIfStmt;

export interface CastReturnStmt {
  kind: "ReturnStmt";
  expression: CastExpression | null;
  span: SourceSpan;
}

export interface CastExpressionStmt {
  kind: "ExpressionStmt";
  expression: CastExpression;
  span: SourceSpan;
}

export interface CastBreakStmt {
  kind: "BreakStmt";
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

export interface CastSwitchStmt {
  kind: "SwitchStmt";
  expression: CastExpression;
  cases: CastSwitchCase[];
  defaultCase: CastSwitchDefaultCase | null;
  span: SourceSpan;
}

export interface CastSwitchCase {
  labels: CastExpression[];
  statements: CastStatement[];
  span: SourceSpan;
}

export interface CastSwitchDefaultCase {
  statements: CastStatement[];
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
  | CastStringLiteral
  | CastIdentifierExpr
  | CastUnaryExpr
  | CastBinaryExpr
  | CastCallExpr
  | CastMethodCallExpr
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

export interface CastStringLiteral {
  kind: "StringLiteral";
  text: Str;
  span: SourceSpan;
}

export interface CastIdentifierExpr {
  kind: "IdentifierExpr";
  name: Str;
  span: SourceSpan;
}

export interface CastUnaryExpr {
  kind: "UnaryExpr";
  operator: "+" | "-";
  operand: CastExpression;
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
  typeArgs?: CastTypeRef[];
  args: CastExpression[];
  span: SourceSpan;
}

export interface CastMethodCallExpr {
  kind: "MethodCallExpr";
  receiver: CastExpression;
  method: Str;
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
