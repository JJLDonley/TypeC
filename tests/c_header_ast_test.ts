import {
  collectHeaderConstants,
  collectHeaderEnums,
  collectHeaderFunctions,
  collectHeaderRecords,
} from "c/header/ast.ts";

type Str = string;
type b8 = boolean;
type usize = number;

Deno.test("collects C header function declarations from clang AST", () => {
  const functions = collectHeaderFunctions({
    kind: "TranslationUnitDecl",
    inner: [
      functionDecl("add", "int32_t (int32_t)", [param("value", "int32_t")], "/project/math.h"),
      functionDecl(
        "ignored",
        "int32_t (int32_t)",
        [param("value", "int32_t")],
        "/project/math.h",
        false,
      ),
      {
        kind: "NamespaceDecl",
        inner: [functionDecl("nested", "void (void)", [], "/project/nested.h")],
      },
    ],
  });

  assertSame(functions.length, 2);
  assertText(functions[0].name, "add");
  assertText(functions[0].returnType, "int32_t");
  assertText(functions[0].sourceFile ?? "", "/project/math.h");
  assertText(functions[0].params[0].name, "value");
  assertText(functions[0].params[0].type, "int32_t");
  assertText(functions[1].name, "nested");
});

Deno.test("collects C header typedef records from clang AST", () => {
  const records = collectHeaderRecords({
    kind: "TranslationUnitDecl",
    inner: [
      typedefRecord(
        "Color",
        [field("r", "unsigned char"), field("g", "unsigned char")],
        "/project/raylib.h",
      ),
      {
        kind: "NamespaceDecl",
        inner: [typedefRecord("Vec2", [field("x", "float")], "/project/vec.h")],
      },
    ],
  });

  assertSame(records.length, 2);
  assertText(records[0].name, "Color");
  assertText(records[0].fields[0].name, "r");
  assertText(records[0].fields[0].type, "unsigned char");
  assertText(records[0].sourceFile ?? "", "/project/raylib.h");
});

Deno.test("collects duplicate C header records for later selection", () => {
  const records = collectHeaderRecords({
    kind: "TranslationUnitDecl",
    inner: [
      typedefRecord("Color", [field("r", "unsigned char")], "/project/a.h"),
      typedefRecord("Color", [field("r", "int32_t")], "/project/b.h"),
    ],
  });

  assertSame(records.length, 2);
});

Deno.test("collects C header constants from clang AST", () => {
  const constants = collectHeaderConstants({
    kind: "TranslationUnitDecl",
    inner: [
      varDecl("ANSWER", "const int32_t", literal("IntegerLiteral", "42"), "/project/config.h"),
      varDecl(
        "ENABLED",
        "const bool",
        cast(literal("IntegerLiteral", "1")),
        "/project/config.h",
      ),
      varDecl(
        "TITLE",
        "const char *",
        cast(literal("StringLiteral", '"TypeC"')),
        "/project/config.h",
      ),
      varDecl(
        "UNSUPPORTED_EXPR",
        "const int32_t",
        binary(literal("IntegerLiteral", "1"), literal("IntegerLiteral", "2")),
        "/project/config.h",
      ),
      varDecl(
        "UNSUPPORTED_STRING",
        "const char *",
        literal("StringLiteral", '"a\\n"'),
        "/project/config.h",
      ),
    ],
  });

  assertSame(constants.length, 3);
  assertText(constants[0].name, "ANSWER");
  assertText(constants[0].value, "42");
  assertText(constants[1].name, "ENABLED");
  assertText(constants[1].value, "true");
  assertText(constants[2].name, "TITLE");
  assertText(constants[2].value, '"TypeC"');
});

Deno.test("collects C header enums from clang AST", () => {
  const enums = collectHeaderEnums({
    kind: "TranslationUnitDecl",
    inner: [
      enumDecl("KeyboardKey", [
        enumConstant("KEY_NULL", "0"),
        enumConstant("KEY_SPACE", "32"),
        enumConstant("KEY_ESCAPE"),
      ], "/project/raylib.h"),
    ],
  });

  assertSame(enums.length, 1);
  assertText(enums[0].name, "KeyboardKey");
  assertText(enums[0].members[0].name, "KEY_NULL");
  assertText(enums[0].members[0].value, "0");
  assertText(enums[0].members[1].value, "32");
  assertText(enums[0].members[2].value, "33");
  assertText(enums[0].sourceFile ?? "", "/project/raylib.h");
});

Deno.test("reads C header function metadata", () => {
  const functions = collectHeaderFunctions({
    kind: "TranslationUnitDecl",
    inner: [
      {
        kind: "FunctionDecl",
        name: "body",
        type: { qualType: "void (void)" },
        storageClass: "static",
        loc: { includedFrom: { file: "/project/body.h" } },
        inner: [{ kind: "CompoundStmt" }],
      },
      functionDecl("unnamed", "void (int32_t, int32_t)", [
        param("", "int32_t"),
        param("value", "int32_t"),
      ], "/project/unnamed.h"),
    ],
  });

  assertSame(functions.length, 2);
  assertSame(functions[0].hasBody, true);
  assertText(functions[0].storageClass ?? "", "static");
  assertText(functions[0].sourceFile ?? "", "/project/body.h");
  assertText(functions[1].params[0].name, "arg0");
});

function functionDecl(
  name: Str,
  qualType: Str,
  inner: unknown[],
  file: Str,
  used: b8 = true,
): unknown {
  return { kind: "FunctionDecl", name, type: { qualType }, loc: { file }, isUsed: used, inner };
}

function param(name: Str, qualType: Str): unknown {
  return { kind: "ParmVarDecl", name, type: { qualType } };
}

function typedefRecord(name: Str, fields: unknown[], file: Str): unknown {
  return {
    kind: "TypedefDecl",
    name,
    loc: { file },
    inner: [{ kind: "RecordDecl", completeDefinition: true, inner: fields }],
  };
}

function field(name: Str, qualType: Str): unknown {
  return { kind: "FieldDecl", name, type: { qualType } };
}

function varDecl(name: Str, qualType: Str, initializer: unknown, file: Str): unknown {
  return { kind: "VarDecl", name, type: { qualType }, loc: { file }, inner: [initializer] };
}

function enumDecl(name: Str, inner: unknown[], file: Str): unknown {
  return { kind: "EnumDecl", name, loc: { file }, inner };
}

function enumConstant(name: Str, value: Str | null = null): unknown {
  const inner = value === null ? [] : [{ kind: "ConstantExpr", value }];
  return { kind: "EnumConstantDecl", name, inner };
}

function literal(kind: Str, value: Str): unknown {
  return { kind, value };
}

function cast(initializer: unknown): unknown {
  return { kind: "ImplicitCastExpr", inner: [initializer] };
}

function binary(left: unknown, right: unknown): unknown {
  return { kind: "BinaryOperator", inner: [left, right] };
}

function assertSame(actual: usize | b8, expected: usize | b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
