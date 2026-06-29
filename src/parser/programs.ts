import { TypeCError } from "core/diagnostics.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type {
  CastClassDecl,
  CastConstDecl,
  CastEnumDecl,
  CastExportDecl,
  CastFunctionDecl,
  CastImportDecl,
  CastInterfaceDecl,
  CastNamespaceDecl,
  CastProgram,
  CastStructDecl,
  CastTaggedUnionDecl,
  CastTypeAliasDecl,
} from "core/cast.ts";
import type { Token } from "core/token.ts";
import {
  type CastDeclaration,
  type DeclarationParser,
  parseDeclarationWith,
} from "parser/declarations.ts";

type Str = string;
type b8 = boolean;

export interface ProgramParser {
  diagnostics(): Diagnostic[];
  peek(): Token;
  checkEof(): b8;
  checkText?(text: Str): b8;
  advance?(): Token;
  declarationParser(): DeclarationParser;
}

interface ProgramDeclarations {
  imports: CastImportDecl[];
  exports: CastExportDecl[];
  defaultExport: Str | null;
  typeAliases: CastTypeAliasDecl[];
  namespaces: CastNamespaceDecl[];
  classes: CastClassDecl[];
  structs: CastStructDecl[];
  interfaces: CastInterfaceDecl[];
  taggedUnions: CastTaggedUnionDecl[];
  enums: CastEnumDecl[];
  constants: CastConstDecl[];
  functions: CastFunctionDecl[];
}

export function parseProgramWith(parser: ProgramParser): CastProgram {
  const start = parser.peek().span.start;
  const declarations = parseProgramDeclarations(parser);
  const end = parser.peek().span.end;
  if (parser.diagnostics().length > 0) throw new TypeCError(parser.diagnostics());
  return { kind: "Program", ...declarations, span: { start, end } };
}

function parseProgramDeclarations(parser: ProgramParser): ProgramDeclarations {
  const declarations = emptyProgramDeclarations();
  while (!parser.checkEof()) parseProgramDeclaration(parser, declarations);
  return declarations;
}

function parseProgramDeclaration(
  parser: ProgramParser,
  declarations: ProgramDeclarations,
): void {
  try {
    addDeclaration(declarations, parseDeclarationWith(parser.declarationParser()));
  } catch (error) {
    if (!(error instanceof TypeCError) || !canRecover(parser)) throw error;
    synchronizeDeclaration(parser);
  }
}

function canRecover(parser: ProgramParser): b8 {
  return parser.advance !== undefined && parser.checkText !== undefined;
}

function synchronizeDeclaration(parser: ProgramParser): void {
  if (!canRecover(parser)) return;
  if (isDeclarationStart(parser) || parser.checkEof()) return;
  parser.advance!();
  while (!parser.checkEof() && !isDeclarationStart(parser)) parser.advance!();
}

function isDeclarationStart(parser: ProgramParser): b8 {
  if (!canRecover(parser)) return false;
  return DECLARATION_STARTS.some((text) => parser.checkText!(text));
}

const DECLARATION_STARTS: Str[] = [
  "import",
  "export",
  "extern",
  "type",
  "namespace",
  "class",
  "struct",
  "interface",
  "union",
  "enum",
  "const",
  "function",
];

function emptyProgramDeclarations(): ProgramDeclarations {
  return {
    imports: [],
    exports: [],
    defaultExport: null,
    typeAliases: [],
    namespaces: [],
    classes: [],
    structs: [],
    interfaces: [],
    taggedUnions: [],
    enums: [],
    constants: [],
    functions: [],
  };
}

function addDeclaration(declarations: ProgramDeclarations, declaration: CastDeclaration): void {
  if (declaration.kind === "ImportDecl") declarations.imports.push(declaration);
  if (declaration.kind === "ExportDecl") declarations.exports.push(declaration);
  if (declaration.kind === "DefaultExportDecl") declarations.defaultExport = declaration.name;
  if (declaration.kind === "TypeAliasDecl") declarations.typeAliases.push(declaration);
  if (declaration.kind === "NamespaceDecl") declarations.namespaces.push(declaration);
  if (declaration.kind === "ClassDecl") declarations.classes.push(declaration);
  if (declaration.kind === "StructDecl") declarations.structs.push(declaration);
  if (declaration.kind === "InterfaceDecl") declarations.interfaces.push(declaration);
  if (declaration.kind === "TaggedUnionDecl") declarations.taggedUnions.push(declaration);
  if (declaration.kind === "EnumDecl") declarations.enums.push(declaration);
  if (declaration.kind === "ConstDecl") declarations.constants.push(declaration);
  if (declaration.kind === "FunctionDecl") declarations.functions.push(declaration);
}
