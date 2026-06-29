import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type IntLiteralValue = bigint;
type f64 = number;
type b8 = boolean;

export interface Program {
  kind: "Program";
  imports: ImportDecl[];
  exports?: ExportDecl[];
  defaultExport?: Str | null;
  typeAliases: TypeAliasDecl[];
  interfaces?: InterfaceDecl[];
  taggedUnions?: TaggedUnionDecl[];
  enums?: EnumDecl[];
  constants?: ConstDecl[];
  functions: FunctionDecl[];
  span: SourceSpan;
}

export interface ImportDecl {
  kind: "ImportDecl";
  names: ImportSpecifier[];
  namespace?: Str | null;
  typeOnly?: b8;
  reExport?: b8;
  path: Str;
  span: SourceSpan;
}

export interface ImportSpecifier {
  imported: Str;
  local: Str;
  typeOnly?: b8;
  reExport?: b8;
  span: SourceSpan;
}

export interface ExportDecl {
  kind: "ExportDecl";
  names: ImportSpecifier[];
  typeOnly?: b8;
  path: Str | null;
  span: SourceSpan;
}

export interface TypeAliasDecl {
  kind: "TypeAliasDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  generated?: b8;
  type: TypeRef;
  span: SourceSpan;
}

export interface InterfaceDecl {
  kind: "InterfaceDecl";
  exported: b8;
  name: Str;
  methods: InterfaceMethod[];
  span: SourceSpan;
}

export interface InterfaceMethod {
  name: Str;
  params: Param[];
  returnType: TypeRef;
  span: SourceSpan;
}

export interface TaggedUnionDecl {
  kind: "TaggedUnionDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  variants: TaggedUnionVariant[];
  span: SourceSpan;
}

export interface TaggedUnionVariant {
  name: Str;
  cName?: Str | null;
  payload: TypeRef | null;
  span: SourceSpan;
}

export interface EnumDecl {
  kind: "EnumDecl";
  exported: b8;
  name: Str;
  cName?: Str | null;
  backingType?: TypeRef | null;
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
  overload?: b8;
  access?: AccessModifier;
  classStatic?: b8;
  name: Str;
  cName?: Str | null;
  genericParams?: GenericParam[];
  params: Param[];
  variadic?: b8;
  returnType: TypeRef;
  body: BlockStmt | null;
  span: SourceSpan;
}

export interface GenericParam {
  name: Str;
  constraint?: TypeRef | null;
  span: SourceSpan;
}

export interface Param {
  name: Str;
  optional?: b8;
  rest?: b8;
  type: TypeRef;
  defaultValue?: Expression | null;
  span: SourceSpan;
}

export type TypeRef =
  | NamedTypeRef
  | PointerTypeRef
  | ReferenceTypeRef
  | SafePointerTypeRef
  | SliceTypeRef
  | InferredArrayTypeRef
  | FixedArrayTypeRef
  | TupleTypeRef
  | UnionTypeRef
  | IntersectionTypeRef
  | ConditionalTypeRef
  | IndexedAccessTypeRef
  | MappedTypeRef
  | KeyofTypeRef
  | TypeofTypeRef
  | FunctionTypeRef
  | LiteralTypeRef
  | RecordTypeRef;

export interface NamedTypeRef {
  kind: "NamedTypeRef";
  name: Str;
  typeArgs?: TypeRef[];
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

export interface SafePointerTypeRef {
  kind: "SafePointerTypeRef";
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

export interface TupleTypeRef {
  kind: "TupleTypeRef";
  elements: TypeRef[];
  span: SourceSpan;
}

export interface UnionTypeRef {
  kind: "UnionTypeRef";
  members: TypeRef[];
  span: SourceSpan;
}

export interface IntersectionTypeRef {
  kind: "IntersectionTypeRef";
  members: TypeRef[];
  span: SourceSpan;
}

export interface ConditionalTypeRef {
  kind: "ConditionalTypeRef";
  checkType: TypeRef;
  extendsType: TypeRef;
  trueType: TypeRef;
  falseType: TypeRef;
  span: SourceSpan;
}

export interface IndexedAccessTypeRef {
  kind: "IndexedAccessTypeRef";
  objectType: TypeRef;
  indexName: Str;
  span: SourceSpan;
}

export interface MappedTypeRef {
  kind: "MappedTypeRef";
  keyName: Str;
  sourceType: TypeRef;
  valueType: TypeRef;
  span: SourceSpan;
}

export interface KeyofTypeRef {
  kind: "KeyofTypeRef";
  target: TypeRef;
  span: SourceSpan;
}

export interface TypeofTypeRef {
  kind: "TypeofTypeRef";
  name: Str;
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

export type AccessModifier = "public" | "private" | "protected";

export type LiteralTypeValue = Str | IntLiteralValue | b8;

export interface LiteralTypeRef {
  kind: "LiteralTypeRef";
  value: LiteralTypeValue;
  text: Str;
  span: SourceSpan;
}

export interface RecordField {
  name: Str;
  type: TypeRef;
  access?: AccessModifier;
  readonly?: b8;
  optional?: b8;
  span: SourceSpan;
}

export interface BlockStmt {
  kind: "BlockStmt";
  statements: Statement[];
  span: SourceSpan;
}

export type Statement =
  | EmptyStmt
  | ReturnStmt
  | DeferStmt
  | ExpressionStmt
  | BreakStmt
  | ContinueStmt
  | VarDeclStmt
  | RecordRestStmt
  | ArrayDestructureStmt
  | AssignmentStmt
  | IncDecStmt
  | SwitchStmt
  | WhileStmt
  | DoWhileStmt
  | ForStmt
  | ForOfStmt
  | ForInStmt
  | IfStmt;

export interface EmptyStmt {
  kind: "EmptyStmt";
  span: SourceSpan;
}

export interface ReturnStmt {
  kind: "ReturnStmt";
  expression: Expression | null;
  span: SourceSpan;
}

export interface DeferStmt {
  kind: "DeferStmt";
  expression: Expression;
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

export interface ContinueStmt {
  kind: "ContinueStmt";
  span: SourceSpan;
}

export interface VarDeclStmt {
  kind: "VarDeclStmt";
  mutable: b8;
  name: Str;
  type: TypeRef | null;
  initializer: Expression;
  span: SourceSpan;
}

export interface RecordRestStmt {
  kind: "RecordRestStmt";
  mutable: b8;
  names: Str[];
  restName: Str | null;
  source: Expression;
  span: SourceSpan;
}

export interface ArrayDestructureStmt {
  kind: "ArrayDestructureStmt";
  mutable: b8;
  names: Str[];
  source: Expression;
  span: SourceSpan;
}

export type AssignmentOperator =
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

export interface AssignmentStmt {
  kind: "AssignmentStmt";
  target: AssignmentTarget;
  operator: AssignmentOperator;
  expression: Expression;
  span: SourceSpan;
}

export type AssignmentTarget = IdentifierExpr | FieldAccessExpr | IndexExpr | PostfixPointerExpr;

export type IncDecOperator = "++" | "--";

export interface IncDecStmt {
  kind: "IncDecStmt";
  target: AssignmentTarget;
  operator: IncDecOperator;
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

export interface DoWhileStmt {
  kind: "DoWhileStmt";
  body: BlockStmt;
  condition: Expression;
  span: SourceSpan;
}

export type ForClauseStmt = VarDeclStmt | AssignmentStmt | IncDecStmt | ExpressionStmt;

export interface ForStmt {
  kind: "ForStmt";
  initializer: ForClauseStmt | null;
  condition: Expression;
  update: ForClauseStmt | null;
  body: BlockStmt;
  span: SourceSpan;
}

export interface ForOfStmt {
  kind: "ForOfStmt";
  mutable: b8;
  name: Str;
  iterable: Expression;
  body: BlockStmt;
  span: SourceSpan;
}

export interface ForInStmt {
  kind: "ForInStmt";
  name: Str;
  iterable: Expression;
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
  | ZeroValueExpr
  | StringLiteral
  | ArrowFunctionExpr
  | IdentifierExpr
  | UnaryExpr
  | BinaryExpr
  | ConditionalExpr
  | NullishCoalesceExpr
  | CastExpr
  | SatisfiesExpr
  | CallExpr
  | NewExpr
  | MethodCallExpr
  | PostfixPointerExpr
  | NonNullAssertExpr
  | FieldAccessExpr
  | OptionalFieldAccessExpr
  | OptionalMethodCallExpr
  | OptionalIndexExpr
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

export interface ZeroValueExpr {
  kind: "ZeroValueExpr";
  span: SourceSpan;
}

export interface ArrowFunctionExpr {
  kind: "ArrowFunctionExpr";
  params: Str[];
  body: Expression;
  span: SourceSpan;
}

export interface IdentifierExpr {
  kind: "IdentifierExpr";
  name: Str;
  span: SourceSpan;
}

export interface UnaryExpr {
  kind: "UnaryExpr";
  operator: "+" | "-" | "!" | "~";
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

export interface ConditionalExpr {
  kind: "ConditionalExpr";
  condition: Expression;
  whenTrue: Expression;
  whenFalse: Expression;
  span: SourceSpan;
}

export interface NullishCoalesceExpr {
  kind: "NullishCoalesceExpr";
  operator: "??" | "?:";
  left: Expression;
  fallback: Expression;
  span: SourceSpan;
}

export interface CastExpr {
  kind: "CastExpr";
  type: TypeRef;
  expression: Expression;
  span: SourceSpan;
}

export interface SatisfiesExpr {
  kind: "SatisfiesExpr";
  type: TypeRef;
  expression: Expression;
  span: SourceSpan;
}

export interface CallExpr {
  kind: "CallExpr";
  callee: Str;
  typeArgs?: TypeRef[];
  args: Expression[];
  span: SourceSpan;
}

export interface NewExpr {
  kind: "NewExpr";
  className: Str;
  typeArgs?: TypeRef[];
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

export interface NonNullAssertExpr {
  kind: "NonNullAssertExpr";
  operand: Expression;
  span: SourceSpan;
}

export interface FieldAccessExpr {
  kind: "FieldAccessExpr";
  operand: Expression;
  field: Str;
  span: SourceSpan;
}

export interface OptionalFieldAccessExpr {
  kind: "OptionalFieldAccessExpr";
  operand: Expression;
  field: Str;
  span: SourceSpan;
}

export interface OptionalMethodCallExpr {
  kind: "OptionalMethodCallExpr";
  receiver: Expression;
  method: Str;
  args: Expression[];
  span: SourceSpan;
}

export interface OptionalIndexExpr {
  kind: "OptionalIndexExpr";
  operand: Expression;
  index: Expression;
  span: SourceSpan;
}

export interface RecordLiteralExpr {
  kind: "RecordLiteralExpr";
  fields: RecordLiteralEntry[];
  span: SourceSpan;
}

export type RecordLiteralEntry = RecordLiteralField | RecordLiteralSpread;

export interface RecordLiteralField {
  kind?: "Field";
  name: Str;
  expression: Expression;
  span: SourceSpan;
}

export interface RecordLiteralSpread {
  kind: "Spread";
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
