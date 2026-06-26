import type { CastTypeRef } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { parseTypeRefWith, type TypeRefParser } from "parser/type_refs.ts";

type Str = string;
type i32 = number;

const sourceSpan = {
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 0, line: 1, column: 1 },
};

Deno.test("parses postfix type refs", () => {
  const parser = parserFor([identifier("i32"), punct("*"), punct("["), punct("]"), eof()]);

  const type = parseTypeRefWith(parser);

  assertText(typeName(type), "i32*[]");
});

Deno.test("parses record type refs", () => {
  const parser = parserFor([
    punct("{"),
    identifier("x"),
    punct(":"),
    identifier("i32"),
    punct(";"),
    punct("}"),
    eof(),
  ]);

  const type = parseTypeRefWith(parser);

  assertText(typeName(type), "{x:i32}");
});

Deno.test("parses comma-separated record type refs", () => {
  const type = parseTypeRefWith(
    parserFor([
      punct("{"),
      identifier("x"),
      punct(":"),
      identifier("i32"),
      punct(","),
      identifier("y"),
      punct(":"),
      identifier("i32"),
      punct(","),
      punct("}"),
      eof(),
    ]),
  );

  assertText(typeName(type), "{x:i32,y:i32}");
});

Deno.test("parses tuple type refs", () => {
  const type = parseTypeRefWith(
    parserFor([
      punct("["),
      identifier("u8"),
      punct("["),
      punct("]"),
      punct(","),
      identifier("i32"),
      punct("]"),
      eof(),
    ]),
  );

  assertText(typeName(type), "[u8[], i32]");
});

Deno.test("parses union type refs", () => {
  const type = parseTypeRefWith(
    parserFor([identifier("i32"), operator("|"), identifier("f64"), eof()]),
  );

  assertText(typeName(type), "i32 | f64");
});

Deno.test("parses intersection type refs", () => {
  const type = parseTypeRefWith(
    parserFor([identifier("Named"), operator("&"), identifier("Aged"), eof()]),
  );

  assertText(typeName(type), "Named & Aged");
});

Deno.test("parses conditional type refs", () => {
  const type = parseTypeRefWith(
    parserFor([
      identifier("i32"),
      identifier("extends"),
      identifier("i32"),
      punct("?"),
      identifier("I32Box"),
      punct(":"),
      identifier("OtherBox"),
      eof(),
    ]),
  );

  assertText(typeName(type), "i32 extends i32 ? I32Box : OtherBox");
});

Deno.test("parses mapped type refs", () => {
  const type = parseTypeRefWith(
    parserFor([
      punct("{"),
      punct("["),
      identifier("K"),
      identifier("in"),
      identifier("keyof"),
      identifier("Point"),
      punct("]"),
      punct(":"),
      identifier("Point"),
      punct("["),
      identifier("K"),
      punct("]"),
      punct("}"),
      eof(),
    ]),
  );

  assertText(typeName(type), "{[K in keyof Point]:Point[K]}");
});

Deno.test("parses qualified named type refs", () => {
  const type = parseTypeRefWith(
    parserFor([identifier("RL"), punct("."), identifier("Color"), eof()]),
  );

  assertText(typeName(type), "RL.Color");
});

Deno.test("parses canonical pointer and reference type refs", () => {
  const pointer = parseTypeRefWith(
    parserFor([identifier("Ptr"), punct("<"), identifier("i32"), punct(">"), eof()]),
  );
  const reference = parseTypeRefWith(
    parserFor([identifier("Ref"), punct("<"), identifier("i32"), punct(">"), eof()]),
  );
  const trailing = parseTypeRefWith(
    parserFor([identifier("Ptr"), punct("<"), identifier("i32"), punct(","), punct(">"), eof()]),
  );

  assertText(typeName(pointer), "i32*");
  assertText(typeName(reference), "i32&");
  assertText(typeName(trailing), "i32*");
});

Deno.test("parses canonical array type refs", () => {
  const inferred = parseTypeRefWith(
    parserFor([identifier("Array"), punct("<"), identifier("i32"), punct(">"), eof()]),
  );
  const fixed = parseTypeRefWith(
    parserFor([
      identifier("Array"),
      punct("<"),
      identifier("i32"),
      punct(","),
      integer("16"),
      punct(">"),
      eof(),
    ]),
  );

  assertText(typeName(inferred), "i32[]");
  assertText(typeName(fixed), "i32[16]");
});

Deno.test("parses function type refs", () => {
  const fn = parseTypeRefWith(
    parserFor([
      punct("("),
      identifier("value"),
      punct(":"),
      identifier("i32"),
      punct(")"),
      operator("=>"),
      identifier("i32"),
      eof(),
    ]),
  );
  const trailing = parseTypeRefWith(
    parserFor([
      punct("("),
      identifier("value"),
      punct(":"),
      identifier("i32"),
      punct(","),
      punct(")"),
      operator("=>"),
      identifier("i32"),
      eof(),
    ]),
  );

  assertText(typeName(fn), "(value: i32) => i32");
  assertText(typeName(trailing), "(value: i32) => i32");
});

Deno.test("parses parenthesized type refs", () => {
  const scalar = parseTypeRefWith(parserFor([punct("("), identifier("i32"), punct(")"), eof()]));
  const pointer = parseTypeRefWith(
    parserFor([punct("("), identifier("i32"), punct(")"), punct("*"), eof()]),
  );

  assertText(typeName(scalar), "i32");
  assertText(typeName(pointer), "i32*");
});

Deno.test("parses safe pointer type refs", () => {
  const type = parseTypeRefWith(
    parserFor([identifier("SafePtr"), punct("<"), identifier("i32"), punct(">"), eof()]),
  );

  assertText(typeName(type), "SafePtr<i32>");
});

Deno.test("parses canonical slice type refs", () => {
  const slice = parseTypeRefWith(
    parserFor([identifier("Slice"), punct("<"), identifier("i32"), punct(">"), eof()]),
  );

  assertText(typeName(slice), "Slice<i32>");
});

Deno.test("parses optional type spelling", () => {
  const optional = parseTypeRefWith(parserFor([identifier("i32"), punct("?"), eof()]));
  const optionalArray = parseTypeRefWith(
    parserFor([identifier("i32"), punct("?"), punct("["), punct("]"), eof()]),
  );

  assertText(typeName(optional), "i32?");
  assertText(typeName(optionalArray), "i32?[]");
});

function parserFor(tokens: Token[]): TypeRefParser {
  let current: i32 = 0;
  return {
    check: (kind) => peek(tokens, current).kind === kind,
    checkText: (text) => peek(tokens, current).text === text,
    matchText: (text) => {
      if (peek(tokens, current).text !== text) return false;
      current += 1;
      return true;
    },
    expectKind: (kind, message) => {
      const token = peek(tokens, current);
      if (token.kind !== kind) throw new Error(message);
      current += 1;
      return token;
    },
    expectText: (text) => {
      const token = peek(tokens, current);
      if (token.text !== text) throw new Error(`Expected '${text}'`);
      current += 1;
      return token;
    },
    previous: () => peek(tokens, current - 1),
    peek: (offset = 0) => peek(tokens, current + offset),
  };
}

function peek(tokens: Token[], index: i32): Token {
  return tokens[index] ?? eof();
}

function typeName(type: CastTypeRef): Str {
  switch (type.kind) {
    case "NamedTypeRef": {
      const args = type.typeArgs ?? [];
      if (type.name === "Optional" && args.length === 1) return `${typeName(args[0]!)}?`;
      return type.name;
    }
    case "PointerTypeRef":
      return `${typeName(type.element)}*`;
    case "ReferenceTypeRef":
      return `${typeName(type.element)}&`;
    case "SafePointerTypeRef":
      return `SafePtr<${typeName(type.element)}>`;
    case "SliceTypeRef":
      return `Slice<${typeName(type.element)}>`;
    case "InferredArrayTypeRef":
      return `${typeName(type.element)}[]`;
    case "FixedArrayTypeRef":
      return `${typeName(type.element)}[${type.sizeText}]`;
    case "TupleTypeRef":
      return `[${type.elements.map(typeName).join(", ")}]`;
    case "UnionTypeRef":
      return type.members.map(typeName).join(" | ");
    case "IntersectionTypeRef":
      return type.members.map(typeName).join(" & ");
    case "ConditionalTypeRef":
      return `${typeName(type.checkType)} extends ${typeName(type.extendsType)} ? ${
        typeName(type.trueType)
      } : ${typeName(type.falseType)}`;
    case "IndexedAccessTypeRef":
      return `${typeName(type.objectType)}[${type.indexName}]`;
    case "MappedTypeRef":
      return `{[${type.keyName} in keyof ${typeName(type.sourceType)}]:${
        typeName(type.valueType)
      }}`;
    case "FunctionTypeRef":
      return `(${
        type.params.map((param) => `${param.name}: ${typeName(param.type)}`).join(", ")
      }) => ${typeName(type.returnType)}`;
    case "RecordTypeRef":
      return `{${type.fields.map((field) => `${field.name}:${typeName(field.type)}`).join(",")}}`;
  }
}

function identifier(text: Str): Token {
  return token("identifier", text);
}

function punct(text: Str): Token {
  return token("punctuation", text);
}

function operator(text: Str): Token {
  return token("operator", text);
}

function integer(text: Str): Token {
  return token("integer", text);
}

function eof(): Token {
  return token("eof", "");
}

function token(kind: TokenKind, text: Str): Token {
  return { kind, text, span: sourceSpan };
}

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
