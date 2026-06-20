import { collectHeaderFunctions, collectHeaderRecords } from "c/header/ast.ts";

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

Deno.test("drops ambiguous duplicate C header records", () => {
  const records = collectHeaderRecords({
    kind: "TranslationUnitDecl",
    inner: [
      typedefRecord("Color", [field("r", "unsigned char")], "/project/a.h"),
      typedefRecord("Color", [field("r", "int32_t")], "/project/b.h"),
    ],
  });

  assertSame(records.length, 0);
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

function assertSame(actual: usize | b8, expected: usize | b8): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
