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
type CastForInitializer = Extract<
  CastStatement,
  { kind: "VarDeclStmt" | "AssignmentStmt" | "IncDecStmt" | "ExpressionStmt" }
>;
type CastForUpdate = Extract<
  CastStatement,
  { kind: "AssignmentStmt" | "IncDecStmt" | "ExpressionStmt" }
>;

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
  if (parser.checkText(";")) return parseEmpty(parser);
  if (parser.checkText("return")) return parseReturn(parser);
  if (parser.checkText("defer")) return parseDefer(parser);
  if (parser.checkText("break")) return parseBreak(parser);
  if (parser.checkText("switch")) return parseSwitch(parser);
  if (parser.checkText("if")) return parseIf(parser);
  if (parser.checkText("while")) return parseWhile(parser);
  if (parser.checkText("do")) return parseDoWhile(parser);
  if (parser.checkText("for")) return parseFor(parser);
  if (isVariableDeclarationStart(parser)) return parseVarDecl(parser);
  if (isPrefixIncDecStart(parser)) return parsePrefixIncDec(parser);
  return parseExpressionOrAssignmentStatement(parser);
}

function parseEmpty(parser: StatementParser): CastStatement {
  const semi = parser.expectText(";");
  return { kind: "EmptyStmt", span: semi.span };
}

function parseExpressionOrAssignmentStatement(
  parser: StatementParser,
  consumeSemicolon = true,
): CastStatement {
  const expression = parser.parseExpression();
  if (isAssignmentOperator(parser.peek().text)) {
    return parseAssignment(parser, expression, consumeSemicolon);
  }
  if (isIncDecOperator(parser.peek().text)) {
    return parsePostfixIncDec(parser, expression, consumeSemicolon);
  }
  const end = consumeSemicolon ? parser.expectText(";").span.end : expression.span.end;
  return { kind: "ExpressionStmt", expression, span: span(expression.span.start, end) };
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
  const elseBody = parser.matchText("else") ? parseElseBody(parser) : null;
  const end = elseBody?.span.end ?? thenBody.span.end;
  return { kind: "IfStmt", condition, thenBody, elseBody, span: span(start.span.start, end) };
}

function parseElseBody(parser: StatementParser): CastBlockStmt {
  if (!parser.checkText("if")) return parser.parseBlock();
  const statement = parseIf(parser);
  return { kind: "BlockStmt", statements: [statement], span: statement.span };
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

function parseFor(parser: StatementParser): CastStatement {
  const start = parser.expectText("for");
  parser.expectText("(");
  const initializer = parser.checkText(";")
    ? parseEmptyForInitializer(parser)
    : parseForInitializer(parser);
  const condition = parser.parseExpression();
  parser.expectText(";");
  const update = parser.checkText(")") ? null : parseForUpdate(parser);
  parser.expectText(")");
  const body = parser.parseBlock();
  return {
    kind: "ForStmt",
    initializer,
    condition,
    update,
    body,
    span: span(start.span.start, body.span.end),
  };
}

function parseEmptyForInitializer(parser: StatementParser): null {
  parser.expectText(";");
  return null;
}

function parseForInitializer(parser: StatementParser): CastForInitializer {
  if (isVariableDeclarationStart(parser)) return parseVarDecl(parser, true) as CastForInitializer;
  if (isPrefixIncDecStart(parser)) return parsePrefixIncDec(parser, true) as CastForInitializer;
  return parseExpressionOrAssignmentStatement(parser, true) as CastForInitializer;
}

function parseForUpdate(parser: StatementParser): CastForUpdate {
  if (isPrefixIncDecStart(parser)) return parsePrefixIncDec(parser, false) as CastForUpdate;
  return parseExpressionOrAssignmentStatement(parser, false) as CastForUpdate;
}

function parseCondition(parser: StatementParser): CastExpression {
  parser.expectText("(");
  const condition = parser.parseExpression();
  parser.expectText(")");
  return condition;
}

function parseAssignment(
  parser: StatementParser,
  targetExpression: CastExpression,
  consumeSemicolon = true,
): CastStatement {
  const target = assignmentTarget(parser, targetExpression);
  const operator = parseAssignmentOperator(parser);
  const expression = parser.parseExpression();
  const end = consumeSemicolon ? parser.expectText(";").span.end : expression.span.end;
  return {
    kind: "AssignmentStmt",
    target,
    operator,
    expression,
    span: span(targetExpression.span.start, end),
  };
}

function parseAssignmentOperator(parser: StatementParser): CastAssignmentOperator {
  const token = parser.advance();
  if (isAssignmentOperator(token.text)) return token.text;
  parser.error(token, "Expected assignment operator");
  return "=";
}

function parsePrefixIncDec(parser: StatementParser, consumeSemicolon = true): CastStatement {
  const operatorToken = parser.advance();
  const operator = parseIncDecOperator(operatorToken);
  const targetExpression = parser.parseExpression();
  const target = assignmentTarget(parser, targetExpression);
  const end = consumeSemicolon ? parser.expectText(";").span.end : targetExpression.span.end;
  return {
    kind: "IncDecStmt",
    target,
    operator,
    span: span(operatorToken.span.start, end),
  };
}

function parsePostfixIncDec(
  parser: StatementParser,
  targetExpression: CastExpression,
  consumeSemicolon = true,
): CastStatement {
  const target = assignmentTarget(parser, targetExpression);
  const operator = parseIncDecOperator(parser.advance());
  const end = consumeSemicolon ? parser.expectText(";").span.end : parser.previous().span.end;
  return {
    kind: "IncDecStmt",
    target,
    operator,
    span: span(targetExpression.span.start, end),
  };
}

function assignmentTarget(
  parser: StatementParser,
  expression: CastExpression,
): Extract<CastExpression, { kind: "IdentifierExpr" | "FieldAccessExpr" | "IndexExpr" }> {
  if (
    expression.kind === "IdentifierExpr" || expression.kind === "FieldAccessExpr" ||
    expression.kind === "IndexExpr"
  ) return expression;
  parser.error({ kind: "eof", text: "", span: expression.span }, "Invalid assignment target");
  return { kind: "IdentifierExpr", name: "<error>", span: expression.span };
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

function parseVarDecl(parser: StatementParser, consumeSemicolon = true): CastStatement {
  const keyword = parser.advance();
  const name = parser.expectKind("identifier", "Expected variable name");
  parser.expectText(":");
  const type = parser.parseTypeRef();
  parser.expectText("=");
  const initializer = parser.parseExpression();
  const end = consumeSemicolon ? parser.expectText(";").span.end : initializer.span.end;
  return {
    kind: "VarDeclStmt",
    mutable: keyword.text === "let",
    name: name.text,
    type,
    initializer,
    span: span(keyword.span.start, end),
  };
}

function isVariableDeclarationStart(parser: StatementParser): b8 {
  return parser.checkText("let") || parser.checkText("const");
}

function isPrefixIncDecStart(parser: StatementParser): b8 {
  return isIncDecOperator(parser.peek().text);
}
