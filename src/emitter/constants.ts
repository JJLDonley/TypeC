import type { ConstDecl } from "core/ast.ts";
import { emitCDeclarator } from "c/type.ts";
import { emitConstantExpressionExpected } from "emitter/constant_expressions.ts";
import type { EmitContext } from "emitter/context.ts";
import { emitCTypeName } from "emitter/type_names.ts";

type Str = string;

export function emitConstantDefinition(constant: ConstDecl, context: EmitContext): Str {
  const declarator = emitCDeclarator(constant.type, constantCName(constant), context.typeAliases);
  const expectedType = emitCTypeName(constant.type, context.typeAliases);
  return `static const ${declarator} = ${
    emitConstantExpressionExpected(constant.initializer, expectedType, context)
  };`;
}

function constantCName(constant: ConstDecl): Str {
  return constant.cName ?? constant.name;
}
