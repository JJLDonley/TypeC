import {
  LEX_NUMERIC_SEPARATOR,
  LEX_TEMPLATE_INTERPOLATION,
  LEX_UNEXPECTED_CHARACTER,
  LEX_UNTERMINATED_BLOCK_COMMENT,
  LEX_UNTERMINATED_STRING,
  LEX_UNTERMINATED_TEMPLATE,
} from "core/diagnostic_codes.ts";
import type { Diagnostic, SourcePos } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { type StaticTemplateText, staticTemplateText } from "core/static_template_literals.ts";
import { keywords, type Token } from "core/token.ts";

type i32 = number;
type Str = string;
type b8 = boolean;

interface NumericLiteralLexeme {
  text: Str;
  isFloat: b8;
}

export function lex(source: Str): Token[] {
  const lexer = new Lexer(source);
  return lexer.lex();
}

class Lexer {
  private offset = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];
  private diagnostics: Diagnostic[] = [];

  constructor(private source: Str) {}

  lex(): Token[] {
    while (!this.isAtEnd()) {
      this.skipTrivia();
      if (this.isAtEnd()) break;

      const start = this.pos();
      const ch = this.peek();

      if (isAlpha(ch) || ch === "_") {
        const text = this.readWhile((c) => isAlphaNum(c) || c === "_");
        this.tokens.push({
          kind: keywords.has(text) ? "keyword" : "identifier",
          text,
          span: { start, end: this.pos() },
        });
        continue;
      }

      if (isDigit(ch)) {
        const literal = this.readNumber(start);
        this.tokens.push({
          kind: literal.isFloat ? "float" : "integer",
          text: literal.text,
          span: { start, end: this.pos() },
        });
        continue;
      }

      if (ch === '"' || ch === "'") {
        const text: Str = this.readString(start, ch);
        this.tokens.push({ kind: "string", text, span: { start, end: this.pos() } });
        continue;
      }

      if (ch === "`") {
        const text: Str = this.readTemplateString(start);
        this.tokens.push({ kind: "string", text, span: { start, end: this.pos() } });
        continue;
      }

      if (ch === "." && this.peek(1) === "." && this.peek(2) === ".") {
        const text = this.advance() + this.advance() + this.advance();
        this.tokens.push({ kind: "operator", text, span: { start, end: this.pos() } });
        continue;
      }

      if (ch === "." && (this.peek(1) === "*" || this.peek(1) === "&")) {
        const text = this.advance() + this.advance();
        this.tokens.push({ kind: "operator", text, span: { start, end: this.pos() } });
        continue;
      }

      if (ch === "?" && this.peek(1) === ".") {
        const text = this.advance() + this.advance();
        this.tokens.push({ kind: "operator", text, span: { start, end: this.pos() } });
        continue;
      }

      if (ch === "?" && this.peek(1) === "?") {
        const text = this.advance() + this.advance();
        this.tokens.push({ kind: "operator", text, span: { start, end: this.pos() } });
        continue;
      }

      if ("(){}[]:;,.?@".includes(ch)) {
        this.advance();
        this.tokens.push({ kind: "punctuation", text: ch, span: { start, end: this.pos() } });
        continue;
      }

      if ("+-*/=%<>!&|^~".includes(ch)) {
        const text = this.readOperator();
        this.tokens.push({ kind: "operator", text, span: { start, end: this.pos() } });
        continue;
      }

      this.diagnostics.push({
        message: `Unexpected character '${ch}'`,
        code: LEX_UNEXPECTED_CHARACTER,
        span: { start, end: start },
      });
      this.advance();
    }

    const eof = this.pos();
    this.tokens.push({ kind: "eof", text: "", span: { start: eof, end: eof } });

    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return this.tokens;
  }

  private skipTrivia(): void {
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance();
        continue;
      }
      if (ch === "/" && this.peek(1) === "/") {
        while (!this.isAtEnd() && this.peek() !== "\n") this.advance();
        continue;
      }
      if (ch === "/" && this.peek(1) === "*") {
        const start = this.pos();
        this.advance();
        this.advance();
        while (!this.isAtEnd() && !(this.peek() === "*" && this.peek(1) === "/")) this.advance();
        if (this.isAtEnd()) {
          this.diagnostics.push({
            message: "Unterminated block comment",
            code: LEX_UNTERMINATED_BLOCK_COMMENT,
            span: { start, end: this.pos() },
          });
          return;
        }
        this.advance();
        this.advance();
        continue;
      }
      return;
    }
  }

  private readNumber(start: SourcePos): NumericLiteralLexeme {
    let text: Str = this.readNumberDigits(start);
    let isFloat: b8 = false;
    if (this.peek() === "." && isDigit(this.peek(1))) {
      isFloat = true;
      text += this.advance();
      text += this.readNumberDigits(start);
    }
    return { text, isFloat };
  }

  private readNumberDigits(start: SourcePos): Str {
    let text: Str = "";
    while (isDigit(this.peek()) || this.peek() === "_") {
      if (this.peek() === "_") {
        this.readNumericSeparator(start);
        continue;
      }
      text += this.advance();
    }
    return text;
  }

  private readNumericSeparator(start: SourcePos): void {
    const next: Str = this.peek(1);
    if (!isDigit(next)) {
      this.diagnostics.push({
        message: "Numeric separators must appear between digits",
        code: LEX_NUMERIC_SEPARATOR,
        span: { start, end: this.pos() },
      });
    }
    this.advance();
  }

  private readOperator(): Str {
    let text = this.advance();
    if (text === "=" && this.peek() === ">") return text + this.advance();
    if (this.isShiftPrefix(text)) {
      while (this.peek() === text[0] && text.length < 3) text += this.advance();
      return this.withAssignmentSuffix(text);
    }
    if (this.isIncDecPrefix(text) && this.peek() === text) return text + this.advance();
    if (this.isLogicalPrefix(text) && this.peek() === text) return text + this.advance();
    if (this.isEqualityPrefix(text) && this.peek() === "=") return text + this.advance();
    return this.withAssignmentSuffix(text);
  }

  private withAssignmentSuffix(text: Str): Str {
    if (this.isAssignmentOperatorPrefix(text) && this.peek() === "=") return text + this.advance();
    return text;
  }

  private isAssignmentOperatorPrefix(text: Str): b8 {
    return text === "+" || text === "-" || text === "*" || text === "/" || text === "%" ||
      text === "&" || text === "|" || text === "^" || text === "<<" || text === ">>" ||
      text === ">>>";
  }

  private isShiftPrefix(text: Str): b8 {
    return (text === "<" && this.peek() === "<") || (text === ">" && this.peek() === ">");
  }

  private isIncDecPrefix(text: Str): b8 {
    return text === "+" || text === "-";
  }

  private isLogicalPrefix(text: Str): b8 {
    return text === "&" || text === "|";
  }

  private isEqualityPrefix(text: Str): b8 {
    return text === "=" || text === "!" || text === "<" || text === ">";
  }

  private readString(start: SourcePos, quote: Str): Str {
    this.advance();
    let text: Str = "";
    while (!this.isAtEnd() && this.peek() !== quote) {
      if (this.peek() === "\n") {
        this.reportUnterminatedString(start);
        return text;
      }
      text += this.peek() === "\\" ? this.readStringEscape(start) : this.advance();
    }
    if (this.isAtEnd()) {
      this.reportUnterminatedString(start);
      return text;
    }
    this.advance();
    return text;
  }

  private readStringEscape(start: SourcePos): Str {
    this.advance();
    if (this.isAtEnd()) {
      this.reportUnterminatedString(start);
      return "";
    }
    const escaped: Str = this.advance();
    switch (escaped) {
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "t":
        return "\t";
      case "0":
        return "\0";
      case "\\":
        return "\\";
      case '"':
        return '"';
      case "'":
        return "'";
    }
    return `\\${escaped}`;
  }

  private readTemplateString(start: SourcePos): Str {
    this.advance();
    let raw: Str = "";
    while (!this.isAtEnd() && this.peek() !== "`") raw += this.advance();
    if (this.isAtEnd()) {
      this.reportUnterminatedTemplateString(start);
      return raw;
    }
    this.advance();
    const result: StaticTemplateText = staticTemplateText(raw);
    if (result.error !== null) this.reportTemplateError(start, result.error);
    return result.text;
  }

  private reportUnterminatedString(start: SourcePos): void {
    this.diagnostics.push({
      message: "Unterminated string literal",
      code: LEX_UNTERMINATED_STRING,
      span: { start, end: this.pos() },
    });
  }

  private reportUnterminatedTemplateString(start: SourcePos): void {
    this.diagnostics.push({
      message: "Unterminated template literal",
      code: LEX_UNTERMINATED_TEMPLATE,
      span: { start, end: this.pos() },
    });
  }

  private reportTemplateError(start: SourcePos, message: Str): void {
    this.diagnostics.push({
      message,
      code: LEX_TEMPLATE_INTERPOLATION,
      span: { start, end: this.pos() },
    });
  }

  private readWhile(pred: (ch: Str) => b8): Str {
    let text: Str = "";
    while (!this.isAtEnd() && pred(this.peek())) text += this.advance();
    return text;
  }

  private advance(): Str {
    const ch = this.source[this.offset++]!;
    if (ch === "\n") {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private peek(n: i32 = 0): Str {
    return this.source[this.offset + n] ?? "\0";
  }

  private isAtEnd(): b8 {
    return this.offset >= this.source.length;
  }

  private pos(): SourcePos {
    return { offset: this.offset, line: this.line, column: this.column };
  }
}

function isAlpha(ch: Str): b8 {
  return /[A-Za-z]/.test(ch);
}

function isAlphaNum(ch: Str): b8 {
  return /[A-Za-z0-9]/.test(ch);
}

function isDigit(ch: Str): b8 {
  return /[0-9]/.test(ch);
}
