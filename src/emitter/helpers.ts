type Str = string;
type usize = number;
type IntLiteralValue = bigint;

export interface IntegerLiteralText {
  value: IntLiteralValue;
  text: Str;
}

export function cArrayElementType(type: Str): Str | null {
  const match = type.match(/^(.+)\[\d+\]$/);
  return match?.[1] ?? null;
}

export function emitIntegerLiteralExpression(expr: IntegerLiteralText, expectedType: Str): Str {
  if (expectedType === "u64" && expr.value > 9223372036854775807n) return `UINT64_C(${expr.text})`;
  if (expectedType === "i64" && expr.value > 2147483647n) return `INT64_C(${expr.text})`;
  if (expectedType === "u32" && expr.value > 2147483647n) return `UINT32_C(${expr.text})`;
  return expr.text;
}

export function cPrecedence(operator: Str): usize {
  if (operator === "*" || operator === "/" || operator === "%") return 8;
  if (operator === "+" || operator === "-") return 7;
  if (operator === "<<" || operator === ">>" || operator === ">>>") return 6;
  if (operator === "<" || operator === "<=" || operator === ">" || operator === ">=") return 5;
  if (operator === "==" || operator === "!=") return 4;
  if (operator === "&") return 3;
  if (operator === "^") return 2;
  if (operator === "|") return 1;
  return 0;
}
