type Str = string;
type b8 = boolean;
type usize = number;

export interface StaticTemplateText {
  text: Str;
  error: Str | null;
}

export function staticTemplateText(raw: Str): StaticTemplateText {
  let text: Str = "";
  let offset: usize = 0;
  while (offset < raw.length) {
    if (isInterpolationStart(raw, offset)) {
      const interpolation: InterpolationText = readInterpolation(raw, offset + 2);
      if (interpolation.error !== null) return { text, error: interpolation.error };
      text += interpolation.text;
      offset = interpolation.end + 1;
      continue;
    }
    text += raw[offset]!;
    offset += 1;
  }
  return { text, error: null };
}

interface InterpolationText {
  text: Str;
  end: usize;
  error: Str | null;
}

function readInterpolation(raw: Str, start: usize): InterpolationText {
  const end: usize = raw.indexOf("}", start);
  if (end < 0) return { text: "", end: raw.length, error: "Unterminated template interpolation" };
  const expression: Str = raw.slice(start, end).trim();
  const text: Str | null = staticInterpolationText(expression);
  if (text === null) {
    return {
      text: "",
      end,
      error: "Template interpolation supports only compile-time primitive and string literals",
    };
  }
  return { text, end, error: null };
}

function staticInterpolationText(expression: Str): Str | null {
  if (isQuotedLiteral(expression)) return expression.slice(1, expression.length - 1);
  if (isBoolLiteral(expression)) return expression;
  if (isNumericLiteral(expression)) return expression.replaceAll("_", "");
  return null;
}

function isInterpolationStart(raw: Str, offset: usize): b8 {
  return raw[offset] === "$" && raw[offset + 1] === "{";
}

function isQuotedLiteral(expression: Str): b8 {
  if (expression.length < 2) return false;
  const quote: Str = expression[0]!;
  return (quote === '"' || quote === "'") && expression[expression.length - 1] === quote;
}

function isBoolLiteral(expression: Str): b8 {
  return expression === "true" || expression === "false";
}

function isNumericLiteral(expression: Str): b8 {
  return /^[0-9][0-9_]*(\.[0-9][0-9_]*)?$/.test(expression);
}
