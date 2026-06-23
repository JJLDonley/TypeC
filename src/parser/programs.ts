import { TypeCError } from "core/diagnostics.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type {
  CastConstDecl,
  CastEnumDecl,
  CastFunctionDecl,
  CastImportDecl,
  CastProgram,
  CastTypeAliasDecl,
} from "core/cast.ts";
import type { Token } from "core/token.ts";
import {
  type CastDeclaration,
  type DeclarationParser,
  parseDeclarationWith,
} from "parser/declarations.ts";

type b8 = boolean;

export interface ProgramParser {
  diagnostics(): Diagnostic[];
  peek(): Token;
  checkEof(): b8;
  declarationParser(): DeclarationParser;
}

interface ProgramDeclarations {
  imports: CastImportDecl[];
  typeAliases: CastTypeAliasDecl[];
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
  while (!parser.checkEof()) {
    addDeclaration(declarations, parseDeclarationWith(parser.declarationParser()));
  }
  return declarations;
}

function emptyProgramDeclarations(): ProgramDeclarations {
  return { imports: [], typeAliases: [], enums: [], constants: [], functions: [] };
}

function addDeclaration(declarations: ProgramDeclarations, declaration: CastDeclaration): void {
  if (declaration.kind === "ImportDecl") declarations.imports.push(declaration);
  if (declaration.kind === "TypeAliasDecl") declarations.typeAliases.push(declaration);
  if (declaration.kind === "EnumDecl") declarations.enums.push(declaration);
  if (declaration.kind === "ConstDecl") declarations.constants.push(declaration);
  if (declaration.kind === "FunctionDecl") declarations.functions.push(declaration);
}
