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
  structs?: CastStructDecl[];
  interfaces?: CastInterfaceDecl[];
  taggedUnions?: CastTaggedUnionDecl[];
  enums?: CastEnumDecl[];
  constants?: CastConstDecl[];
  functions: CastFunctionDecl[];
  span: SourceSpan;
}

export interface CastImportDecl {
  kind: "ImportDecl";
  names: CastImportSpecifier[];
  namespace?: Str | null;
  path: Str;
  span: SourceSpan;
}

export interface CastImportSpecifier {
  imported: Str;
  local: Str;
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
  genericParams?: CastGenericParam[];
  extends?: CastTypeRef | null;
  implements?: CastTypeRef[];
  fields: CastClassField[];
  constructorDecl: CastClassConstructor | null;
  methods: CastClassMethod[];
  span: SourceSpan;
}

export interface CastClassField {
  name: Str;
  type: CastTypeRef;
  span: SourceSpan;
}

export interface CastClassConstructor {
  params: CastParam[];
  body: CastBlockStmt;
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

export interface CastStructDecl {
  kind: "StructDecl";
  exported: b8;
  name: Str;
  fields: CastRecordField[];
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

export interface CastTaggedUnionDecl {
  kind: "TaggedUnionDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  variants: CastTaggedUnionVariant[];
  span: SourceSpan;
}

export interface CastTaggedUnionVariant {
  name: Str;
  cName?: Str | null;
  payload: CastTypeRef | null;
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
  overload?: b8;
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
  constraint?: CastTypeRef | null;
  span: SourceSpan;
}

export interface CastParam {
  name: Str;
  optional?: b8;
  type: CastTypeRef;
  defaultValue?: CastExpression | null;
  span: SourceSpan;
}

export type CastTypeRef =
  | CastNamedTypeRef
  | CastPointerTypeRef
  | CastReferenceTypeRef
  | CastSafePointerTypeRef
  | CastSliceTypeRef
  | CastInferredArrayTypeRef
  | CastFixedArrayTypeRef
  | CastTupleTypeRef
  | CastUnionTypeRef
  | CastIntersectionTypeRef
  | CastConditionalTypeRef
  | CastIndexedAccessTypeRef
  | CastMappedTypeRef
  | CastFunctionTypeRef
  | CastRecordTypeRef;

export interface CastNamedTypeRef {
  kind: "NamedTypeRef";
  name: Str;
  typeArgs?: CastTypeRef[];
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

export interface CastSafePointerTypeRef {
  kind: "SafePointerTypeRef";
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

export interface CastTupleTypeRef {
  kind: "TupleTypeRef";
  elements: CastTypeRef[];
  span: SourceSpan;
}

export interface CastUnionTypeRef {
  kind: "UnionTypeRef";
  members: CastTypeRef[];
  span: SourceSpan;
}

export interface CastIntersectionTypeRef {
  kind: "IntersectionTypeRef";
  members: CastTypeRef[];
  span: SourceSpan;
}

export interface CastConditionalTypeRef {
  kind: "ConditionalTypeRef";
  checkType: CastTypeRef;
  extendsType: CastTypeRef;
  trueType: CastTypeRef;
  falseType: CastTypeRef;
  span: SourceSpan;
}

export interface CastIndexedAccessTypeRef {
  kind: "IndexedAccessTypeRef";
  objectType: CastTypeRef;
  indexName: Str;
  span: SourceSpan;
}

export interface CastMappedTypeRef {
  kind: "MappedTypeRef";
  keyName: Str;
  sourceType: CastTypeRef;
  valueType: CastTypeRef;
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
  | CastEmptyStmt
  | CastReturnStmt
  | CastDeferStmt
  | CastExpressionStmt
  | CastBreakStmt
  | CastContinueStmt
  | CastVarDeclStmt
  | CastRecordRestStmt
  | CastArrayDestructureStmt
  | CastAssignmentStmt
  | CastIncDecStmt
  | CastSwitchStmt
  | CastWhileStmt
  | CastDoWhileStmt
  | CastForStmt
  | CastForOfStmt
  | CastForInStmt
  | CastIfStmt;

export interface CastEmptyStmt {
  kind: "EmptyStmt";
  span: SourceSpan;
}

export interface CastReturnStmt {
  kind: "ReturnStmt";
  expression: CastExpression | null;
  span: SourceSpan;
}

export interface CastDeferStmt {
  kind: "DeferStmt";
  expression: CastExpression;
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

export interface CastContinueStmt {
  kind: "ContinueStmt";
  span: SourceSpan;
}

export interface CastVarDeclStmt {
  kind: "VarDeclStmt";
  mutable: b8;
  name: Str;
  type: CastTypeRef | null;
  initializer: CastExpression;
  span: SourceSpan;
}

export interface CastRecordRestStmt {
  kind: "RecordRestStmt";
  mutable: b8;
  names: Str[];
  restName: Str | null;
  source: CastExpression;
  span: SourceSpan;
}

export interface CastArrayDestructureStmt {
  kind: "ArrayDestructureStmt";
  mutable: b8;
  names: Str[];
  source: CastExpression;
  span: SourceSpan;
}

export type CastAssignmentOperator =
  | "="
  | "+="
  | "-="
  | "*="
  | "/="
  | "%="
  | "<<="
  | ">>="
  | ">>>="
  | "&="
  | "^="
  | "|=";

export interface CastAssignmentStmt {
  kind: "AssignmentStmt";
  target: CastAssignmentTarget;
  operator: CastAssignmentOperator;
  expression: CastExpression;
  span: SourceSpan;
}

export type CastAssignmentTarget =
  | Extract<CastExpression, { kind: "IdentifierExpr" }>
  | Extract<CastExpression, { kind: "FieldAccessExpr" }>
  | Extract<CastExpression, { kind: "IndexExpr" }>;

export type CastIncDecOperator = "++" | "--";

export interface CastIncDecStmt {
  kind: "IncDecStmt";
  target: CastAssignmentTarget;
  operator: CastIncDecOperator;
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

export interface CastDoWhileStmt {
  kind: "DoWhileStmt";
  body: CastBlockStmt;
  condition: CastExpression;
  span: SourceSpan;
}

export type CastForClauseStmt =
  | CastVarDeclStmt
  | CastAssignmentStmt
  | CastIncDecStmt
  | CastExpressionStmt;

export interface CastForStmt {
  kind: "ForStmt";
  initializer: CastForClauseStmt | null;
  condition: CastExpression;
  update: CastForClauseStmt | null;
  body: CastBlockStmt;
  span: SourceSpan;
}

export interface CastForOfStmt {
  kind: "ForOfStmt";
  mutable: b8;
  name: Str;
  iterable: CastExpression;
  body: CastBlockStmt;
  span: SourceSpan;
}

export interface CastForInStmt {
  kind: "ForInStmt";
  name: Str;
  iterable: CastExpression;
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
  | CastZeroValueExpr
  | CastStringLiteral
  | CastArrowFunctionExpr
  | CastIdentifierExpr
  | CastUnaryExpr
  | CastBinaryExpr
  | CastConditionalExpr
  | CastNullishCoalesceExpr
  | CastCastExpr
  | CastCallExpr
  | CastNewExpr
  | CastMethodCallExpr
  | CastPostfixPointerExpr
  | CastNonNullAssertExpr
  | CastFieldAccessExpr
  | CastOptionalFieldAccessExpr
  | CastOptionalMethodCallExpr
  | CastOptionalIndexExpr
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

export interface CastZeroValueExpr {
  kind: "ZeroValueExpr";
  span: SourceSpan;
}

export interface CastArrowFunctionExpr {
  kind: "ArrowFunctionExpr";
  params: Str[];
  body: CastExpression;
  span: SourceSpan;
}

export interface CastIdentifierExpr {
  kind: "IdentifierExpr";
  name: Str;
  span: SourceSpan;
}

export interface CastUnaryExpr {
  kind: "UnaryExpr";
  operator: "+" | "-" | "!" | "~";
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

export interface CastConditionalExpr {
  kind: "ConditionalExpr";
  condition: CastExpression;
  whenTrue: CastExpression;
  whenFalse: CastExpression;
  span: SourceSpan;
}

export interface CastNullishCoalesceExpr {
  kind: "NullishCoalesceExpr";
  operator: "??" | "?:";
  left: CastExpression;
  fallback: CastExpression;
  span: SourceSpan;
}

export interface CastCastExpr {
  kind: "CastExpr";
  type: CastTypeRef;
  expression: CastExpression;
  span: SourceSpan;
}

export interface CastCallExpr {
  kind: "CallExpr";
  callee: Str;
  typeArgs?: CastTypeRef[];
  args: CastExpression[];
  span: SourceSpan;
}

export interface CastNewExpr {
  kind: "NewExpr";
  className: Str;
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

export interface CastNonNullAssertExpr {
  kind: "NonNullAssertExpr";
  operand: CastExpression;
  span: SourceSpan;
}

export interface CastFieldAccessExpr {
  kind: "FieldAccessExpr";
  operand: CastExpression;
  field: Str;
  span: SourceSpan;
}

export interface CastOptionalFieldAccessExpr {
  kind: "OptionalFieldAccessExpr";
  operand: CastExpression;
  field: Str;
  span: SourceSpan;
}

export interface CastOptionalMethodCallExpr {
  kind: "OptionalMethodCallExpr";
  receiver: CastExpression;
  method: Str;
  args: CastExpression[];
  span: SourceSpan;
}

export interface CastOptionalIndexExpr {
  kind: "OptionalIndexExpr";
  operand: CastExpression;
  index: CastExpression;
  span: SourceSpan;
}

export interface CastRecordLiteralExpr {
  kind: "RecordLiteralExpr";
  fields: CastRecordLiteralEntry[];
  span: SourceSpan;
}

export type CastRecordLiteralEntry = CastRecordLiteralField | CastRecordLiteralSpread;

export interface CastRecordLiteralField {
  kind?: "Field";
  name: Str;
  expression: CastExpression;
  span: SourceSpan;
}

export interface CastRecordLiteralSpread {
  kind: "Spread";
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
