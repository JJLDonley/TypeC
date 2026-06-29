import { lex } from "core/lexer.ts";
import type { Token } from "core/token.ts";
import { offsetAtPosition } from "lsp/source_positions.ts";
import type { b8, i32, JsonRecord, JsonValue, LspPosition, Str, usize } from "lsp/types.ts";

interface FunctionSignature {
  name: Str;
  parameters: Str[];
  returnType: Str;
}

interface ActiveCall {
  name: Str;
  openIndex: usize;
}

export function signatureHelp(text: Str, position: LspPosition): JsonValue {
  const tokens = lex(text);
  const call = activeCall(tokens, offsetAtPosition(text, position));
  if (call === null) return null;
  const signature = functionSignature(tokens, text, call.name);
  if (signature === null) return null;
  return signatureHelpRecord(signature, activeParameter(tokens, text, call.openIndex, position));
}

function activeCall(tokens: Token[], offset: usize): ActiveCall | null {
  let depth: i32 = 0;
  for (let index: usize = tokens.length; index > 0; index -= 1) {
    const tokenIndex: usize = index - 1;
    const token = tokens[tokenIndex]!;
    if (token.span.start.offset >= offset) continue;
    if (token.text === ")") {
      depth += 1;
      continue;
    }
    if (token.text !== "(") continue;
    if (depth > 0) {
      depth -= 1;
      continue;
    }
    return callFromOpenParen(tokens, tokenIndex);
  }
  return null;
}

function callFromOpenParen(tokens: Token[], openIndex: usize): ActiveCall | null {
  const name = tokens[openIndex - 1];
  if (name === undefined || name.kind !== "identifier") return null;
  if (isFunctionDeclarationOpen(tokens, openIndex)) return null;
  return { name: name.text, openIndex };
}

function isFunctionDeclarationOpen(tokens: Token[], openIndex: usize): b8 {
  return tokens[openIndex - 2]?.text === "function";
}

function functionSignature(tokens: Token[], text: Str, name: Str): FunctionSignature | null {
  for (let index: usize = 0; index < tokens.length; index += 1) {
    if (!isFunctionName(tokens, index, name)) continue;
    const openIndex = index + 1;
    const closeIndex = matchingCloseParen(tokens, openIndex);
    if (closeIndex === null) return null;
    return {
      name,
      parameters: parameterLabels(tokens, text, openIndex, closeIndex),
      returnType: returnTypeLabel(tokens, text, closeIndex),
    };
  }
  return null;
}

function isFunctionName(tokens: Token[], index: usize, name: Str): b8 {
  return tokens[index - 1]?.text === "function" &&
    tokens[index]?.kind === "identifier" &&
    tokens[index]?.text === name &&
    tokens[index + 1]?.text === "(";
}

function matchingCloseParen(tokens: Token[], openIndex: usize): usize | null {
  let depth: i32 = 0;
  for (let index: usize = openIndex; index < tokens.length; index += 1) {
    const text = tokens[index]!.text;
    if (text === "(") depth += 1;
    if (text !== ")") continue;
    depth -= 1;
    if (depth === 0) return index;
  }
  return null;
}

function parameterLabels(
  tokens: Token[],
  text: Str,
  openIndex: usize,
  closeIndex: usize,
): Str[] {
  const labels: Str[] = [];
  let start: usize = openIndex + 1;
  let depth: i32 = 0;
  for (let index: usize = start; index < closeIndex; index += 1) {
    const token = tokens[index]!;
    if (isNestedOpen(token.text)) depth += 1;
    if (isNestedClose(token.text)) depth -= 1;
    if (token.text !== "," || depth !== 0) continue;
    const label = tokenSlice(text, tokens, start, index);
    if (label !== "") labels.push(label);
    start = index + 1;
  }
  const label = tokenSlice(text, tokens, start, closeIndex);
  if (label !== "") labels.push(label);
  return labels;
}

function returnTypeLabel(tokens: Token[], text: Str, closeIndex: usize): Str {
  if (tokens[closeIndex + 1]?.text !== ":") return "void";
  const start: usize = closeIndex + 2;
  const end = returnTypeEnd(tokens, start);
  return tokenSlice(text, tokens, start, end);
}

function returnTypeEnd(tokens: Token[], start: usize): usize {
  for (let index: usize = start; index < tokens.length; index += 1) {
    const text = tokens[index]!.text;
    if (text === "{" || text === ";") return index;
  }
  return tokens.length - 1;
}

function activeParameter(
  tokens: Token[],
  text: Str,
  openIndex: usize,
  position: LspPosition,
): i32 {
  const offset = offsetAtPosition(text, position);
  let parameter: i32 = 0;
  let depth: i32 = 0;
  for (let index: usize = openIndex + 1; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token.span.start.offset >= offset) return parameter;
    if (token.text === "(") depth += 1;
    if (token.text === ")") {
      if (depth === 0) return parameter;
      depth -= 1;
    }
    if (token.text === "," && depth === 0) parameter += 1;
  }
  return parameter;
}

function tokenSlice(text: Str, tokens: Token[], start: usize, end: usize): Str {
  const first = tokens[start];
  const last = tokens[end - 1];
  if (first === undefined || last === undefined) return "";
  return text.slice(first.span.start.offset, last.span.end.offset).trim();
}

function signatureHelpRecord(signature: FunctionSignature, activeParameter: i32): JsonRecord {
  return {
    signatures: [signatureRecord(signature) as unknown as JsonValue],
    activeSignature: 0,
    activeParameter: clampActiveParameter(activeParameter, signature.parameters.length),
  };
}

function signatureRecord(signature: FunctionSignature): JsonRecord {
  return {
    label: signatureLabel(signature),
    parameters: signature.parameters.map(parameterRecord) as unknown as JsonValue,
  };
}

function parameterRecord(label: Str): JsonRecord {
  return { label };
}

function signatureLabel(signature: FunctionSignature): Str {
  return `${signature.name}(${signature.parameters.join(", ")}): ${signature.returnType}`;
}

function clampActiveParameter(parameter: i32, count: usize): i32 {
  if (count === 0) return 0;
  if (parameter >= count) return count - 1;
  return parameter;
}

function isNestedOpen(text: Str): b8 {
  return text === "(" || text === "[" || text === "{" || text === "<";
}

function isNestedClose(text: Str): b8 {
  return text === ")" || text === "]" || text === "}" || text === ">";
}
