import type { Statement } from "core/ast.ts";
import { emitAssignment } from "emitter/assignments.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitIf, emitWhile } from "emitter/control_flow.ts";
import { emitExpressionStatement } from "emitter/expression_statements.ts";
import { type LocalTypes, registerLocalType } from "emitter/local_types.ts";
import { emitReturnStatement } from "emitter/return_statements.ts";
import { emitSwitch } from "emitter/switch_statements.ts";
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
      return emitReturnStatement(stmt, returnType, context);
    case "ExpressionStmt":
      return emitExpressionStatement(stmt, context);
    case "BreakStmt":
      return "break;";
    case "VarDeclStmt":
      registerLocalType(locals, stmt.name, stmt.type, context.typeAliases);
      return emitVarDecl(stmt, context);
    case "AssignmentStmt":
      return emitAssignment(stmt, context, locals);
    case "SwitchStmt":
      return emitSwitch(stmt, returnType, context, locals, emitStatement);
    case "WhileStmt":
      return emitWhile(stmt, returnType, context, locals, emitStatement);
    case "IfStmt":
      return emitIf(stmt, returnType, context, locals, emitStatement);
  }
}
