import type { Statement } from "core/ast.ts";
import { spanKey } from "checker/exprs.ts";
import { emitConstantExpressionExpected } from "emitter/constant_expressions.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitExpression } from "emitter/expressions.ts";
import type { LocalTypes } from "emitter/local_types.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;

type SwitchStmt = Extract<Statement, { kind: "SwitchStmt" }>;

type StatementEmitter = (
  stmt: Statement,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
) => Str;

export function emitSwitch(
  stmt: SwitchStmt,
  returnType: Str,
  context: EmitContext,
  locals: LocalTypes,
  emitStatement: StatementEmitter,
): Str {
  const lines: Str[] = [`switch (${emitExpression(stmt.expression, context)}) {`];
  const labelType = switchLabelType(stmt, context);
  for (const switchCase of stmt.cases) {
    for (const label of switchCase.labels) {
      lines.push(`case ${emitConstantExpressionExpected(label, labelType, context)}:`);
    }
    lines.push(
      ...switchCase.statements.map((child) =>
        `  ${emitStatement(child, returnType, context, locals)}`
      ),
    );
  }
  if (stmt.defaultCase) {
    lines.push("default:");
    lines.push(
      ...stmt.defaultCase.statements.map((child) =>
        `  ${emitStatement(child, returnType, context, locals)}`
      ),
    );
  }
  lines.push("}");
  return lines.join("\n");
}

function switchLabelType(stmt: SwitchStmt, context: EmitContext): Str {
  const type = context.expressionTypes?.get(spanKey(stmt.expression.span))?.type ?? "i32";
  const alias = context.typeAliases.get(type)?.type ?? null;
  if (alias !== null) return emitCTypeName(alias, context.typeAliases);
  return type;
}
