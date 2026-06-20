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
  return parseFloatMacroValue(unwrapped) ?? parseIntegerMacroValue(unwrapped) ??
    parseNumericExpressionMacroValue(unwrapped);
}

function unwrapParentheses(value: Str): Str {
  if (!value.startsWith("(") || !value.endsWith(")")) return value;
  return value.slice(1, -1).trim();
}

function parseFloatMacroValue(value: Str): MacroValue | null {
  if (
    !/^[+-]?(?:(?:[0-9]+\.[0-9]*|[0-9]*\.[0-9]+)(?:[eE][+-]?[0-9]+)?|[0-9]+[eE][+-]?[0-9]+)[fFlL]?$/
      .test(value)
  ) {
    return null;
  }
  const text = normalizeFloatLiteral(value.replace(/[fFlL]$/, ""));
  if (text === null) return null;
  return { type: "f64", text };
}

function parseIntegerMacroValue(value: Str): MacroValue | null {
  const match = value.match(/^([+-]?)(0[xX][0-9A-Fa-f]+|[0-9]+)([uUlL]*)$/);
  if (match === null) return null;
  const sign = match[1];
  const digits = match[2];
  const suffix = match[3];
  const type = integerMacroType(suffix, sign === "-");
  if (type === null) return null;
  return { type, text: normalizeIntegerLiteral(sign, digits) };
}

function parseNumericExpressionMacroValue(value: Str): MacroValue | null {
  if (!isNumericExpressionText(value)) return null;
  const literals = value.match(numericLiteralPattern()) ?? [];
  if (literals.length === 0) return null;
  return { type: numericExpressionType(literals), text: stripNumericSuffixes(value) };
}

function isNumericExpressionText(value: Str): b8 {
  return /^[0-9A-Fa-fxXuUlLfFeE.+\-*/%()\s]+$/.test(value) && /[+\-*/%()]/.test(value);
}

function numericExpressionType(literals: Str[]): MacroValueType {
  if (literals.some(isFloatMacroLiteral)) return "f64";
  if (
    literals.some((literal) => integerMacroType(integerLiteralSuffix(literal), false) === "u64")
  ) {
    return "u64";
  }
  if (
    literals.some((literal) => integerMacroType(integerLiteralSuffix(literal), false) === "i64")
  ) {
    return "i64";
  }
  if (
    literals.some((literal) => integerMacroType(integerLiteralSuffix(literal), false) === "u32")
  ) {
    return "u32";
  }
  return "i32";
}

function stripNumericSuffixes(value: Str): Str {
  return value.replace(numericLiteralPattern(), (literal) => stripNumericSuffix(literal));
}

function numericLiteralPattern(): RegExp {
  return /(?:0[xX][0-9A-Fa-f]+|[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?[uUlLfF]*/g;
}

function stripNumericSuffix(literal: Str): Str {
  if (isFloatMacroLiteral(literal)) {
    return normalizeFloatLiteral(literal.replace(/[fFlL]$/, "")) ?? literal;
  }
  const bare = literal.replace(/[uUlL]+$/, "");
  return normalizeIntegerLiteral("", bare);
}

function isFloatMacroLiteral(literal: Str): b8 {
  return literal.includes(".") || /[eE]/.test(literal);
}

function integerLiteralSuffix(literal: Str): Str {
  const match = literal.match(/[uUlL]+$/);
  return match?.[0] ?? "";
}

function normalizeFloatLiteral(literal: Str): Str | null {
  if (!/[eE]/.test(literal)) return literal;
  const value = Number(literal);
  if (!Number.isFinite(value)) return null;
  const text = value.toString();
  if (/[eE]/.test(text)) return null;
  return text.includes(".") ? text : `${text}.0`;
}

function normalizeIntegerLiteral(sign: Str, digits: Str): Str {
  const magnitude = digits.startsWith("0x") || digits.startsWith("0X")
    ? BigInt(digits).toString()
    : digits;
  return `${sign}${magnitude}`;
}

function integerMacroType(suffix: Str, negative: b8): MacroValueType | null {
  const lower = suffix.toLowerCase();
  if (lower.includes("u") && lower.includes("ll")) return "u64";
  if (lower.includes("u") && lower.includes("l")) return "u64";
  if (lower.includes("u")) return "u32";
  if (lower.includes("ll") || lower.includes("l")) return negative ? "i64" : "i64";
  return negative ? "i32" : "i32";
}
