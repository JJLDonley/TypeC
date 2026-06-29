type Str = string;
type b8 = boolean;
type usize = number;

export type FormatTokenKind = "word" | "string" | "comment" | "symbol";

export interface FormatToken {
  kind: FormatTokenKind;
  text: Str;
}

export function readFormatTokens(source: Str): FormatToken[] {
  const reader = new FormatTokenReader(source);
  return reader.read();
}

class FormatTokenReader {
  private offset: usize = 0;
  private tokens: FormatToken[] = [];

  constructor(private readonly source: Str) {}

  read(): FormatToken[] {
    while (!this.isAtEnd()) {
      if (this.skipWhitespace()) continue;
      if (this.readLineComment()) continue;
      if (this.readBlockComment()) continue;
      if (this.readQuotedText()) continue;
      if (this.readWord()) continue;
      if (this.readNumber()) continue;
      this.readSymbol();
    }
    return this.tokens;
  }

  private skipWhitespace(): b8 {
    if (!isWhitespace(this.peek())) return false;
    while (!this.isAtEnd() && isWhitespace(this.peek())) this.offset += 1;
    return true;
  }

  private readLineComment(): b8 {
    if (this.peek() !== "/" || this.peek(1) !== "/") return false;
    const start = this.offset;
    while (!this.isAtEnd() && this.peek() !== "\n") this.offset += 1;
    this.push("comment", this.source.slice(start, this.offset));
    return true;
  }

  private readBlockComment(): b8 {
    if (this.peek() !== "/" || this.peek(1) !== "*") return false;
    const start = this.offset;
    this.offset += 2;
    while (!this.isAtEnd() && !(this.peek() === "*" && this.peek(1) === "/")) this.offset += 1;
    if (!this.isAtEnd()) this.offset += 2;
    this.push("comment", this.source.slice(start, this.offset));
    return true;
  }

  private readQuotedText(): b8 {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'" && quote !== "`") return false;
    const start = this.offset;
    this.offset += 1;
    while (!this.isAtEnd()) {
      if (this.peek() === "\\") {
        this.offset += 2;
        continue;
      }
      if (this.peek() === quote) {
        this.offset += 1;
        break;
      }
      this.offset += 1;
    }
    this.push("string", this.source.slice(start, this.offset));
    return true;
  }

  private readWord(): b8 {
    if (!isWordStart(this.peek())) return false;
    const start = this.offset;
    while (!this.isAtEnd() && isWordPart(this.peek())) this.offset += 1;
    this.push("word", this.source.slice(start, this.offset));
    return true;
  }

  private readNumber(): b8 {
    if (!isDigit(this.peek())) return false;
    const start = this.offset;
    while (!this.isAtEnd() && (isDigit(this.peek()) || this.peek() === "_")) this.offset += 1;
    if (this.peek() === "." && isDigit(this.peek(1))) {
      this.offset += 1;
      while (!this.isAtEnd() && (isDigit(this.peek()) || this.peek() === "_")) this.offset += 1;
    }
    this.push("word", this.source.slice(start, this.offset));
    return true;
  }

  private readSymbol(): void {
    const two = this.source.slice(this.offset, this.offset + 2);
    const three = this.source.slice(this.offset, this.offset + 3);
    if (three === "...") {
      this.offset += 3;
      this.push("symbol", three);
      return;
    }
    if (isTwoCharSymbol(two)) {
      this.offset += 2;
      this.push("symbol", two);
      return;
    }
    this.push("symbol", this.peek());
    this.offset += 1;
  }

  private push(kind: FormatTokenKind, text: Str): void {
    this.tokens.push({ kind, text });
  }

  private peek(ahead: usize = 0): Str {
    return this.source[this.offset + ahead] ?? "";
  }

  private isAtEnd(): b8 {
    return this.offset >= this.source.length;
  }
}

function isWhitespace(ch: Str): b8 {
  return ch === " " || ch === "\t" || ch === "\r" || ch === "\n";
}

function isWordStart(ch: Str): b8 {
  return /^[A-Za-z_]$/.test(ch);
}

function isDigit(ch: Str): b8 {
  return /^[0-9]$/.test(ch);
}

function isWordPart(ch: Str): b8 {
  return /^[A-Za-z0-9_]$/.test(ch);
}

function isTwoCharSymbol(text: Str): b8 {
  return [
    "=>",
    "==",
    "!=",
    "<=",
    ">=",
    "&&",
    "||",
    "??",
    "?.",
    "++",
    "--",
    "+=",
    "-=",
    "*=",
    "/=",
    "%=",
    "<<",
    ">>",
    ".*",
    ".&",
  ].includes(text);
}
