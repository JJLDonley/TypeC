import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { lspRangeFromSpan } from "lsp/source_positions.ts";
import type { b8, JsonRecord, JsonValue, Str, usize } from "lsp/types.ts";

interface FunctionNameToken {
  name: Str;
  token: Token;
}

export function codeLenses(text: Str): JsonValue {
  const tokens = lex(text);
  return functionCodeLenses(tokens, functionNameTokens(tokens)) as unknown as JsonValue;
}

function functionCodeLenses(tokens: Token[], functions: FunctionNameToken[]): JsonRecord[] {
  return functions.map((functionName) => codeLens(tokens, functionName));
}

function codeLens(tokens: Token[], functionName: FunctionNameToken): JsonRecord {
  const count = referenceCount(tokens, functionName);
  return {
    range: lspRangeFromSpan(functionName.token.span) as unknown as JsonValue,
    command: {
      title: referenceTitle(count),
      command: "",
    },
  };
}

function referenceTitle(count: usize): Str {
  if (count === 1) return "1 reference";
  return `${count} references`;
}

function referenceCount(tokens: Token[], functionName: FunctionNameToken): usize {
  let count: usize = 0;
  for (const token of tokens) {
    if (!isNameReference(token, functionName)) continue;
    count += 1;
  }
  return count;
}

function isNameReference(token: Token, functionName: FunctionNameToken): b8 {
  return token.kind === "identifier" &&
    token.text === functionName.name &&
    token.span.start.offset !== functionName.token.span.start.offset;
}

function functionNameTokens(tokens: Token[]): FunctionNameToken[] {
  const functions: FunctionNameToken[] = [];
  for (let index: usize = 0; index < tokens.length; index += 1) {
    if (!isFunctionName(tokens, index)) continue;
    const token = tokens[index]!;
    functions.push({ name: token.text, token });
  }
  return functions;
}

function isFunctionName(tokens: Token[], index: usize): b8 {
  return tokens[index - 1]?.text === "function" &&
    tokens[index]?.kind === "identifier" &&
    tokens[index + 1]?.text === "(";
}
