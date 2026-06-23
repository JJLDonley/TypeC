import type {
  CastAssignmentOperator,
  CastBlockStmt,
  CastExpression,
  CastIncDecOperator,
  CastStatement,
  CastSwitchCase,
  CastSwitchDefaultCase,
  CastTypeRef,
} from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;
type i32 = number;

export interface StatementParser {
  check(kind: TokenKind): b8;
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  advance(): Token;
  expectKind(kind: TokenKind, message: Str): Token;
  expectText(text: Str): Token;
  previous(): Token;
  peek(offset?: i32): Token;
  error(token: Token, message: Str): void;
  parseExpression(): CastExpression;
  parseTypeRef(): CastTypeRef;
  parseBlock(): CastBlockStmt;
}

export function parseStatementWith(parser: StatementParser): CastStatement {
  if (parser.checkText("return")) return parseReturn(parser);
  if (parser.checkText("defer")) return parseDefer(parser);
  if (parser.checkText("break")) return parseBreak(parser);
  if (parser.checkText("switch")) return parseSwitch(parser);
  if (parser.checkText("if")) return parseIf(parser);
  if (parser.checkText("while")) return parseWhile(parser);
  if (parser.checkText("do")) return parseDoWhile(parser);
  if (isVariableDeclarationStart(parser)) return parseVarDecl(parser);
  if (isIncDecStart(parser)) return parseIncDec(parser);
  if (isAssignmentStart(parser)) return parseAssignment(parser);
  return parseExpressionStatement(parser);
}

function parseExpressionStatement(parser: StatementParser): CastStatement {
  const expression = parser.parseExpression();
  const semi = parser.expectText(";");
  return { kind: "ExpressionStmt", expression, span: span(expression.span.start, semi.span.end) };
}

function parseReturn(parser: StatementParser): CastStatement {
  const start = parser.expectText("return");
  const expression = parser.checkText(";") ? null : parser.parseExpression();
  const semi = parser.expectText(";");
  return { kind: "ReturnStmt", expression, span: span(start.span.start, semi.span.end) };
}

function parseDefer(parser: StatementParser): CastStatement {
  const start = parser.expectText("defer");
  const expression = parser.parseExpression();
  const semi = parser.expectText(";");
  if (expression.kind !== "CallExpr" && expression.kind !== "MethodCallExpr") {
    parser.error(start, "Defer statement requires a call expression");
  }
  return { kind: "DeferStmt", expression, span: span(start.span.start, semi.span.end) };
}

function parseBreak(parser: StatementParser): CastStatement {
  const start = parser.expectText("break");
  const semi = parser.expectText(";");
  return { kind: "BreakStmt", span: span(start.span.start, semi.span.end) };
}

function parseSwitch(parser: StatementParser): CastStatement {
  const start = parser.expectText("switch");
  const expression = parseCondition(parser);
  parser.expectText("{");
  const cases: CastSwitchCase[] = [];
  let defaultCase: CastSwitchDefaultCase | null = null;
  while (!parser.checkText("}") && !parser.check("eof")) {
    if (parser.checkText("default")) {
      const parsedDefault = parseSwitchDefault(parser);
      if (defaultCase !== null) parser.error(parser.previous(), "Duplicate default case");
      defaultCase = defaultCase ?? parsedDefault;
    } else {
      cases.push(parseSwitchCase(parser));
    }
  }
  const close = parser.expectText("}");
  return {
    kind: "SwitchStmt",
    expression,
    cases,
    defaultCase,
    span: span(start.span.start, close.span.end),
  };
}

function parseSwitchCase(parser: StatementParser): CastSwitchCase {
  const labels: CastExpression[] = [];
  const start = parser.expectText("case");
  labels.push(parseSwitchLabel(parser));
  while (parser.checkText("case")) {
    parser.expectText("case");
    labels.push(parseSwitchLabel(parser));
  }
  const statements = parseSwitchStatements(parser);
  const end = statements.at(-1)?.span.end ?? labels.at(-1)?.span.end ?? start.span.end;
  return { labels, statements, span: span(start.span.start, end) };
}

function parseSwitchLabel(parser: StatementParser): CastExpression {
  const label = parser.parseExpression();
  parser.expectText(":");
  return label;
}

function parseSwitchDefault(parser: StatementParser): CastSwitchDefaultCase {
  const start = parser.expectText("default");
  parser.expectText(":");
  const statements = parseSwitchStatements(parser);
  const end = statements.at(-1)?.span.end ?? start.span.end;
  return { statements, span: span(start.span.start, end) };
}

function parseSwitchStatements(parser: StatementParser): CastStatement[] {
  const statements: CastStatement[] = [];
  while (
    !parser.checkText("case") && !parser.checkText("default") && !parser.checkText("}") &&
    !parser.check("eof")
  ) {
    statements.push(parseStatementWith(parser));
  }
  return statements;
}

function parseIf(parser: StatementParser): CastStatement {
  const start = parser.expectText("if");
  const condition = parseCondition(parser);
  const thenBody = parser.parseBlock();
  const elseBody = parser.matchText("else") ? parser.parseBlock() : null;
  const end = elseBody?.span.end ?? thenBody.span.end;
  return { kind: "IfStmt", condition, thenBody, elseBody, span: span(start.span.start, end) };
}

function parseWhile(parser: StatementParser): CastStatement {
  const start = parser.expectText("while");
  const condition = parseCondition(parser);
  const body = parser.parseBlock();
  return { kind: "WhileStmt", condition, body, span: span(start.span.start, body.span.end) };
}

function parseDoWhile(parser: StatementParser): CastStatement {
  const start = parser.expectText("do");
  const body = parser.parseBlock();
  parser.expectText("while");
  const condition = parseCondition(parser);
  const semi = parser.expectText(";");
  return { kind: "DoWhileStmt", body, condition, span: span(start.span.start, semi.span.end) };
}

function parseCondition(parser: StatementParser): CastExpression {
  parser.expectText("(");
  const condition = parser.parseExpression();
  parser.expectText(")");
  return condition;
}

function parseAssignment(parser: StatementParser): CastStatement {
  const name = parser.expectKind("identifier", "Expected assignment target");
  const operator = parseAssignmentOperator(parser);
  const expression = parser.parseExpression();
  const semi = parser.expectText(";");
  return {
    kind: "AssignmentStmt",
    name: name.text,
    operator,
    expression,
    span: span(name.span.start, semi.span.end),
  };
}

function parseAssignmentOperator(parser: StatementParser): CastAssignmentOperator {
  const token = parser.advance();
  if (isAssignmentOperator(token.text)) return token.text;
  parser.error(token, "Expected assignment operator");
  return "=";
}

function parseIncDec(parser: StatementParser): CastStatement {
  return isIncDecOperator(parser.peek().text)
    ? parsePrefixIncDec(parser)
    : parsePostfixIncDec(parser);
}

function parsePrefixIncDec(parser: StatementParser): CastStatement {
  const operatorToken = parser.advance();
  const operator = parseIncDecOperator(operatorToken);
  const name = parser.expectKind("identifier", "Expected increment target");
  const semi = parser.expectText(";");
  return {
    kind: "IncDecStmt",
    name: name.text,
    operator,
    span: span(operatorToken.span.start, semi.span.end),
  };
}

function parsePostfixIncDec(parser: StatementParser): CastStatement {
  const name = parser.expectKind("identifier", "Expected increment target");
  const operator = parseIncDecOperator(parser.advance());
  const semi = parser.expectText(";");
  return {
    kind: "IncDecStmt",
    name: name.text,
    operator,
    span: span(name.span.start, semi.span.end),
  };
}

function parseIncDecOperator(token: Token): CastIncDecOperator {
  if (isIncDecOperator(token.text)) return token.text;
  return "++";
}

function isIncDecOperator(text: Str): text is CastIncDecOperator {
  return text === "++" || text === "--";
}

function isAssignmentOperator(text: Str): text is CastAssignmentOperator {
  return text === "=" || text === "+=" || text === "-=" || text === "*=" || text === "/=" ||
    text === "%=" || text === "<<=" || text === ">>=" || text === ">>>=" || text === "&=" ||
    text === "^=" || text === "|=";
}

function parseVarDecl(parser: StatementParser): CastStatement {
  const keyword = parser.advance();
  const name = parser.expectKind("identifier", "Expected variable name");
  parser.expectText(":");
  const type = parser.parseTypeRef();
  parser.expectText("=");
  const initializer = parser.parseExpression();
  const semi = parser.expectText(";");
  return {
    kind: "VarDeclStmt",
    mutable: keyword.text === "let",
    name: name.text,
    type,
    initializer,
    span: span(keyword.span.start, semi.span.end),
  };
}

function isVariableDeclarationStart(parser: StatementParser): b8 {
  return parser.checkText("let") || parser.checkText("const");
}

function isAssignmentStart(parser: StatementParser): b8 {
  return parser.check("identifier") && isAssignmentOperator(parser.peek(1).text);
}

function isIncDecStart(parser: StatementParser): b8 {
  return isPrefixIncDecStart(parser) || isPostfixIncDecStart(parser);
}

function isPrefixIncDecStart(parser: StatementParser): b8 {
  return isIncDecOperator(parser.peek().text) && parser.peek(1).kind === "identifier";
}

function isPostfixIncDecStart(parser: StatementParser): b8 {
  return parser.check("identifier") && isIncDecOperator(parser.peek(1).text);
}
