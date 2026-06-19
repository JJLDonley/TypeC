import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import type { Program } from "core/ast.ts";
import type {
  CastBlockStmt,
  CastExpression,
  CastFunctionDecl,
  CastImportDecl,
  CastParam,
  CastProgram,
  CastStatement,
  CastTypeAliasDecl,
  CastTypeRef,
} from "core/cast.ts";
import { lowerCast } from "lower";
import {
  functionModifierDiagnostics,
  importModifierDiagnostics,
  typeAliasModifierDiagnostics,
} from "parser/declaration_modifiers.ts";
import { parseArrayLiteralWith, parseRecordLiteralWith, type AggregateLiteralParser } from "parser/aggregate_literals.ts";
import { precedence, span } from "parser/helpers.ts";
import { parseImportNamesWith } from "parser/imports.ts";
import { parseParamsWith } from "parser/params.ts";
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
      const exported = this.matchText("export");
      const exportToken = exported ? this.previous() : null;
      const external = this.matchText("extern");
      const externToken = external ? this.previous() : null;
      if (this.checkText("import")) {
        this.diagnostics.push(...importModifierDiagnostics(exportToken, externToken));
        imports.push(this.parseImport());
      } else if (this.checkText("type")) {
        this.diagnostics.push(...typeAliasModifierDiagnostics(externToken));
        typeAliases.push(this.parseTypeAlias(exported));
      } else {
        this.diagnostics.push(...functionModifierDiagnostics(exportToken, externToken));
        functions.push(this.parseFunction(exported, external));
      }
    }
    const end = this.peek().span.end;
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return { kind: "Program", imports, typeAliases, functions, span: { start, end } };
  }

  private parseImport(): CastImportDecl {
    const start = this.expectText("import");
    this.expectText("{");
    const names = parseImportNamesWith({
      checkText: (text) => this.checkText(text),
      matchText: (text) => this.matchText(text),
      expectKind: (kind, message) => this.expectKind(kind, message),
      peek: () => this.peek(),
      error: (token, message) => this.error(token, message),
    });
    this.expectText("}");
    this.expectText("from");
    const path = this.expectKind("string", "Expected import path");
    const semi = this.expectText(";");
    return { kind: "ImportDecl", names, path: path.text, span: span(start.span.start, semi.span.end) };
  }


  private parseTypeAlias(exported: b8): CastTypeAliasDecl {
    const start = this.expectText("type");
    const name = this.expectKind("identifier", "Expected type alias name");
    this.expectText("=");
    const type = this.parseTypeRef();
    const semi = this.expectText(";");
    return { kind: "TypeAliasDecl", exported, name: name.text, type, span: span(start.span.start, semi.span.end) };
  }

  private parseFunction(exported: b8, external: b8): CastFunctionDecl {
    const functionToken = this.expectText("function");
    const name = this.expectKind("identifier", "Expected function name");
    this.expectText("(");
    const params = parseParamsWith({
      checkText: (text) => this.checkText(text),
      matchText: (text) => this.matchText(text),
      expectKind: (kind, message) => this.expectKind(kind, message),
      expectText: (text) => this.expectText(text),
      parseTypeRef: () => this.parseTypeRef(),
    });
    this.expectText(")");
    this.expectText(":");
    const returnType = this.parseTypeRef();
    if (external) return this.parseExternFunction(exported, functionToken, name.text, params, returnType);
    const body = this.parseBlock();
    return {
      kind: "FunctionDecl",
      exported,
      external,
      name: name.text,
      params,
      returnType,
      body,
      span: span(functionToken.span.start, body.span.end),
    };
  }

  private parseExternFunction(exported: b8, functionToken: Token, name: Str, params: CastParam[], returnType: CastTypeRef): CastFunctionDecl {
    const semi = this.expectText(";");
    return {
      kind: "FunctionDecl",
      exported,
      external: true,
      name,
      params,
      returnType,
      body: null,
      span: span(functionToken.span.start, semi.span.end),
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
    let expr = this.parsePostfixExpression();
    while (this.check("operator") && precedence(this.peek().text) >= minPrecedence) {
      const op = this.advance();
      const rhs = this.parseExpression(precedence(op.text) + 1);
      expr = { kind: "BinaryExpr", operator: op.text, left: expr, right: rhs, span: span(expr.span.start, rhs.span.end) };
    }
    return expr;
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
