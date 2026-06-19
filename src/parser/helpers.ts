import type { SourceSpan } from "core/diagnostics.ts";

type Str = string;
type i32 = number;
type f64 = number;

export function parseFloatLiteral(text: Str): f64 {
  return Number(text);
}

export function precedence(op: Str): i32 {
  switch (op) {
    case "*":
    case "/":
    case "%":
      return 20;
    case "+":
    case "-":
      return 10;
    case "<":
    case "<=":
    case ">":
    case ">=":
    case "==":
    case "!=":
      return 5;
    default:
      return -1;
  }
}

export function span(start: SourceSpan["start"], end: SourceSpan["end"]): SourceSpan {
  return { start, end };
}
