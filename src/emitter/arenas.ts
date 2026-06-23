import type { Expression, FunctionDecl, Program, Statement, TypeRef } from "core/ast.ts";
import { spanKey } from "checker/exprs.ts";
import { parseSafePointerTypeName } from "checker/type_name_shapes.ts";
import type { TypeName } from "core/tast.ts";
import type { EmitContext } from "emitter/context.ts";

type Str = string;
type b8 = boolean;

type CallExpr = Extract<Expression, { kind: "CallExpr" }>;
type ExpressionEmitter = (expr: Expression, context: EmitContext) => Str;

const arenaFunctionNames = new Set<Str>(["arenaCreate", "arenaDestroy", "arenaAlloc"]);

export function emitArenaRuntimeSection(program: Program): Str[] {
  if (!usesArena(program)) return [];
  return [
    "#include <stdlib.h>",
    "",
    "typedef struct __typec_arena_allocation {",
    "  void* ptr;",
    "  struct __typec_arena_allocation* next;",
    "} __typec_arena_allocation;",
    "",
    "typedef struct __typec_arena {",
    "  __typec_arena_allocation* allocations;",
    "} __typec_arena;",
    "",
    "static __typec_arena* __typec_arena_create(void) {",
    "  __typec_arena* arena = (__typec_arena*)malloc(sizeof(__typec_arena));",
    "  if (arena == NULL) abort();",
    "  arena->allocations = NULL;",
    "  return arena;",
    "}",
    "",
    "static void __typec_arena_destroy(__typec_arena* arena) {",
    "  __typec_arena_allocation* allocation = arena->allocations;",
    "  while (allocation != NULL) {",
    "    __typec_arena_allocation* next = allocation->next;",
    "    free(allocation->ptr);",
    "    free(allocation);",
    "    allocation = next;",
    "  }",
    "  free(arena);",
    "}",
    "",
    "static void* __typec_arena_alloc(__typec_arena* arena, usize size) {",
    "  if (size == 0) size = 1;",
    "  void* ptr = malloc(size);",
    "  if (ptr == NULL) abort();",
    "  __typec_arena_allocation* allocation = (__typec_arena_allocation*)malloc(sizeof(__typec_arena_allocation));",
    "  if (allocation == NULL) abort();",
    "  allocation->ptr = ptr;",
    "  allocation->next = arena->allocations;",
    "  arena->allocations = allocation;",
    "  return ptr;",
    "}",
    "",
  ];
}

export function emitArenaCallExpression(
  expr: CallExpr,
  context: EmitContext,
  emitExpression: ExpressionEmitter,
): Str | null {
  if (expr.callee === "arenaCreate") return "__typec_arena_create()";
  if (expr.callee === "arenaDestroy") return emitArenaDestroyCall(expr, context, emitExpression);
  if (expr.callee === "arenaAlloc") return emitArenaAllocCall(expr, context, emitExpression);
  return null;
}

function emitArenaDestroyCall(
  expr: CallExpr,
  context: EmitContext,
  emitExpression: ExpressionEmitter,
): Str {
  return `__typec_arena_destroy(${emitExpression(expr.args[0]!, context)})`;
}

function emitArenaAllocCall(
  expr: CallExpr,
  context: EmitContext,
  emitExpression: ExpressionEmitter,
): Str {
  const resultType = context.expressionTypes?.get(spanKey(expr.span))?.type ?? "<error>";
  const elementType = arenaAllocationElementType(resultType);
  const arena = emitExpression(expr.args[0]!, context);
  const count = emitExpression(expr.args[1]!, context);
  return `((${elementType}*)__typec_arena_alloc(${arena}, sizeof(${elementType}) * ${count}))`;
}

function arenaAllocationElementType(type: TypeName): Str {
  return parseSafePointerTypeName(type)?.element ?? "void";
}

function usesArena(program: Program): b8 {
  return program.functions.some(functionUsesArena) ||
    program.typeAliases.some((alias) => typeUsesArena(alias.type)) ||
    (program.constants ?? []).some((constant) =>
      typeUsesArena(constant.type) || expressionUsesArena(constant.initializer)
    );
}

function functionUsesArena(fn: FunctionDecl): b8 {
  return fn.params.some((param) => typeUsesArena(param.type)) || typeUsesArena(fn.returnType) ||
    (fn.body?.statements.some(statementUsesArena) ?? false);
}

function statementUsesArena(stmt: Statement): b8 {
  switch (stmt.kind) {
    case "ReturnStmt":
      return stmt.expression !== null && expressionUsesArena(stmt.expression);
    case "DeferStmt":
    case "ExpressionStmt":
      return expressionUsesArena(stmt.expression);
    case "VarDeclStmt":
      return typeUsesArena(stmt.type) || expressionUsesArena(stmt.initializer);
    case "AssignmentStmt":
      return expressionUsesArena(stmt.expression);
    case "SwitchStmt":
      return expressionUsesArena(stmt.expression) ||
        stmt.cases.some((caseStmt) =>
          caseStmt.labels.some(expressionUsesArena) || caseStmt.statements.some(statementUsesArena)
        ) || (stmt.defaultCase?.statements.some(statementUsesArena) ?? false);
    case "WhileStmt":
      return expressionUsesArena(stmt.condition) || stmt.body.statements.some(statementUsesArena);
    case "IfStmt":
      return expressionUsesArena(stmt.condition) ||
        stmt.thenBody.statements.some(statementUsesArena) ||
        (stmt.elseBody?.statements.some(statementUsesArena) ?? false);
  }
  return false;
}

function expressionUsesArena(expr: Expression): b8 {
  switch (expr.kind) {
    case "CallExpr":
      return arenaFunctionNames.has(expr.callee) || expr.args.some(expressionUsesArena);
    case "MethodCallExpr":
      return expressionUsesArena(expr.receiver) || expr.args.some(expressionUsesArena);
    case "UnaryExpr":
    case "PostfixPointerExpr":
    case "FieldAccessExpr":
      return expressionUsesArena(expr.operand);
    case "BinaryExpr":
      return expressionUsesArena(expr.left) || expressionUsesArena(expr.right);
    case "RecordLiteralExpr":
      return expr.fields.some((field) => expressionUsesArena(field.expression));
    case "ArrayLiteralExpr":
      return expr.elements.some(expressionUsesArena);
    case "IndexExpr":
      return expressionUsesArena(expr.operand) || expressionUsesArena(expr.index);
    case "IntegerLiteral":
    case "FloatLiteral":
    case "BoolLiteral":
    case "StringLiteral":
    case "IdentifierExpr":
      return false;
  }
}

function typeUsesArena(type: TypeRef): b8 {
  switch (type.kind) {
    case "NamedTypeRef":
      return type.name === "Arena";
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
    case "FixedArrayTypeRef":
      return typeUsesArena(type.element);
    case "FunctionTypeRef":
      return type.params.some((param) => typeUsesArena(param.type)) ||
        typeUsesArena(type.returnType);
    case "RecordTypeRef":
      return type.fields.some((field) => typeUsesArena(field.type));
  }
}
