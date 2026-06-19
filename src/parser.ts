import type { Diagnostic, SourceSpan } from "./diagnostics.ts";
import { TypeCError } from "./diagnostics.ts";
import type { Program } from "./ast.ts";
import type {
  CastBlockStmt,
  CastExpression,
  CastFunctionDecl,
  CastImportDecl,
  CastParam,
  CastProgram,
  CastRecordField,
  CastStatement,
  CastTypeAliasDecl,
  CastTypeRef,
} from "./cast.ts";
import { lowerCast } from "./lower.ts";
import type { Token, TokenKind } from "./token.ts";

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
      const external = this.matchText("extern");
      if (this.checkText("import")) imports.push(this.parseImport());
      else if (this.checkText("type")) typeAliases.push(this.parseTypeAlias(exported));
      else functions.push(this.parseFunction(exported, external));
    }
    const end = this.peek().span.end;
    if (this.diagnostics.length > 0) throw new TypeCError(this.diagnostics);
    return { kind: "Program", imports, typeAliases, functions, span: { start, end } };
  }

  private parseImport(): CastImportDecl {
    const start = this.expectText("import");
    this.expectText("{");
    const names = this.parseImportNames();
    this.expectText("}");
    this.expectText("from");
    const path = this.expectKind("string", "Expected import path");
    const semi = this.expectText(";");
    return { kind: "ImportDecl", names, path: path.text, span: span(start.span.start, semi.span.end) };
  }

  private parseImportNames(): Str[] {
    const names: Str[] = [];
    if (this.checkText("}")) return names;
    do names.push(this.expectKind("identifier", "Expected imported name").text);
    while (this.matchText(","));
    return names;
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
    const params = this.parseParams();
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

  private parseParams(): CastParam[] {
    const params: CastParam[] = [];
    if (this.checkText(")")) return params;

    do {
      const name = this.expectKind("identifier", "Expected parameter name");
      this.expectText(":");
      const type = this.parseTypeRef();
      params.push({ name: name.text, type, span: span(name.span.start, type.span.end) });
    } while (this.matchText(","));

    return params;
  }

  private parseTypeRef(): CastTypeRef {
    let type: CastTypeRef = this.checkText("{") ? this.parseRecordTypeRef() : this.parseNamedTypeRef();

    while (this.isTypePostfixStart()) {
      if (this.matchText("*")) {
        type = { kind: "PointerTypeRef", element: type, span: span(type.span.start, this.previous().span.end) };
        continue;
      }
      if (this.matchText("&")) {
        type = { kind: "ReferenceTypeRef", element: type, span: span(type.span.start, this.previous().span.end) };
        continue;
      }
      type = this.parseArrayTypeRef(type);
    }

    return type;
  }

  private parseNamedTypeRef(): CastTypeRef {
    const token = this.expectKind("identifier", "Expected type name");
    return { kind: "NamedTypeRef", name: token.text, span: token.span };
  }

  private parseArrayTypeRef(element: CastTypeRef): CastTypeRef {
    this.expectText("[");
    if (this.matchText("]")) {
      return { kind: "InferredArrayTypeRef", element, span: span(element.span.start, this.previous().span.end) };
    }

    const size = this.expectKind("integer", "Expected array size");
    const close = this.expectText("]");
    return { kind: "FixedArrayTypeRef", element, sizeText: size.text, span: span(element.span.start, close.span.end) };
  }

  private parseRecordTypeRef(): CastTypeRef {
    const open = this.expectText("{");
    const fields: CastRecordField[] = [];
    while (!this.checkText("}") && !this.check("eof")) fields.push(this.parseRecordField());
    const close = this.expectText("}");
    return { kind: "RecordTypeRef", fields, span: span(open.span.start, close.span.end) };
  }

  private parseRecordField(): CastRecordField {
    const name = this.expectKind("identifier", "Expected field name");
    this.expectText(":");
    const type = this.parseTypeRef();
    const semi = this.expectText(";");
    return { name: name.text, type, span: span(name.span.start, semi.span.end) };
  }

  private isTypePostfixStart(): b8 {
    return this.checkText("*") || this.checkText("&") || this.checkText("[");
  }

  private parseBlock(): CastBlockStmt {
    const open = this.expectText("{");
    const statements: CastStatement[] = [];
    while (!this.checkText("}") && !this.check("eof")) statements.push(this.parseStatement());
    const close = this.expectText("}");
    return { kind: "BlockStmt", statements, span: span(open.span.start, close.span.end) };
  }

  private parseStatement(): CastStatement {
    if (this.checkText("return")) return this.parseReturn();
    if (this.checkText("if")) return this.parseIf();
    if (this.checkText("while")) return this.parseWhile();
    if (this.checkText("let") || this.checkText("const")) return this.parseVarDecl();
    if (this.check("identifier") && this.peek(1).text === "=") return this.parseAssignment();
    const token = this.peek();
    this.error(token, "Expected statement");
    throw new TypeCError(this.diagnostics);
  }

  private parseReturn(): CastStatement {
    const start = this.expectText("return");
    const expression = this.parseExpression();
    const semi = this.expectText(";");
    return { kind: "ReturnStmt", expression, span: span(start.span.start, semi.span.end) };
  }

  private parseIf(): CastStatement {
    const start = this.expectText("if");
    this.expectText("(");
    const condition = this.parseExpression();
    this.expectText(")");
    const thenBody = this.parseBlock();
    const elseBody = this.matchText("else") ? this.parseBlock() : null;
    const end = elseBody?.span.end ?? thenBody.span.end;
    return { kind: "IfStmt", condition, thenBody, elseBody, span: span(start.span.start, end) };
  }

  private parseWhile(): CastStatement {
    const start = this.expectText("while");
    this.expectText("(");
    const condition = this.parseExpression();
    this.expectText(")");
    const body = this.parseBlock();
    return { kind: "WhileStmt", condition, body, span: span(start.span.start, body.span.end) };
  }

  private parseAssignment(): CastStatement {
    const name = this.expectKind("identifier", "Expected assignment target");
    this.expectText("=");
    const expression = this.parseExpression();
    const semi = this.expectText(";");
    return { kind: "AssignmentStmt", name: name.text, expression, span: span(name.span.start, semi.span.end) };
  }

  private parseVarDecl(): CastStatement {
    const keyword = this.advance();
    const name = this.expectKind("identifier", "Expected variable name");
    this.expectText(":");
    const type = this.parseTypeRef();
    this.expectText("=");
    const initializer = this.parseExpression();
    const semi = this.expectText(";");
    return {
      kind: "VarDeclStmt",
      mutable: keyword.text === "let",
      name: name.text,
      type,
      initializer,
      span: span(keyword.span.start, semi.span.end),
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
    let expr = this.parsePrimary();
    while (this.checkText(".*") || this.checkText(".&") || this.checkText(".") || this.checkText("[")) {
      if (this.checkText(".")) {
        const field = this.parseFieldAccessName();
        expr = { kind: "FieldAccessExpr", operand: expr, field: field.text, span: span(expr.span.start, field.span.end) };
        continue;
      }
      if (this.checkText("[")) {
        const close = this.parseIndexClose();
        expr = { kind: "IndexExpr", operand: expr, index: close.index, span: span(expr.span.start, close.end.span.end) };
        continue;
      }
      const op = this.advance();
      expr = { kind: "PostfixPointerExpr", operator: op.text as ".*" | ".&", operand: expr, span: span(expr.span.start, op.span.end) };
    }
    return expr;
  }

  private parseFieldAccessName(): Token {
    this.expectText(".");
    return this.expectKind("identifier", "Expected field name");
  }

  private parseIndexClose(): { index: CastExpression; end: Token } {
    this.expectText("[");
    const index = this.parseExpression();
    const end = this.expectText("]");
    return { index, end };
  }

  private parsePrimary(): CastExpression {
    if (this.check("integer")) {
      const token = this.advance();
      return { kind: "IntegerLiteral", value: BigInt(token.text), text: token.text, span: token.span };
    }
    if (this.check("float")) {
      const token = this.advance();
      return { kind: "FloatLiteral", value: Number(token.text), text: token.text, span: token.span };
    }
    if (this.checkText("true") || this.checkText("false")) {
      const token = this.advance();
      return { kind: "BoolLiteral", value: token.text === "true", text: token.text as "true" | "false", span: token.span };
    }
    if (this.check("identifier")) return this.parseIdentifierExpression();
    if (this.checkText("{")) return this.parseRecordLiteral();
    if (this.checkText("[")) return this.parseArrayLiteral();
    if (this.matchText("(")) {
      const expr = this.parseExpression();
      this.expectText(")");
      return expr;
    }
    const token = this.peek();
    this.error(token, "Expected expression");
    throw new TypeCError(this.diagnostics);
  }

  private parseArrayLiteral(): CastExpression {
    const open = this.expectText("[");
    const elements = [];
    if (!this.checkText("]")) {
      do {
        if (this.checkText("]")) break;
        elements.push(this.parseExpression());
      } while (this.matchText(","));
    }
    const close = this.expectText("]");
    return { kind: "ArrayLiteralExpr", elements, span: span(open.span.start, close.span.end) };
  }

  private parseRecordLiteral(): CastExpression {
    const open = this.expectText("{");
    const fields = [];
    if (!this.checkText("}")) {
      do {
        if (this.checkText("}")) break;
        fields.push(this.parseRecordLiteralField());
      } while (this.matchText(","));
    }
    const close = this.expectText("}");
    return { kind: "RecordLiteralExpr", fields, span: span(open.span.start, close.span.end) };
  }

  private parseRecordLiteralField(): Extract<CastExpression, { kind: "RecordLiteralExpr" }>["fields"][number] {
    const name = this.expectKind("identifier", "Expected field name");
    this.expectText(":");
    const expression = this.parseExpression();
    return { name: name.text, expression, span: span(name.span.start, expression.span.end) };
  }

  private parseIdentifierExpression(): CastExpression {
    const ident = this.advance();
    if (!this.matchText("(")) return { kind: "IdentifierExpr", name: ident.text, span: ident.span };

    const args: CastExpression[] = [];
    if (!this.checkText(")")) {
      do args.push(this.parseExpression());
      while (this.matchText(","));
    }
    const close = this.expectText(")");
    return { kind: "CallExpr", callee: ident.text, args, span: span(ident.span.start, close.span.end) };
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

function precedence(op: Str): i32 {
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

function span(start: SourceSpan["start"], end: SourceSpan["end"]): SourceSpan {
  return { start, end };
}
