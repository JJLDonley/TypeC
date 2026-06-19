import type { Token, TokenKind } from "core/token.ts";

type Str = string;
type b8 = boolean;

export interface ImportNameParser {
  checkText(text: Str): b8;
  matchText(text: Str): b8;
  expectKind(kind: TokenKind, message: Str): Token;
  peek(): Token;
  error(token: Token, message: Str): void;
}

export function parseImportNamesWith(parser: ImportNameParser): Str[] {
  const names: Str[] = [];
  const seen = new Set<Str>();
  if (parser.checkText("}")) {
    parser.error(parser.peek(), "Import must name at least one symbol");
    return names;
  }
  do parseImportName(parser, names, seen);
  while (parser.matchText(","));
  return names;
}

function parseImportName(parser: ImportNameParser, names: Str[], seen: Set<Str>): void {
  const name = parser.expectKind("identifier", "Expected imported name");
  if (seen.has(name.text)) parser.error(name, `Duplicate imported name '${name.text}'`);
  seen.add(name.text);
  names.push(name.text);
}
