import type { CHeaderConstant } from "c/header/ast.ts";
import { isTypeCIdentifier } from "c/header/identifiers.ts";

type Str = string;
type b8 = boolean;

type MacroValueType = "i32" | "u32" | "i64" | "u64" | "f64";

export function collectHeaderMacroConstants(
  source: Str,
  sourceFile: Str | null,
): CHeaderConstant[] {
  return source.split(/\r?\n/).flatMap((line) => readHeaderMacroConstant(line, sourceFile));
}

function readHeaderMacroConstant(line: Str, sourceFile: Str | null): CHeaderConstant[] {
  const macro = parseObjectLikeMacro(line);
  if (macro === null) return [];
  const value = parseMacroValue(macro.value);
  if (value === null) return [];
  return [{ name: macro.name, type: value.type, value: value.text, sourceFile }];
}

interface ObjectLikeMacro {
  name: Str;
  value: Str;
}

function parseObjectLikeMacro(line: Str): ObjectLikeMacro | null {
  const match = line.match(/^\s*#\s*define\s+([A-Za-z_][A-Za-z0-9_]*)(.*)$/);
  if (match === null) return null;
  const name = match[1];
  if (!isTypeCIdentifier(name)) return null;
  const rest = match[2];
  if (rest.startsWith("(")) return null;
  return { name, value: removeTrailingComment(rest).trim() };
}

function removeTrailingComment(text: Str): Str {
  return text.replace(/\/\/.*$/, "").trimEnd();
}

interface MacroValue {
  type: MacroValueType;
  text: Str;
}

function parseMacroValue(value: Str): MacroValue | null {
  const unwrapped = unwrapParentheses(value.trim());
  return parseFloatMacroValue(unwrapped) ?? parseIntegerMacroValue(unwrapped);
}

function unwrapParentheses(value: Str): Str {
  if (!value.startsWith("(") || !value.endsWith(")")) return value;
  return value.slice(1, -1).trim();
}

function parseFloatMacroValue(value: Str): MacroValue | null {
  if (!/^[+-]?(?:[0-9]+\.[0-9]*|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?[fFlL]?$/.test(value)) {
    return null;
  }
  return { type: "f64", text: value.replace(/[fFlL]$/, "") };
}

function parseIntegerMacroValue(value: Str): MacroValue | null {
  const match = value.match(/^([+-]?)(0[xX][0-9A-Fa-f]+|[0-9]+)([uUlL]*)$/);
  if (match === null) return null;
  const sign = match[1];
  const digits = match[2];
  const suffix = match[3];
  const type = integerMacroType(suffix, sign === "-");
  if (type === null) return null;
  return { type, text: `${sign}${digits}` };
}

function integerMacroType(suffix: Str, negative: b8): MacroValueType | null {
  const lower = suffix.toLowerCase();
  if (lower.includes("u") && lower.includes("ll")) return "u64";
  if (lower.includes("u") && lower.includes("l")) return "u64";
  if (lower.includes("u")) return "u32";
  if (lower.includes("ll") || lower.includes("l")) return negative ? "i64" : "i64";
  return negative ? "i32" : "i32";
}
