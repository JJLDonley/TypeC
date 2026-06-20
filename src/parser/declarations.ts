import type { Diagnostic } from "core/diagnostics.ts";
import type {
  CastBlockStmt,
  CastFunctionDecl,
  CastImportDecl,
  CastParam,
  CastTypeAliasDecl,
  CastTypeRef,
} from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import {
  functionModifierDiagnostics,
  importModifierDiagnostics,
  typeAliasModifierDiagnostics,
} from "parser/declaration_modifiers.ts";
import { span } from "parser/helpers.ts";
import { parseImportNamesWith } from "parser/imports.ts";
type Str = string;
type b8 = boolean;

interface FunctionParamsParse {
  params: CastParam[];
  variadic: b8;
}

export interface DeclarationParser {
  diagnostics(): Diagnostic[];
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  previous(): Token;
  expectKind(kind: TokenKind, message: Str): Token;
  expectText(text: Str): Token;
  peek(): Token;
  error(token: Token, message: Str): void;
  parseTypeRef(): CastTypeRef;
  parseBlock(): CastBlockStmt;
}

export interface DeclarationModifiers {
  exported: b8;
  exportToken: Token | null;
  external: b8;
  externToken: Token | null;
}

export type CastDeclaration = CastImportDecl | CastTypeAliasDecl | CastFunctionDecl;

export function parseDeclarationWith(parser: DeclarationParser): CastDeclaration {
  const modifiers = parseDeclarationModifiers(parser);
  if (parser.checkText("import")) return parseImportDeclaration(parser, modifiers);
  if (parser.checkText("type")) return parseTypeAliasDeclaration(parser, modifiers);
  return parseFunctionDeclaration(parser, modifiers);
}

function parseDeclarationModifiers(parser: DeclarationParser): DeclarationModifiers {
  const exported = parser.matchText("export");
  const exportToken = exported ? parser.previous() : null;
  const external = parser.matchText("extern");
  const externToken = external ? parser.previous() : null;
  return { exported, exportToken, external, externToken };
}

function parseImportDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastImportDecl {
  parser.diagnostics().push(
    ...importModifierDiagnostics(modifiers.exportToken, modifiers.externToken),
  );
  const start = parser.expectText("import");
  const namespace = parser.checkText("*") ? parseNamespaceImport(parser) : null;
  const names = namespace ? [] : parseNamedImport(parser);
  parser.expectText("from");
  const path = parser.expectKind("string", "Expected import path");
  const semi = parser.expectText(";");
  return {
    kind: "ImportDecl",
    names,
    namespace,
    path: path.text,
    span: span(start.span.start, semi.span.end),
  };
}

function parseNamedImport(parser: DeclarationParser): Str[] {
  parser.expectText("{");
  const names = parseImportNamesWith({
    checkText: (text) => parser.checkText(text),
    matchText: (text) => parser.matchText(text),
    expectKind: (kind, message) => parser.expectKind(kind, message),
    peek: () => parser.peek(),
    error: (token, message) => parser.error(token, message),
  });
  parser.expectText("}");
  return names;
}

function parseNamespaceImport(parser: DeclarationParser): Str {
  parser.expectText("*");
  parser.expectText("as");
  return parser.expectKind("identifier", "Expected import namespace").text;
}

function parseTypeAliasDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastTypeAliasDecl {
  parser.diagnostics().push(...typeAliasModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("type");
  const name = parser.expectKind("identifier", "Expected type alias name");
  parser.expectText("=");
  const type = parser.parseTypeRef();
  const semi = parser.expectText(";");
  return {
    kind: "TypeAliasDecl",
    exported: modifiers.exported,
    name: name.text,
    type,
    span: span(start.span.start, semi.span.end),
  };
}

function parseFunctionDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastFunctionDecl {
  parser.diagnostics().push(
    ...functionModifierDiagnostics(modifiers.exportToken, modifiers.externToken),
  );
  const functionToken = parser.expectText("function");
  const name = parser.expectKind("identifier", "Expected function name");
  parser.expectText("(");
  const params = parseFunctionParams(parser);
  parser.expectText(")");
  parser.expectText(":");
  const returnType = parser.parseTypeRef();
  if (modifiers.external) {
    return parseExternFunction(
      parser,
      modifiers.exported,
      functionToken,
      name.text,
      params.params,
      params.variadic,
      returnType,
    );
  }
  return parseBodyFunction(
    parser,
    modifiers.exported,
    modifiers.external,
    functionToken,
    name.text,
    params.params,
    params.variadic,
    returnType,
  );
}

function parseFunctionParams(parser: DeclarationParser): FunctionParamsParse {
  const params: CastParam[] = [];
  if (parser.checkText(")")) return { params, variadic: false };
  do {
    if (parser.matchText("...")) {
      parser.expectKind("identifier", "Expected rest parameter name");
      return { params, variadic: true };
    }
    params.push(parseFunctionParam(parser));
  } while (parser.matchText(","));
  return { params, variadic: false };
}

function parseFunctionParam(parser: DeclarationParser): CastParam {
  const name = parser.expectKind("identifier", "Expected parameter name");
  parser.expectText(":");
  const type = parser.parseTypeRef();
  return { name: name.text, type, span: span(name.span.start, type.span.end) };
}

function parseExternFunction(
  parser: DeclarationParser,
  exported: b8,
  functionToken: Token,
  name: Str,
  params: CastParam[],
  variadic: b8,
  returnType: CastTypeRef,
): CastFunctionDecl {
  const semi = parser.expectText(";");
  return {
    kind: "FunctionDecl",
    exported,
    external: true,
    name,
    cName: null,
    params,
    variadic,
    returnType,
    body: null,
    span: span(functionToken.span.start, semi.span.end),
  };
}

function parseBodyFunction(
  parser: DeclarationParser,
  exported: b8,
  external: b8,
  functionToken: Token,
  name: Str,
  params: CastParam[],
  variadic: b8,
  returnType: CastTypeRef,
): CastFunctionDecl {
  const body = parser.parseBlock();
  return {
    kind: "FunctionDecl",
    exported,
    external,
    name,
    cName: null,
    params,
    variadic,
    returnType,
    body,
    span: span(functionToken.span.start, body.span.end),
  };
}
