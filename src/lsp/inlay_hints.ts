import { lex } from "core/lexer.ts";
import { compilerInlayHints } from "lsp/inferred_inlay_hints.ts";
import type { Token } from "core/token.ts";
import type { b8, i32, JsonRecord, JsonValue, LspPosition, Str, usize } from "lsp/types.ts";

const PARAMETER_HINT_KIND = 2;

interface FunctionParameters {
  name: Str;
  parameters: Str[];
}

interface CallArguments {
  name: Str;
  arguments: Token[];
}

export function inlayHints(text: Str, uri: Str = "file:///main.tc"): JsonValue {
  const tokens = lex(text);
  return [
    ...callInlayHints(tokens, functionParameters(tokens)),
    ...compilerInlayHints(text, tokens, uri),
  ] as unknown as JsonValue;
}

function callInlayHints(tokens: Token[], functions: Map<Str, Str[]>): JsonRecord[] {
  const hints: JsonRecord[] = [];
  for (const call of callArguments(tokens)) {
    const parameters = functions.get(call.name);
    if (parameters === undefined) continue;
    hints.push(...argumentHints(call.arguments, parameters));
  }
  return hints;
}

function argumentHints(arguments_: Token[], parameters: Str[]): JsonRecord[] {
  const hints: JsonRecord[] = [];
  const count: usize = Math.min(arguments_.length, parameters.length);
  for (let index: usize = 0; index < count; index += 1) {
    const parameter = parameters[index]!;
    if (parameter === "") continue;
    hints.push(parameterHint(arguments_[index]!, parameter));
  }
  return hints;
}

function parameterHint(token: Token, parameter: Str): JsonRecord {
  return {
    position: tokenStartPosition(token) as unknown as JsonValue,
    label: `${parameter}:`,
    kind: PARAMETER_HINT_KIND,
  };
}

function functionParameters(tokens: Token[]): Map<Str, Str[]> {
  const functions = new Map<Str, Str[]>();
  for (const signature of functionParameterList(tokens)) {
    functions.set(signature.name, signature.parameters);
  }
  return functions;
}

function functionParameterList(tokens: Token[]): FunctionParameters[] {
  const functions: FunctionParameters[] = [];
  for (let index: usize = 0; index < tokens.length; index += 1) {
    if (!isFunctionDeclarationName(tokens, index)) continue;
    const closeIndex = matchingClose(tokens, index + 1, "(", ")");
    if (closeIndex === null) continue;
    functions.push({
      name: tokens[index]!.text,
      parameters: parameterNames(tokens, index + 1, closeIndex),
    });
  }
  return functions;
}

function parameterNames(tokens: Token[], openIndex: usize, closeIndex: usize): Str[] {
  const names: Str[] = [];
  for (const segment of topLevelSegments(tokens, openIndex, closeIndex)) {
    names.push(parameterName(tokens, segment.start, segment.end));
  }
  return names;
}

function parameterName(tokens: Token[], start: usize, end: usize): Str {
  for (let index: usize = start; index < end; index += 1) {
    const token = tokens[index]!;
    if (token.text === ":" || token.text === "=" || token.text === "?") return "";
    if (token.kind === "identifier") return token.text;
  }
  return "";
}

function callArguments(tokens: Token[]): CallArguments[] {
  const calls: CallArguments[] = [];
  for (let index: usize = 0; index < tokens.length; index += 1) {
    if (!isDirectCallOpen(tokens, index)) continue;
    const closeIndex = matchingClose(tokens, index, "(", ")");
    if (closeIndex === null) continue;
    calls.push({
      name: tokens[index - 1]!.text,
      arguments: argumentStartTokens(tokens, index, closeIndex),
    });
  }
  return calls;
}

function argumentStartTokens(tokens: Token[], openIndex: usize, closeIndex: usize): Token[] {
  const starts: Token[] = [];
  for (const segment of topLevelSegments(tokens, openIndex, closeIndex)) {
    const token = firstArgumentToken(tokens, segment.start, segment.end);
    if (token !== null) starts.push(token);
  }
  return starts;
}

function firstArgumentToken(tokens: Token[], start: usize, end: usize): Token | null {
  for (let index: usize = start; index < end; index += 1) {
    const token = tokens[index]!;
    if (token.text !== ",") return token;
  }
  return null;
}

interface TokenSegment {
  start: usize;
  end: usize;
}

function topLevelSegments(tokens: Token[], openIndex: usize, closeIndex: usize): TokenSegment[] {
  const segments: TokenSegment[] = [];
  let start: usize = openIndex + 1;
  let depth: i32 = 0;
  for (let index: usize = start; index < closeIndex; index += 1) {
    const token = tokens[index]!;
    if (isNestedOpen(token.text)) depth += 1;
    if (isNestedClose(token.text)) depth -= 1;
    if (token.text !== "," || depth !== 0) continue;
    pushNonEmptySegment(tokens, segments, start, index);
    start = index + 1;
  }
  pushNonEmptySegment(tokens, segments, start, closeIndex);
  return segments;
}

function pushNonEmptySegment(
  tokens: Token[],
  segments: TokenSegment[],
  start: usize,
  end: usize,
): void {
  if (segmentHasToken(tokens, start, end)) segments.push({ start, end });
}

function segmentHasToken(tokens: Token[], start: usize, end: usize): b8 {
  for (let index: usize = start; index < end; index += 1) {
    if (tokens[index]?.kind !== "eof") return true;
  }
  return false;
}

function isFunctionDeclarationName(tokens: Token[], index: usize): b8 {
  return tokens[index - 1]?.text === "function" &&
    tokens[index]?.kind === "identifier" &&
    tokens[index + 1]?.text === "(";
}

function isDirectCallOpen(tokens: Token[], index: usize): b8 {
  return tokens[index]?.text === "(" &&
    tokens[index - 1]?.kind === "identifier" &&
    tokens[index - 2]?.text !== "function" &&
    tokens[index - 2]?.text !== ".";
}

function matchingClose(tokens: Token[], openIndex: usize, open: Str, close: Str): usize | null {
  let depth: i32 = 0;
  for (let index: usize = openIndex; index < tokens.length; index += 1) {
    const text = tokens[index]!.text;
    if (text === open) depth += 1;
    if (text !== close) continue;
    depth -= 1;
    if (depth === 0) return index;
  }
  return null;
}

function tokenStartPosition(token: Token): LspPosition {
  return {
    line: token.span.start.line - 1,
    character: token.span.start.column - 1,
  };
}

function isNestedOpen(text: Str): b8 {
  return text === "(" || text === "[" || text === "{" || text === "<";
}

function isNestedClose(text: Str): b8 {
  return text === ")" || text === "]" || text === "}" || text === ">";
}
