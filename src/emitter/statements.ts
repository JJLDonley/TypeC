import type { Statement } from "core/ast.ts";
import { emitAssignment, type LocalTypes } from "emitter/assignments.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitIf, emitWhile } from "emitter/control_flow.ts";
import { emitExpression, emitExpressionExpected } from "emitter/expressions.ts";
import { emitCTypeName } from "emitter/type_names.ts";
import { emitVarDecl } from "emitter/var_declarations.ts";

type Str = string;

export function emitStatement(
  stmt: Statement,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes = new Map(),
): Str {
  switch (stmt.kind) {
    case "ReturnStmt":
      return stmt.expression
        ? `return ${emitExpressionExpected(stmt.expression, returnType, context)};`
        : "return;";
    case "ExpressionStmt":
      return `${emitExpression(stmt.expression, context)};`;
    case "VarDeclStmt":
      locals.set(stmt.name, emitCTypeName(stmt.type, context.typeAliases));
      return emitVarDecl(stmt, context);
    case "AssignmentStmt":
      return emitAssignment(stmt, context, locals);
    case "WhileStmt":
      return emitWhile(stmt, returnType, context, locals, emitStatement);
    case "IfStmt":
      return emitIf(stmt, returnType, context, locals, emitStatement);
  }
}
