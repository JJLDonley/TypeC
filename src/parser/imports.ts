import type { CastImportSpecifier } from "core/cast.ts";
import type { Token, TokenKind } from "core/token.ts";
import { span } from "parser/helpers.ts";

type Str = string;
type b8 = boolean;

export interface ImportNameParser {
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  expectKind(kind: TokenKind, message: Str): Token;
  peek(): Token;
  error(token: Token, message: Str): void;
}

export function parseImportNamesWith(parser: ImportNameParser): CastImportSpecifier[] {
  const names: CastImportSpecifier[] = [];
  const seen = new Set<Str>();
  if (parser.checkText("}")) {
    parser.error(parser.peek(), "Import must name at least one symbol");
    return names;
  }
  do parseImportName(parser, names, seen); while (parser.matchText(","));
  return names;
}

function parseImportName(
  parser: ImportNameParser,
  names: CastImportSpecifier[],
  seen: Set<Str>,
): void {
  const imported = parser.expectKind("identifier", "Expected imported name");
  const local = parser.matchText("as")
    ? parser.expectKind("identifier", "Expected local import name")
    : imported;
  if (seen.has(local.text)) parser.error(local, `Duplicate imported name '${local.text}'`);
  seen.add(local.text);
  names.push({
    imported: imported.text,
    local: local.text,
    span: span(imported.span.start, local.span.end),
  });
}
