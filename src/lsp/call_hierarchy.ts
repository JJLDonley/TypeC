import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan } from "lsp/source_positions.ts";
import { identifierAtPosition } from "lsp/symbols.ts";
import type { b8, JsonRecord, JsonValue, LspPosition, Str, usize } from "lsp/types.ts";

const FUNCTION_SYMBOL_KIND = 12;

interface FunctionSymbol {
  name: Str;
  token: Token;
}

interface FunctionBody {
  symbol: FunctionSymbol;
  start: usize;
  end: usize;
}

interface IncomingCall {
  caller: FunctionSymbol;
  ranges: JsonValue[];
}

interface OutgoingCall {
  target: FunctionSymbol;
  ranges: JsonValue[];
}

export function prepareCallHierarchy(text: Str, uri: Str, position: LspPosition): JsonValue {
  const tokens = lex(text);
  const token = identifierAtPosition(tokens, text, position);
  if (token === null) return null;
  const symbol = functionSymbol(tokens, token.text);
  if (symbol === null) return null;
  return [callHierarchyItem(symbol, uri)] as unknown as JsonValue;
}

export function incomingCallHierarchy(text: Str, uri: Str, item: JsonRecord): JsonValue {
  const name = itemName(item);
  const tokens = lex(text);
  if (functionSymbol(tokens, name) === null) return [];
  return incomingCalls(tokens, name).map((call) =>
    incomingCallItem(call, uri)
  ) as unknown as JsonValue;
}

export function outgoingCallHierarchy(text: Str, uri: Str, item: JsonRecord): JsonValue {
  const name = itemName(item);
  const tokens = lex(text);
  const calls = outgoingCalls(tokens, name);
  return calls.map((call) => outgoingCallItem(call, uri)) as unknown as JsonValue;
}

function incomingCallItem(call: IncomingCall, uri: Str): JsonRecord {
  return {
    from: callHierarchyItem(call.caller, uri),
    fromRanges: call.ranges,
  };
}

function outgoingCallItem(call: OutgoingCall, uri: Str): JsonRecord {
  return {
    to: callHierarchyItem(call.target, uri),
    fromRanges: call.ranges,
  };
}

function incomingCalls(tokens: Token[], target: Str): IncomingCall[] {
  const calls: IncomingCall[] = [];
  for (const body of functionBodies(tokens)) {
    const ranges = callRanges(tokens, body, target);
    if (ranges.length === 0) continue;
    calls.push({ caller: body.symbol, ranges });
  }
  return calls;
}

function outgoingCalls(tokens: Token[], source: Str): OutgoingCall[] {
  const bodies = functionBodies(tokens);
  const body = functionBodyNamed(bodies, source);
  if (body === null) return [];
  return calledFunctionNames(tokens, body)
    .map((name) => outgoingCall(tokens, body, name))
    .filter((call): call is OutgoingCall => call !== null);
}

function outgoingCall(tokens: Token[], body: FunctionBody, target: Str): OutgoingCall | null {
  const symbol = functionSymbol(tokens, target);
  if (symbol === null) return null;
  const ranges = callRanges(tokens, body, target);
  if (ranges.length === 0) return null;
  return { target: symbol, ranges };
}

function calledFunctionNames(tokens: Token[], body: FunctionBody): Str[] {
  const names: Str[] = [];
  for (let index: usize = body.start; index < body.end; index += 1) {
    if (!isAnyCallIdentifier(tokens, index)) continue;
    const name = tokens[index]!.text;
    if (names.includes(name)) continue;
    names.push(name);
  }
  return names;
}

function callRanges(tokens: Token[], body: FunctionBody, target: Str): JsonValue[] {
  const ranges: JsonValue[] = [];
  for (let index: usize = body.start; index < body.end; index += 1) {
    if (!isCallIdentifier(tokens, index, target)) continue;
    ranges.push(lspRangeFromSpan(tokens[index]!.span) as unknown as JsonValue);
  }
  return ranges;
}

function functionBodyNamed(bodies: FunctionBody[], name: Str): FunctionBody | null {
  for (const body of bodies) {
    if (body.symbol.name === name) return body;
  }
  return null;
}

function functionBodies(tokens: Token[]): FunctionBody[] {
  const bodies: FunctionBody[] = [];
  for (let index: usize = 0; index < tokens.length; index += 1) {
    const symbol = functionSymbolAt(tokens, index);
    if (symbol === null) continue;
    const body = functionBody(tokens, symbol, index);
    if (body === null) continue;
    bodies.push(body);
  }
  return bodies;
}

function functionBody(tokens: Token[], symbol: FunctionSymbol, index: usize): FunctionBody | null {
  const open = nextToken(tokens, index, "{");
  if (open === null) return null;
  const close = matchingBrace(tokens, open);
  if (close === null) return null;
  return { symbol, start: open + 1, end: close };
}

function matchingBrace(tokens: Token[], open: usize): usize | null {
  let depth: usize = 0;
  for (let index: usize = open; index < tokens.length; index += 1) {
    if (tokens[index]?.text === "{") depth += 1;
    if (tokens[index]?.text !== "}") continue;
    depth -= 1;
    if (depth === 0) return index;
  }
  return null;
}

function nextToken(tokens: Token[], start: usize, text: Str): usize | null {
  for (let index: usize = start; index < tokens.length; index += 1) {
    if (tokens[index]?.text === text) return index;
  }
  return null;
}

function callHierarchyItem(symbol: FunctionSymbol, uri: Str): JsonRecord {
  const range = lspRangeFromSpan(symbol.token.span) as unknown as JsonValue;
  return {
    name: symbol.name,
    kind: FUNCTION_SYMBOL_KIND,
    uri,
    range,
    selectionRange: range,
    data: { uri, name: symbol.name },
  };
}

function functionSymbol(tokens: Token[], name: Str): FunctionSymbol | null {
  for (let index: usize = 0; index < tokens.length; index += 1) {
    const symbol = functionSymbolAt(tokens, index);
    if (symbol?.name === name) return symbol;
  }
  return null;
}

function functionSymbolAt(tokens: Token[], index: usize): FunctionSymbol | null {
  if (!isFunctionName(tokens, index)) return null;
  const token = tokens[index]!;
  return { name: token.text, token };
}

function isFunctionName(tokens: Token[], index: usize): b8 {
  return tokens[index - 1]?.text === "function" &&
    tokens[index]?.kind === "identifier" &&
    tokens[index + 1]?.text === "(";
}

function isCallIdentifier(tokens: Token[], index: usize, target: Str): b8 {
  return isAnyCallIdentifier(tokens, index) && tokens[index]?.text === target;
}

function isAnyCallIdentifier(tokens: Token[], index: usize): b8 {
  return tokens[index]?.kind === "identifier" &&
    tokens[index + 1]?.text === "(" &&
    tokens[index - 1]?.text !== "function";
}

function itemName(item: JsonRecord): Str {
  const name = item.name;
  return typeof name === "string" ? name : "";
}
