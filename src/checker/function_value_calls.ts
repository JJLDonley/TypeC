import { CALL_TARGET_TYPE } from "core/diagnostic_codes.ts";
import type { Expression } from "core/ast.ts";
import type { Diagnostic, SourceSpan } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { checkCallArgumentType, checkCallArity } from "checker/call_args.ts";
import type { FunctionTypeNameShape } from "checker/type_name_shapes.ts";
import { parseFunctionTypeName } from "checker/type_name_shapes.ts";

type Str = string;
type b8 = boolean;
type usize = number;

type ExpectedTypeResolver = (expr: Expression, expected: TypeName) => TypeName;

export interface FunctionValueCallCheck {
  diagnostics: Diagnostic[];
  handled: b8;
  type: TypeName;
}

export function checkFunctionValueCall(
  name: Str,
  type: TypeName | null,
  args: Expression[],
  resolveExpectedType: ExpectedTypeResolver,
  span: SourceSpan,
): FunctionValueCallCheck {
  if (type === null) return unhandled();
  const fn = parseFunctionTypeName(type);
  if (fn === null) return handled("<error>", [notCallable(name, type, span)]);
  return handled(
    fn.returnType,
    checkFunctionValueCallArguments(name, fn, args, resolveExpectedType, span),
  );
}

function checkFunctionValueCallArguments(
  name: Str,
  fn: FunctionTypeNameShape,
  args: Expression[],
  resolveExpectedType: ExpectedTypeResolver,
  span: SourceSpan,
): Diagnostic[] {
  const diagnostics = checkCallArity(args.length, fn.params.length, false, name, span);
  for (let index: usize = 0; index < args.length && index < fn.params.length; index++) {
    const arg = args[index]!;
    const expected = fn.params[index]!.type;
    diagnostics.push(
      ...checkCallArgumentType(resolveExpectedType(arg, expected), expected, index, arg.span),
    );
  }
  return diagnostics;
}

function notCallable(name: Str, type: TypeName, span: SourceSpan): Diagnostic {
  return {
    message: `Value '${name}' of type '${type}' is not callable`,
    code: CALL_TARGET_TYPE,
    span,
  };
}

function handled(type: TypeName, diagnostics: Diagnostic[]): FunctionValueCallCheck {
  return { diagnostics, handled: true, type };
}

function unhandled(): FunctionValueCallCheck {
  return { diagnostics: [], handled: false, type: "<error>" };
}
