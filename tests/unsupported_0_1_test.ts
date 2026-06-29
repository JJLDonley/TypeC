import { check } from "checker";
import { TypeCError } from "core/diagnostics.ts";
import { emitC } from "emitter";
import { instantiateGenerics } from "core/generics.ts";
import { lex } from "core/lexer.ts";
import { resolve } from "core/resolver.ts";
import { parse } from "parser";
import {
  ARROW_FUNCTION_CAPTURE,
  CALL_TARGET_TYPE,
  CONDITION_TYPE,
  INDEX_NON_INDEXABLE,
  LOCAL_INITIALIZER_TYPE,
  PARSE_SYNTAX,
  TYPE_INTERFACE_VALUE,
  TYPE_LITERAL_VALUE,
  TYPE_OPTIONAL_ARRAY,
  TYPE_OPTIONAL_FUNCTION,
  TYPE_POINTER_ARRAY_TARGET,
  TYPE_REFERENCE_ARRAY_TARGET,
  TYPE_REFERENCE_VOID_TARGET,
  TYPE_UNINSTANTIATED_GENERIC,
  TYPE_UNKNOWN,
  UNKNOWN_IDENTIFIER,
  VALUE_VOID_TYPE,
} from "core/diagnostic_codes.ts";

export type Str = string;
type b8 = boolean;

type UnsupportedCase = {
  name: Str;
  source: Str;
  code: Str;
};

const unsupportedConstructs: UnsupportedCase[] = [
  {
    name: "any type",
    source: `function main(): i32 { const value: any = 1; return 0; }`,
    code: TYPE_UNKNOWN,
  },
  {
    name: "unknown type",
    source: `function main(): i32 { const value: unknown = 1; return 0; }`,
    code: TYPE_UNKNOWN,
  },
  {
    name: "never type",
    source: `function main(): i32 { const value: never = 1; return 0; }`,
    code: TYPE_UNKNOWN,
  },
  {
    name: "null value",
    source: `function main(): i32 { const value: i32? = null; return 0; }`,
    code: UNKNOWN_IDENTIFIER,
  },
  {
    name: "undefined value",
    source: `function main(): i32 { const value: i32? = undefined; return 0; }`,
    code: UNKNOWN_IDENTIFIER,
  },
  {
    name: "truthiness",
    source: `function main(): i32 { const value: i32 = 1; if (value) { return 1; } return 0; }`,
    code: CONDITION_TYPE,
  },
  {
    name: "dynamic property map",
    source:
      `type Point = { x: i32; }; function main(): i32 { const point: Point = { x: 1 }; return point["x"]; }`,
    code: INDEX_NON_INDEXABLE,
  },
  {
    name: "runtime reflection expression",
    source: `function main(): i32 { const value: i32 = 1; return typeof value; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "prototype mutation",
    source: `class Box { value: i32; } function main(): i32 { Box.prototype.value = 1; return 0; }`,
    code: UNKNOWN_IDENTIFIER,
  },
  {
    name: "monkey patching",
    source: `class Box { value: i32; } function main(): i32 { Box.extra = 1; return 0; }`,
    code: UNKNOWN_IDENTIFIER,
  },
  {
    name: "delete garbage collection syntax",
    source: `function main(): i32 { let value: i32 = 1; delete value; return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "throw exception",
    source: `function main(): i32 { throw 1; return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "try catch exception",
    source: `function main(): i32 { try { return 1; } catch { return 0; } }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "async function",
    source: `async function main(): i32 { return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "promise type",
    source: `function main(): i32 { const value: Promise<i32> = 1; return 0; }`,
    code: TYPE_UNINSTANTIATED_GENERIC,
  },
  {
    name: "coroutine yield",
    source: `function main(): i32 { yield 1; return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "decorator",
    source: `@entry function main(): i32 { return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "jsx",
    source: `function main(): i32 { const value = <div />; return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "eval call",
    source: `function main(): i32 { return eval("1"); }`,
    code: UNKNOWN_IDENTIFIER,
  },
  {
    name: "runtime generic value",
    source:
      `function valueOf<T>(value: T): i32 { return T; } function main(): i32 { return valueOf<i32>(1); }`,
    code: UNKNOWN_IDENTIFIER,
  },
  {
    name: "owned interface value",
    source:
      `interface Readable { read(): i32; } function main(): i32 { const value: Readable = 0; return 0; }`,
    code: TYPE_INTERFACE_VALUE,
  },
  {
    name: "virtual class method modifier",
    source: `class Box { virtual read(): i32 { return 1; } } function main(): i32 { return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "operator overload",
    source:
      `operator +(left: i32, right: i32): i32 { return left + right; } function main(): i32 { return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "implicit conversion",
    source: `function main(): i32 { const value: bool = 1; return 0; }`,
    code: LOCAL_INITIALIZER_TYPE,
  },
  {
    name: "capturing closure",
    source:
      `function use(callback: () => i32): i32 { return callback(); } function main(): i32 { const value: i32 = 1; return use(() => value); }`,
    code: ARROW_FUNCTION_CAPTURE,
  },
  {
    name: "assignment expression",
    source: `function main(): i32 { let value: i32 = 1; return value = 2; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "sparse array",
    source: `function main(): i32 { const values: i32[2] = [1, , 2]; return 0; }`,
    code: PARSE_SYNTAX,
  },
  {
    name: "dynamic import expression",
    source: `function main(): i32 { const module = import("./math.tc"); return 0; }`,
    code: PARSE_SYNTAX,
  },
];

const unsupportedRuntimeLayouts: UnsupportedCase[] = [
  {
    name: "optional array",
    source: `function main(): i32 { const value: i32[2]? = None(); return 0; }`,
    code: TYPE_OPTIONAL_ARRAY,
  },
  {
    name: "optional function",
    source: `function main(): i32 { const callback: (() => i32)? = None(); return 0; }`,
    code: TYPE_OPTIONAL_FUNCTION,
  },
  {
    name: "void local",
    source: `function main(): i32 { const value: void = 0; return 0; }`,
    code: VALUE_VOID_TYPE,
  },
  {
    name: "pointer to array",
    source: `function main(): i32 { const value: i32[2]* = 0; return 0; }`,
    code: TYPE_POINTER_ARRAY_TARGET,
  },
  {
    name: "reference to array",
    source: `function main(): i32 { const value: i32[2]& = 0; return 0; }`,
    code: TYPE_REFERENCE_ARRAY_TARGET,
  },
  {
    name: "reference to void",
    source: `function main(): i32 { const value: void& = 0; return 0; }`,
    code: TYPE_REFERENCE_VOID_TARGET,
  },
  {
    name: "function type as value call target only",
    source: `function main(): i32 { const value: i32 = 1; return value(); }`,
    code: CALL_TARGET_TYPE,
  },
];

const staticOnlyTypePositions: UnsupportedCase[] = [
  {
    name: "literal alias local",
    source: `type One = 1; function main(): i32 { const value: One = 1; return 0; }`,
    code: TYPE_LITERAL_VALUE,
  },
  {
    name: "literal alias parameter",
    source:
      `type One = 1; function take(value: One): i32 { return 0; } function main(): i32 { return take(1); }`,
    code: TYPE_LITERAL_VALUE,
  },
  {
    name: "literal alias return",
    source: `type One = 1; function make(): One { return 1; } function main(): i32 { return 0; }`,
    code: TYPE_LITERAL_VALUE,
  },
  {
    name: "literal alias record field",
    source: `type One = 1; type Box = { value: One; }; function main(): i32 { return 0; }`,
    code: TYPE_LITERAL_VALUE,
  },
  {
    name: "literal alias array element",
    source: `type One = 1; function main(): i32 { const values: One[1] = [1]; return 0; }`,
    code: TYPE_LITERAL_VALUE,
  },
  {
    name: "literal alias tuple element",
    source: `type One = 1; function main(): i32 { const value: [One] = [1]; return 0; }`,
    code: TYPE_LITERAL_VALUE,
  },
  {
    name: "literal alias optional payload",
    source: `type One = 1; function main(): i32 { const value: One? = Some(1); return 0; }`,
    code: TYPE_LITERAL_VALUE,
  },
];

Deno.test("unsupported 0.1 constructs fail before C emission", async () => {
  for (const testCase of unsupportedConstructs) await assertRejectedBeforeEmission(testCase);
});

Deno.test("unsupported 0.1 runtime layouts fail before C emission", async () => {
  for (const testCase of unsupportedRuntimeLayouts) await assertRejectedBeforeEmission(testCase);
});

Deno.test("static-only types cannot reach runtime layout positions", async () => {
  for (const testCase of staticOnlyTypePositions) await assertRejectedBeforeEmission(testCase);
});

async function assertRejectedBeforeEmission(testCase: UnsupportedCase): Promise<void> {
  await assertCompileDiagnostic(testCase);
}

function assertCompileDiagnostic(testCase: UnsupportedCase): void {
  let emitted: b8 = false;
  try {
    const program = check(resolve(instantiateGenerics(parse(lex(testCase.source)))));
    emitted = true;
    emitC(program);
  } catch (error) {
    if (error instanceof TypeCError && hasDiagnosticCode(error, testCase.code)) {
      if (emitted) throw new Error(`Unexpected C emission for ${testCase.name}`);
      return;
    }
    if (error instanceof TypeCError) {
      throw new Error(formatUnexpectedDiagnostics(testCase, error));
    }
    throw error;
  }
  throw new Error(`Expected rejection for ${testCase.name}`);
}

function hasDiagnosticCode(error: TypeCError, code: Str): b8 {
  return error.diagnostics.some((diagnostic) => diagnostic.code === code);
}

function formatUnexpectedDiagnostics(testCase: UnsupportedCase, error: TypeCError): Str {
  const codes = error.diagnostics.map((diagnostic) => diagnostic.code ?? "<none>").join(", ");
  return `Expected ${testCase.code} for ${testCase.name}, got ${codes}`;
}
