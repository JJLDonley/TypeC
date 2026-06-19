import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { Expression, FunctionDecl } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { checkCallArgumentType, checkCallArity } from "checker/call_args.ts";
import { typeName } from "core/type_ref.ts";

type usize = number;

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export function checkCallArguments(args: Expression[], fn: FunctionDecl, resolveExpectedType: ExpectedTypeResolver, span: SourceSpan): Diagnostic[] {
  const diagnostics: Diagnostic[] = checkCallArity(args.length, fn.params.length, fn.name, span);
  for (let index: usize = 0; index < args.length && index < fn.params.length; index++) {
    diagnostics.push(...checkCallArgument(args[index]!, fn.params[index]!, resolveExpectedType, index));
  }
  return diagnostics;
}

function checkCallArgument(arg: Expression, param: FunctionDecl["params"][usize], resolveExpectedType: ExpectedTypeResolver, index: usize): Diagnostic[] {
  const expected = typeName(param.type);
  const actual = resolveExpectedType(arg, expected);
  return checkCallArgumentType(actual, expected, index, arg.span);
}
