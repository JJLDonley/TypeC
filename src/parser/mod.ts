import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { Program } from "core/ast.ts";
import type {
  CastBlockStmt,
  CastExpression,
  CastFunctionDecl,
  CastImportDecl,
  CastProgram,
  CastStatement,
  CastTypeAliasDecl,
  CastTypeRef,
} from "core/cast.ts";
import { lowerCast } from "lower";
import { parseArrayLiteralWith, parseRecordLiteralWith, type AggregateLiteralParser } from "parser/aggregate_literals.ts";
import { parseDeclarationWith, type DeclarationParser } from "parser/declarations.ts";
import { parseExpressionWith, type ExpressionParser } from "parser/expressions.ts";
import { span } from "parser/helpers.ts";
import { parsePostfixExpressionWith, type PostfixExpressionParser } from "parser/postfix_expressions.ts";
import { parsePrimaryWith, type PrimaryExpressionParser } from "parser/primary_expressions.ts";
import { parseStatementWith, type StatementParser } from "parser/statements.ts";
import { parseTypeRefWith } from "parser/type_refs.ts";
import type { Token, TokenKind } from "core/token.ts";

type i32 = number;
type Str = string;
type b8 = boolean;

export function parse(tokens: Token[]): Program {
  return lowerCast(parseCast(tokens));
}

export function parseCast(tokens: Token[]): CastProgram {
  return new Parser(tokens).parseProgram();
}

class Parser {
  private current: i32 = 0;
  private diagnostics: Diagnostic[] = [];

  constructor(private tokens: Token[]) {}

  parseProgram(): CastProgram {
    const start = this.peek().span.start;
    const imports: CastImportDecl[] = [];
    const typeAliases: CastTypeAliasDecl[] = [];
    const functions: CastFunctionDecl[] = [];
    while (!this.check("eof")) {
      const declaration = parseDeclarationWith(this.declarationParser());
      if (declaration.kind === "ImportDecl") imports.push(declaration);
      if (declaration.kind === "TypeAliasDecl") typeAliases.push(declaration);
      if (declaration.kind === "FunctionDecl") functions.push(declaration);
    }
    const end = this.peek().span.end;
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return { kind: "Program", imports, typeAliases, functions, span: { start, end } };
  }

  private declarationParser(): DeclarationParser {
    return {
      diagnostics: () => this.diagnostics,
      checkText: (text) => this.checkText(text),
      matchText: (text) => this.matchText(text),
      previous: () => this.previous(),
      expectKind: (kind, message) => this.expectKind(kind, message),
      expectText: (text) => this.expectText(text),
      peek: () => this.peek(),
      error: (token, message) => this.error(token, message),
      parseTypeRef: () => this.parseTypeRef(),
      parseBlock: () => this.parseBlock(),
    };
  }

  private parseTypeRef(): CastTypeRef {
    return parseTypeRefWith({
      check: (kind) => this.check(kind),
      checkText: (text) => this.checkText(text),
      matchText: (text) => this.matchText(text),
      expectKind: (kind, message) => this.expectKind(kind, message),
      expectText: (text) => this.expectText(text),
      previous: () => this.previous(),
    });
  }

  private parseBlock(): CastBlockStmt {
    const open = this.expectText("{");
    const statements: CastStatement[] = [];
    while (!this.checkText("}") && !this.check("eof")) statements.push(this.parseStatement());
    const close = this.expectText("}");
    return { kind: "BlockStmt", statements, span: span(open.span.start, close.span.end) };
  }

  private parseStatement(): CastStatement {
    return parseStatementWith(this.statementParser());
  }

  private statementParser(): StatementParser {
    return {
      check: (kind) => this.check(kind),
      checkText: (text) => this.checkText(text),
      matchText: (text) => this.matchText(text),
      advance: () => this.advance(),
      expectKind: (kind, message) => this.expectKind(kind, message),
      expectText: (text) => this.expectText(text),
      peek: (offset = 0) => this.peek(offset),
      parseExpression: () => this.parseExpression(),
      parseTypeRef: () => this.parseTypeRef(),
      parseBlock: () => this.parseBlock(),
    };
  }

  private parseExpression(minPrecedence: i32 = 0): CastExpression {
    return parseExpressionWith(this.expressionParser(), minPrecedence);
  }

  private expressionParser(): ExpressionParser {
    return {
      check: (kind) => this.check(kind),
      peek: () => this.peek(),
      advance: () => this.advance(),
      parsePostfixExpression: () => this.parsePostfixExpression(),
    };
  }

  private parsePostfixExpression(): CastExpression {
    return parsePostfixExpressionWith(this.postfixExpressionParser());
  }

  private postfixExpressionParser(): PostfixExpressionParser {
    return {
      checkText: (text) => this.checkText(text),
      advance: () => this.advance(),
      expectText: (text) => this.expectText(text),
      expectKind: (kind, message) => this.expectKind(kind, message),
      parsePrimary: () => this.parsePrimary(),
      parseExpression: () => this.parseExpression(),
    };
  }

  private parsePrimary(): CastExpression {
    return parsePrimaryWith(this.primaryExpressionParser());
  }

  private primaryExpressionParser(): PrimaryExpressionParser {
    return {
      diagnostics: () => this.diagnostics,
      check: (kind) => this.check(kind),
      checkText: (text) => this.checkText(text),
      matchText: (text) => this.matchText(text),
      advance: () => this.advance(),
      expectText: (text) => this.expectText(text),
      peek: () => this.peek(),
      error: (token, message) => this.error(token, message),
      parseExpression: () => this.parseExpression(),
      parseArrayLiteral: () => this.parseArrayLiteral(),
      parseRecordLiteral: () => this.parseRecordLiteral(),
    };
  }

  private parseArrayLiteral(): CastExpression {
    return parseArrayLiteralWith(this.aggregateLiteralParser());
  }

  private parseRecordLiteral(): CastExpression {
    return parseRecordLiteralWith(this.aggregateLiteralParser());
  }

  private aggregateLiteralParser(): AggregateLiteralParser {
    return {
      checkText: (text: Str) => this.checkText(text),
      matchText: (text: Str) => this.matchText(text),
      expectKind: (kind: TokenKind, message: Str) => this.expectKind(kind, message),
      expectText: (text: Str) => this.expectText(text),
      parseExpression: () => this.parseExpression(),
    };
  }


  private expectKind(kind: TokenKind, message: Str): Token {
    if (this.check(kind)) return this.advance();
    this.error(this.peek(), message);
    throw new TypeCError(this.diagnostics);
  }

  private expectText(text: Str): Token {
    if (this.checkText(text)) return this.advance();
    this.error(this.peek(), `Expected '${text}'`);
    throw new TypeCError(this.diagnostics);
  }

  private matchText(text: Str): b8 {
    if (!this.checkText(text)) return false;
    this.advance();
    return true;
  }

  private check(kind: TokenKind): b8 {
    return this.peek().kind === kind;
  }

  private checkText(text: Str): b8 {
    return this.peek().text === text;
  }

  private advance(): Token {
    if (!this.check("eof")) this.current++;
    return this.previous();
  }

  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  private peek(offset: i32 = 0): Token {
    return this.tokens[this.current + offset]!;
  }

  private error(token: Token, message: Str): void {
    this.diagnostics.push({ message, span: token.span });
  }
}
