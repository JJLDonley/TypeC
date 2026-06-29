import type { FormatToken } from "formatter/tokens.ts";

type Str = string;
type b8 = boolean;
type i32 = number;
type usize = number;

export function writeFormattedTokens(tokens: FormatToken[]): Str {
  const writer = new FormatWriter(tokens);
  return writer.write();
}

class FormatWriter {
  private index: usize = 0;
  private indent: i32 = 0;
  private output: Str = "";
  private lineHasText: b8 = false;

  constructor(private readonly tokens: FormatToken[]) {}

  write(): Str {
    while (!this.isAtEnd()) this.writeToken(this.current());
    return this.output.trimEnd() + "\n";
  }

  private writeToken(token: FormatToken): void {
    if (token.kind === "comment") {
      this.writeComment(token);
      this.index += 1;
      return;
    }
    if (token.text === "{") {
      this.writeOpenBrace();
      return;
    }
    if (token.text === "}") {
      this.writeCloseBrace();
      return;
    }
    if (token.text === ";") {
      this.writeText(";");
      this.newline();
      this.index += 1;
      return;
    }
    if (token.text === ",") {
      this.writeText(",");
      this.spaceUnlessNextLineCloser();
      this.index += 1;
      return;
    }
    if (token.text === ":") {
      this.writeText(":");
      this.space();
      this.index += 1;
      return;
    }
    if (isTightPrefix(token.text)) {
      this.writeText(token.text);
      this.index += 1;
      return;
    }
    if (isTightSuffix(token.text)) {
      this.trimTrailingSpace();
      this.writeText(token.text);
      this.index += 1;
      return;
    }
    if (isSpacedOperator(token.text)) this.space();
    this.writeText(token.text);
    if (needsSpaceAfter(token, this.next())) this.space();
    this.index += 1;
  }

  private writeComment(token: FormatToken): void {
    if (this.lineHasText) this.space();
    this.writeText(token.text);
    this.newline();
  }

  private writeOpenBrace(): void {
    this.trimTrailingSpace();
    if (this.lineHasText) this.space();
    this.writeText("{");
    this.indent += 1;
    this.newline();
    this.index += 1;
  }

  private writeCloseBrace(): void {
    if (this.lineHasText) this.newline();
    this.indent = Math.max(0, this.indent - 1);
    this.writeText("}");
    this.index += 1;
    if (this.current()?.text === ";") return;
    this.newline();
  }

  private spaceUnlessNextLineCloser(): void {
    const next = this.next();
    if (next?.text === "}" || next?.text === ")" || next?.text === "]") return;
    this.space();
  }

  private writeText(text: Str): void {
    if (!this.lineHasText) this.output += "  ".repeat(this.indent);
    this.output += text;
    this.lineHasText = true;
  }

  private newline(): void {
    this.trimTrailingSpace();
    if (!this.output.endsWith("\n")) this.output += "\n";
    this.lineHasText = false;
  }

  private space(): void {
    if (this.lineHasText && !this.output.endsWith(" ") && !this.output.endsWith("\n")) {
      this.output += " ";
    }
  }

  private trimTrailingSpace(): void {
    while (this.output.endsWith(" ")) this.output = this.output.slice(0, -1);
  }

  private current(): FormatToken {
    return this.tokens[this.index];
  }

  private next(): FormatToken | null {
    return this.tokens[this.index + 1] ?? null;
  }

  private isAtEnd(): b8 {
    return this.index >= this.tokens.length;
  }
}

function isTightPrefix(text: Str): b8 {
  return text === "(" || text === "[" || text === "." || text === "?.";
}

function isTightSuffix(text: Str): b8 {
  return text === ")" || text === "]";
}

function isSpacedOperator(text: Str): b8 {
  return [
    "=",
    "+=",
    "-=",
    "*=",
    "/=",
    "%=",
    "==",
    "!=",
    "<",
    ">",
    "<=",
    ">=",
    "+",
    "-",
    "*",
    "/",
    "%",
    "&&",
    "||",
    "??",
    "=>",
    "|",
    "&",
    "^",
    "<<",
    ">>",
  ].includes(text);
}

function needsSpaceAfter(token: FormatToken, next: FormatToken | null): b8 {
  if (next === null) return false;
  if (token.kind === "word") {
    return next.kind === "word" || isControlKeywordBeforeGroup(token, next);
  }
  if (token.kind === "string") return next.kind === "word";
  return isSpacedOperator(token.text);
}

function isControlKeywordBeforeGroup(token: FormatToken, next: FormatToken): b8 {
  return ["if", "while", "for", "switch", "match"].includes(token.text) && next.text === "(";
}
