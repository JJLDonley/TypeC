import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;

export type TokenKind =
  | "identifier"
  | "integer"
  | "float"
  | "string"
  | "keyword"
  | "punctuation"
  | "operator"
  | "eof";

export interface Token {
  kind: TokenKind;
  text: Str;
  span: SourceSpan;
}

export const keywords = new Set([
  "function",
  "return",
  "let",
  "const",
  "if",
  "else",
  "while",
  "true",
  "false",
  "type",
  "import",
  "export",
]);

export const primitiveTypes = new Set([
  "bool",
  "i8",
  "i16",
  "i32",
  "i64",
  "u8",
  "u16",
  "u32",
  "u64",
  "usize",
  "f32",
  "f64",
  "void",
  "c_char",
  "c_schar",
  "c_uchar",
  "c_short",
  "c_ushort",
  "c_int",
  "c_uint",
  "c_long",
  "c_ulong",
  "c_longlong",
  "c_ulonglong",
  "c_float",
  "c_double",
]);
