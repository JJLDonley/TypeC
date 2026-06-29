import { cStringByteLength } from "core/c_strings.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type {
  CastAccessModifier,
  CastBlockStmt,
  CastClassConstructor,
  CastClassDecl,
  CastClassField,
  CastClassMethod,
  CastConstDecl,
  CastDefaultExportDecl,
  CastEnumDecl,
  CastEnumMember,
  CastExportDecl,
  CastExpression,
  CastFunctionDecl,
  CastGenericParam,
  CastImportDecl,
  CastImportSpecifier,
  CastInterfaceDecl,
  CastInterfaceMethod,
  CastNamespaceDecl,
  CastNamespaceMemberDecl,
  CastParam,
  CastRecordField,
  CastStructDecl,
  CastTaggedUnionDecl,
  CastTaggedUnionVariant,
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
type i32 = number;

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
  peek(offset?: i32): Token;
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
  | CastExportDecl
  | CastDefaultExportDecl
  | CastTypeAliasDecl
  | CastNamespaceDecl
  | CastClassDecl
  | CastStructDecl
  | CastInterfaceDecl
  | CastTaggedUnionDecl
  | CastEnumDecl
  | CastConstDecl
  | CastFunctionDecl;

export function parseDeclarationWith(parser: DeclarationParser): CastDeclaration {
  const modifiers = parseDeclarationModifiers(parser);
  if (modifiers.exported && parser.checkText("default")) {
    return parseDefaultExportDeclaration(parser, modifiers);
  }
  if (modifiers.exported && isExportListStart(parser)) {
    return parseExportDeclaration(parser, modifiers);
  }
  if (parser.checkText("import")) return parseImportDeclaration(parser, modifiers);
  if (parser.checkText("type")) return parseTypeAliasDeclaration(parser, modifiers);
  if (parser.checkText("namespace")) return parseNamespaceDeclaration(parser, modifiers);
  if (parser.checkText("class")) return parseClassDeclaration(parser, modifiers);
  if (parser.checkText("struct")) return parseStructDeclaration(parser, modifiers);
  if (parser.checkText("interface")) return parseInterfaceDeclaration(parser, modifiers);
  if (parser.checkText("union")) return parseTaggedUnionDeclaration(parser, modifiers);
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

function isExportListStart(parser: DeclarationParser): b8 {
  return parser.checkText("{") || (parser.checkText("type") && parser.peek(1).text === "{");
}

function parseDefaultExportDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastDefaultExportDecl {
  if (modifiers.externToken) parser.error(modifiers.externToken, "Exports cannot be extern");
  const start = modifiers.exportToken ?? parser.peek();
  parser.expectText("default");
  const name = parser.expectKind("identifier", "Expected default export name");
  const semi = parser.expectText(";");
  return {
    kind: "DefaultExportDecl",
    name: name.text,
    span: span(start.span.start, semi.span.end),
  };
}

function parseExportDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastExportDecl {
  if (modifiers.externToken) parser.error(modifiers.externToken, "Exports cannot be extern");
  const start = modifiers.exportToken ?? parser.peek();
  const typeOnly = parser.matchText("type");
  const names = parseNamedImport(parser, typeOnly, true);
  const path = parser.matchText("from")
    ? parser.expectKind("string", "Expected export path")
    : null;
  const semi = parser.expectText(";");
  return {
    kind: "ExportDecl",
    names,
    typeOnly,
    path: path?.text ?? null,
    span: span(start.span.start, semi.span.end),
  };
}

function parseImportDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastImportDecl {
  parser.diagnostics().push(
    ...importModifierDiagnostics(modifiers.exportToken, modifiers.externToken),
  );
  const start = parser.expectText("import");
  const typeOnly = parser.matchText("type");
  const namespace = parser.checkText("*") ? parseNamespaceImport(parser) : null;
  const names = namespace ? [] : parseImportSpecifiers(parser, typeOnly);
  parser.expectText("from");
  const path = parser.expectKind("string", "Expected import path");
  const semi = parser.expectText(";");
  return {
    kind: "ImportDecl",
    names,
    namespace,
    typeOnly,
    path: path.text,
    span: span(start.span.start, semi.span.end),
  };
}

function parseImportSpecifiers(
  parser: DeclarationParser,
  typeOnly: b8,
): CastImportSpecifier[] {
  if (parser.checkText("{")) return parseNamedImport(parser, typeOnly, false);
  return [parseDefaultImport(parser, typeOnly)];
}

function parseDefaultImport(parser: DeclarationParser, typeOnly: b8): CastImportSpecifier {
  const local = parser.expectKind("identifier", "Expected default import name");
  return {
    imported: "default",
    local: local.text,
    typeOnly,
    span: local.span,
  };
}

function parseNamedImport(
  parser: DeclarationParser,
  typeOnly: b8 = false,
  reExport: b8 = false,
): CastImportSpecifier[] {
  parser.expectText("{");
  const names = parseImportNamesWith(
    {
      checkText: (text) => parser.checkText(text),
      matchText: (text) => parser.matchText(text),
      expectKind: (kind, message) => parser.expectKind(kind, message),
      peek: () => parser.peek(),
      error: (token, message) => parser.error(token, message),
    },
    typeOnly,
    reExport,
  );
  parser.expectText("}");
  return names;
}

function parseNamespaceImport(parser: DeclarationParser): Str {
  parser.expectText("*");
  parser.expectText("as");
  return parser.expectKind("identifier", "Expected import namespace").text;
}

function parseNamespaceDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastNamespaceDecl {
  if (modifiers.externToken) parser.error(modifiers.externToken, "Namespaces cannot be extern");
  const start = parser.expectText("namespace");
  const name = parser.expectKind("identifier", "Expected namespace name");
  parser.expectText("{");
  const declarations = parseNamespaceMembers(parser);
  const close = parser.expectText("}");
  return {
    kind: "NamespaceDecl",
    exported: modifiers.exported,
    name: name.text,
    declarations,
    span: span(start.span.start, close.span.end),
  };
}

function parseNamespaceMembers(parser: DeclarationParser): CastNamespaceMemberDecl[] {
  const declarations: CastNamespaceMemberDecl[] = [];
  while (!parser.checkText("}") && !parser.checkText("eof")) {
    declarations.push(parseNamespaceMember(parser));
  }
  return declarations;
}

function parseNamespaceMember(parser: DeclarationParser): CastNamespaceMemberDecl {
  const declaration = parseDeclarationWith(parser);
  if (
    declaration.kind === "ImportDecl" || declaration.kind === "NamespaceDecl" ||
    declaration.kind === "ExportDecl" || declaration.kind === "DefaultExportDecl"
  ) {
    parser.error(parser.previous(), "Namespaces cannot contain imports, exports, or namespaces");
    return parseInvalidNamespaceMember(declaration.span);
  }
  return declaration;
}

function parseInvalidNamespaceMember(memberSpan: CastNamespaceMemberDecl["span"]): CastConstDecl {
  return {
    kind: "ConstDecl",
    exported: false,
    name: "<invalid>",
    type: { kind: "NamedTypeRef", name: "i32", span: memberSpan },
    initializer: { kind: "IntegerLiteral", value: 0n, text: "0", span: memberSpan },
    span: memberSpan,
  };
}

function parseTypeAliasDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastTypeAliasDecl {
  parser.diagnostics().push(...typeAliasModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("type");
  const name = parser.expectKind("identifier", "Expected type alias name");
  const genericParams = parseGenericParams(parser);
  parser.expectText("=");
  const type = parser.parseTypeRef();
  const semi = parser.expectText(";");
  return {
    kind: "TypeAliasDecl",
    exported: modifiers.exported,
    name: name.text,
    genericParams,
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
  const genericParams = parseGenericParams(parser);
  const baseClass = parseClassExtends(parser);
  const implemented = parseClassImplements(parser);
  parser.expectText("{");
  const members = parseClassMembers(parser, modifiers.exported);
  const close = parser.expectText("}");
  return {
    kind: "ClassDecl",
    exported: modifiers.exported,
    name: name.text,
    genericParams,
    extends: baseClass,
    implements: implemented,
    fields: members.fields,
    constructorDecl: members.constructorDecl,
    methods: members.methods,
    span: span(start.span.start, close.span.end),
  };
}

function parseClassExtends(parser: DeclarationParser): CastTypeRef | null {
  if (!parser.matchText("extends")) return null;
  return parser.parseTypeRef();
}

function parseClassImplements(parser: DeclarationParser): CastTypeRef[] {
  if (!parser.matchText("implements")) return [];
  const interfaces: CastTypeRef[] = [];
  do interfaces.push(parser.parseTypeRef()); while (parser.matchText(","));
  return interfaces;
}

function parseClassMembers(
  parser: DeclarationParser,
  exported: b8,
): {
  fields: CastClassField[];
  constructorDecl: CastClassConstructor | null;
  methods: CastClassMethod[];
} {
  const fields: CastClassField[] = [];
  const methods: CastClassMethod[] = [];
  let constructorDecl: CastClassConstructor | null = null;
  while (!parser.checkText("}") && !parser.checkText("eof")) {
    const modifiers = parseClassMemberModifiers(parser);
    if (parser.checkText("constructor")) {
      if (modifiers.readonly) parser.error(parser.peek(), "Constructors cannot be readonly");
      if (modifiers.static) parser.error(parser.peek(), "Constructors cannot be static");
      const parsed = parseClassConstructor(parser);
      if (constructorDecl !== null) parser.error(parser.previous(), "Duplicate constructor");
      constructorDecl = constructorDecl ?? parsed;
      continue;
    }
    const name = parser.expectKind("identifier", "Expected class member name");
    if (parser.checkText("(")) methods.push(parseClassMethod(parser, exported, name, modifiers));
    else fields.push(parseClassField(parser, name, modifiers));
  }
  return { fields, constructorDecl, methods };
}

interface ClassMemberModifiers {
  access: CastAccessModifier;
  readonly: b8;
  static: b8;
}

function parseClassMemberModifiers(parser: DeclarationParser): ClassMemberModifiers {
  let access: CastAccessModifier = "public";
  let readonly = false;
  let isStatic = false;
  while (isClassMemberModifier(parser.peek().text)) {
    const text = parser.peek().text;
    parser.expectText(text);
    if (text === "readonly") {
      readonly = true;
      continue;
    }
    if (text === "static") {
      isStatic = true;
      continue;
    }
    access = text as CastAccessModifier;
  }
  return { access, readonly, static: isStatic };
}

function isClassMemberModifier(text: Str): b8 {
  return text === "public" || text === "private" || text === "protected" || text === "readonly" ||
    text === "static";
}

function parseClassField(
  parser: DeclarationParser,
  name: Token,
  modifiers: ClassMemberModifiers,
): CastClassField {
  parser.expectText(":");
  const type = parser.parseTypeRef();
  const initializer = modifiers.static && parser.matchText("=") ? parser.parseExpression() : null;
  if (modifiers.static && initializer === null) {
    parser.error(name, "Static fields require an initializer");
  }
  const semi = parser.expectText(";");
  return {
    name: name.text,
    type,
    access: modifiers.access,
    readonly: modifiers.readonly,
    static: modifiers.static,
    initializer,
    span: span(name.span.start, semi.span.end),
  };
}

function parseClassConstructor(parser: DeclarationParser): CastClassConstructor {
  const start = parser.expectText("constructor");
  parser.expectText("(");
  const params = parseFunctionParams(parser);
  parser.expectText(")");
  const body = parser.parseBlock();
  return { params: params.params, body, span: span(start.span.start, body.span.end) };
}

function parseClassMethod(
  parser: DeclarationParser,
  exported: b8,
  name: Token,
  modifiers: ClassMemberModifiers,
): CastClassMethod {
  parser.expectText("(");
  const params = parseFunctionParams(parser);
  parser.expectText(")");
  parser.expectText(":");
  const returnType = parser.parseTypeRef();
  const body = parser.parseBlock();
  if (modifiers.readonly) parser.error(name, "Methods cannot be readonly");
  return {
    exported,
    name: name.text,
    params: params.params,
    returnType,
    access: modifiers.access,
    static: modifiers.static,
    body,
    span: span(name.span.start, body.span.end),
  };
}

function parseStructDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastStructDecl {
  parser.diagnostics().push(...typeAliasModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("struct");
  const name = parser.expectKind("identifier", "Expected struct name");
  parser.expectText("{");
  const fields = parseStructFields(parser);
  const close = parser.expectText("}");
  return {
    kind: "StructDecl",
    exported: modifiers.exported,
    name: name.text,
    fields,
    span: span(start.span.start, close.span.end),
  };
}

function parseStructFields(parser: DeclarationParser): CastRecordField[] {
  const fields: CastRecordField[] = [];
  while (!parser.checkText("}") && !parser.checkText("eof")) {
    if (parser.checkText("constructor")) {
      parser.error(parser.peek(), "Structs cannot have constructors");
    }
    const name = parser.expectKind("identifier", "Expected struct field name");
    if (parser.checkText("(")) parser.error(name, "Structs cannot have methods");
    parser.expectText(":");
    const type = parser.parseTypeRef();
    const semi = parser.expectText(";");
    fields.push({ name: name.text, type, span: span(name.span.start, semi.span.end) });
  }
  return fields;
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

function parseTaggedUnionDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastTaggedUnionDecl {
  parser.diagnostics().push(...enumModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("union");
  const name = parser.expectKind("identifier", "Expected union name");
  parser.expectText("{");
  const variants = parseTaggedUnionVariants(parser);
  const close = parser.expectText("}");
  return {
    kind: "TaggedUnionDecl",
    exported: modifiers.exported,
    name: name.text,
    variants,
    span: span(start.span.start, close.span.end),
  };
}

function parseTaggedUnionVariants(parser: DeclarationParser): CastTaggedUnionVariant[] {
  const variants: CastTaggedUnionVariant[] = [];
  while (!parser.checkText("}") && !parser.checkText("eof")) {
    variants.push(parseTaggedUnionVariant(parser));
  }
  return variants;
}

function parseTaggedUnionVariant(parser: DeclarationParser): CastTaggedUnionVariant {
  const name = parser.expectKind("identifier", "Expected union variant name");
  const payload = parser.matchText(":") ? parser.parseTypeRef() : null;
  const semi = parser.expectText(";");
  return { name: name.text, payload, span: span(name.span.start, semi.span.end) };
}

function parseEnumDeclaration(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
): CastEnumDecl {
  parser.diagnostics().push(...enumModifierDiagnostics(modifiers.externToken));
  const start = parser.expectText("enum");
  const name = parser.expectKind("identifier", "Expected enum name");
  const backingType = parser.matchText(":") ? parser.parseTypeRef() : null;
  parser.expectText("{");
  const members = parseEnumMembers(parser);
  const close = parser.expectText("}");
  return {
    kind: "EnumDecl",
    exported: modifiers.exported,
    name: name.text,
    cName: null,
    backingType,
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
  const explicitType = parser.matchText(":") ? parser.parseTypeRef() : null;
  parser.expectText("=");
  const initializer = parser.parseExpression();
  const type = explicitType ?? inferConstType(initializer);
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

function inferConstType(initializer: CastExpression): CastTypeRef {
  switch (initializer.kind) {
    case "IntegerLiteral":
      return { kind: "NamedTypeRef", name: "i32", span: initializer.span };
    case "FloatLiteral":
      return { kind: "NamedTypeRef", name: "f64", span: initializer.span };
    case "BoolLiteral":
      return { kind: "NamedTypeRef", name: "bool", span: initializer.span };
    case "StringLiteral":
      return {
        kind: "FixedArrayTypeRef",
        element: { kind: "NamedTypeRef", name: "u8", span: initializer.span },
        sizeText: `${cStringByteLength(initializer.text)}`,
        span: initializer.span,
      };
    default:
      return { kind: "NamedTypeRef", name: "i32", span: initializer.span };
  }
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
  const returnType = parseFunctionReturnType(parser, modifiers, functionToken);
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
  if (parser.checkText(";")) {
    return parseOverloadFunction(
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

function parseFunctionReturnType(
  parser: DeclarationParser,
  modifiers: DeclarationModifiers,
  functionToken: Token,
): CastTypeRef {
  if (parser.matchText(":")) return parser.parseTypeRef();
  if (modifiers.external) {
    parser.error(functionToken, "Extern functions require explicit return types");
  }
  if (modifiers.exported) {
    parser.error(functionToken, "Exported functions require explicit return types");
  }
  return { kind: "NamedTypeRef", name: "<infer>", span: functionToken.span };
}

function parseGenericParams(parser: DeclarationParser): CastGenericParam[] {
  const params: CastGenericParam[] = [];
  if (!parser.matchText("<")) return params;
  do {
    const name = parser.expectKind("identifier", "Expected generic parameter name");
    const constraint = parser.matchText("extends") ? parser.parseTypeRef() : null;
    params.push({ name: name.text, constraint, span: name.span });
    if (!parser.matchText(",")) break;
    if (parser.checkText(">")) break;
  } while (true);
  parser.expectText(">");
  return params;
}

function parseFunctionParams(parser: DeclarationParser): FunctionParamsParse {
  const params: CastParam[] = [];
  if (parser.checkText(")")) return { params, variadic: false };
  do {
    if (parser.checkText(")")) break;
    if (parser.matchText("...")) {
      const rest = parseRestOrVariadicParam(parser);
      if (rest === null) return { params, variadic: true };
      params.push(rest);
      return { params, variadic: false };
    }
    params.push(parseFunctionParam(parser));
  } while (parser.matchText(","));
  return { params, variadic: false };
}

function parseRestOrVariadicParam(parser: DeclarationParser): CastParam | null {
  const name = parser.expectKind("identifier", "Expected rest parameter name");
  if (!parser.matchText(":")) return null;
  const type = parser.parseTypeRef();
  return {
    name: name.text,
    rest: true,
    type,
    defaultValue: null,
    span: span(name.span.start, type.span.end),
  };
}

function parseFunctionParam(parser: DeclarationParser): CastParam {
  const name = parser.expectKind("identifier", "Expected parameter name");
  const optional = parser.matchText("?");
  parser.expectText(":");
  const type = parser.parseTypeRef();
  const defaultValue = parser.matchText("=") ? parser.parseExpression() : null;
  return {
    name: name.text,
    optional,
    type,
    defaultValue,
    span: span(name.span.start, (defaultValue ?? type).span.end),
  };
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

function parseOverloadFunction(
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
    external: false,
    overload: true,
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
