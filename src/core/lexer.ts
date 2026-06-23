import type { Diagnostic, SourcePos } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { keywords, type Token } from "core/token.ts";

type i32 = number;
type Str = string;
type b8 = boolean;

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
        const text = this.readNumber();
        this.tokens.push({
          kind: text.includes(".") ? "float" : "integer",
          text,
          span: { start, end: this.pos() },
        });
        continue;
      }

      if (ch === '"') {
        const text = this.readString(start);
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

      if (ch === "?" && this.peek(1) === "?") {
        const text = this.advance() + this.advance();
        this.tokens.push({ kind: "operator", text, span: { start, end: this.pos() } });
        continue;
      }

      if ("(){}[]:;,\.?".includes(ch)) {
        this.advance();
        this.tokens.push({ kind: "punctuation", text: ch, span: { start, end: this.pos() } });
        continue;
      }

      if ("+-*/=%<>!&".includes(ch)) {
        let text = this.advance();
        if (text === "=" && this.peek() === ">") {
          text += this.advance();
        } else if (
          (text === "=" || text === "!" || text === "<" || text === ">") && this.peek() === "="
        ) {
          text += this.advance();
        }
        this.tokens.push({ kind: "operator", text, span: { start, end: this.pos() } });
        continue;
      }

      this.diagnostics.push({
        message: `Unexpected character '${ch}'`,
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

  private readNumber(): Str {
    let text = this.readWhile(isDigit);
    if (this.peek() === "." && isDigit(this.peek(1))) {
      text += this.advance();
      text += this.readWhile(isDigit);
    }
    return text;
  }

  private readString(start: SourcePos): Str {
    this.advance();
    let text = "";
    while (!this.isAtEnd() && this.peek() !== '"') {
      if (this.peek() === "\n") {
        this.diagnostics.push({
          message: "Unterminated string literal",
          span: { start, end: this.pos() },
        });
        return text;
      }
      text += this.advance();
    }
    if (this.isAtEnd()) {
      this.diagnostics.push({
        message: "Unterminated string literal",
        span: { start, end: this.pos() },
      });
      return text;
    }
    this.advance();
    return text;
  }

  private readWhile(pred: (ch: Str) => b8): Str {
    let text = "";
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
