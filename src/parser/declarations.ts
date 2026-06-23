import type { Diagnostic } from "core/diagnostics.ts";
import type {
  CastBlockStmt,
  CastClassDecl,
  CastClassField,
  CastClassMethod,
  CastConstDecl,
  CastEnumDecl,
  CastEnumMember,
  CastExpression,
  CastFunctionDecl,
  CastGenericParam,
  CastImportDecl,
  CastInterfaceDecl,
  CastInterfaceMethod,
  CastParam,
  CastTypeAliasDecl,
  CastTypeRef,
} from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import {
  classModifierDiagnostics,
  constModifierDiagnostics,
  enumModifierDiagnostics,
  functionModifierDiagnostics,
  importModifierDiagnostics,
  interfaceModifierDiagnostics,
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
  parseExpression(): CastExpression;
  parseBlock(): CastBlockStmt;
}

export interface DeclarationModifiers {
  exported: b8;
  exportToken: Token | null;
  external: b8;
  externToken: Token | null;
}

export type CastDeclaration =
  | CastImportDecl
  | CastTypeAliasDecl
  | CastClassDecl
  | CastInterfaceDecl
  | CastEnumDecl
  | CastConstDecl
  | CastFunctionDecl;

export function parseDeclarationWith(parser: DeclarationParser): CastDeclaration {
  const modifiers = parseDeclarationModifiers(parser);
  if (parser.checkText("import")) return parseImportDeclaration(parser, modifiers);
  if (parser.checkText("type")) return parseTypeAliasDeclaration(parser, modifiers);
  if (parser.checkText("class")) return parseClassDeclaration(parser, modifiers);
  if (parser.checkText("interface")) return parseInterfaceDeclaration(parser, modifiers);
  if (parser.checkText("enum")) return parseEnumDeclaration(parser, modifiers);
  if (parser.checkText("const")) return parseConstDeclaration(parser, modifiers);
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

function parseClassDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastClassDecl {
  parser.diagnostics().push(...classModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("class");
  const name = parser.expectKind("identifier", "Expected class name");
  parser.expectText("{");
  const members = parseClassMembers(parser, modifiers.exported);
  const close = parser.expectText("}");
  return {
    kind: "ClassDecl",
    exported: modifiers.exported,
    name: name.text,
    fields: members.fields,
    methods: members.methods,
    span: span(start.span.start, close.span.end),
  };
}

function parseClassMembers(
  parser: DeclarationParser,
  exported: b8,
): { fields: CastClassField[]; methods: CastClassMethod[] } {
  const fields: CastClassField[] = [];
  const methods: CastClassMethod[] = [];
  while (!parser.checkText("}") && !parser.checkText("eof")) {
    const name = parser.expectKind("identifier", "Expected class member name");
    if (parser.checkText("(")) methods.push(parseClassMethod(parser, exported, name));
    else fields.push(parseClassField(parser, name));
  }
  return { fields, methods };
}

function parseClassField(parser: DeclarationParser, name: Token): CastClassField {
  parser.expectText(":");
  const type = parser.parseTypeRef();
  const semi = parser.expectText(";");
  return { name: name.text, type, span: span(name.span.start, semi.span.end) };
}

function parseClassMethod(
  parser: DeclarationParser,
  exported: b8,
  name: Token,
): CastClassMethod {
  parser.expectText("(");
  const params = parseFunctionParams(parser);
  parser.expectText(")");
  parser.expectText(":");
  const returnType = parser.parseTypeRef();
  const body = parser.parseBlock();
  return {
    exported,
    name: name.text,
    params: params.params,
    returnType,
    body,
    span: span(name.span.start, body.span.end),
  };
}

function parseInterfaceDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastInterfaceDecl {
  parser.diagnostics().push(...interfaceModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("interface");
  const name = parser.expectKind("identifier", "Expected interface name");
  parser.expectText("{");
  const methods = parseInterfaceMethods(parser);
  const close = parser.expectText("}");
  return {
    kind: "InterfaceDecl",
    exported: modifiers.exported,
    name: name.text,
    methods,
    span: span(start.span.start, close.span.end),
  };
}

function parseInterfaceMethods(parser: DeclarationParser): CastInterfaceMethod[] {
  const methods: CastInterfaceMethod[] = [];
  while (!parser.checkText("}") && !parser.checkText("eof")) {
    methods.push(parseInterfaceMethod(parser));
  }
  return methods;
}

function parseInterfaceMethod(parser: DeclarationParser): CastInterfaceMethod {
  const name = parser.expectKind("identifier", "Expected interface method name");
  parser.expectText("(");
  const params = parseFunctionParams(parser);
  parser.expectText(")");
  parser.expectText(":");
  const returnType = parser.parseTypeRef();
  const semi = parser.expectText(";");
  return {
    name: name.text,
    params: params.params,
    returnType,
    span: span(name.span.start, semi.span.end),
  };
}

function parseEnumDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastEnumDecl {
  parser.diagnostics().push(...enumModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("enum");
  const name = parser.expectKind("identifier", "Expected enum name");
  parser.expectText("{");
  const members = parseEnumMembers(parser);
  const close = parser.expectText("}");
  return {
    kind: "EnumDecl",
    exported: modifiers.exported,
    name: name.text,
    cName: null,
    members,
    span: span(start.span.start, close.span.end),
  };
}

function parseEnumMembers(parser: DeclarationParser): CastEnumMember[] {
  const members: CastEnumMember[] = [];
  while (!parser.checkText("}") && !parser.checkText("eof")) {
    members.push(parseEnumMember(parser));
    parser.matchText(",");
  }
  return members;
}

function parseEnumMember(parser: DeclarationParser): CastEnumMember {
  const name = parser.expectKind("identifier", "Expected enum member name");
  const initializer = parser.matchText("=") ? parser.parseExpression() : null;
  return {
    name: name.text,
    initializer,
    span: span(name.span.start, (initializer ?? name).span.end),
  };
}

function parseConstDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastConstDecl {
  parser.diagnostics().push(...constModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("const");
  const name = parser.expectKind("identifier", "Expected constant name");
  parser.expectText(":");
  const type = parser.parseTypeRef();
  parser.expectText("=");
  const initializer = parser.parseExpression();
  const semi = parser.expectText(";");
  return {
    kind: "ConstDecl",
    exported: modifiers.exported,
    name: name.text,
    cName: null,
    type,
    initializer,
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
  const genericParams = parseGenericParams(parser);
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
      genericParams,
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
    genericParams,
    params.params,
    params.variadic,
    returnType,
  );
}

function parseGenericParams(parser: DeclarationParser): CastGenericParam[] {
  const params: CastGenericParam[] = [];
  if (!parser.matchText("<")) return params;
  do {
    const name = parser.expectKind("identifier", "Expected generic parameter name");
    params.push({ name: name.text, span: name.span });
  } while (parser.matchText(","));
  parser.expectText(">");
  return params;
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
  genericParams: CastGenericParam[],
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
    genericParams,
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
  genericParams: CastGenericParam[],
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
    genericParams,
    params,
    variadic,
    returnType,
    body,
    span: span(functionToken.span.start, body.span.end),
  };
}
