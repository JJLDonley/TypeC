import type {
  i32,
  IncomingMessage,
  JsonRecord,
  JsonRpcId,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonValue,
  Str,
  usize,
} from "lsp/types.ts";

const HEADER_SEPARATOR = "\r\n\r\n";

export function encodeMessage(message: JsonRpcResponse | JsonRpcNotification): Uint8Array {
  const body = JSON.stringify(message);
  const header = `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n`;
  return new TextEncoder().encode(header + body);
}

export function decodeMessages(input: Uint8Array): IncomingMessage[] {
  const text = new TextDecoder().decode(input);
  const messages: IncomingMessage[] = [];
  let offset: usize = 0;
  while (offset < text.length) {
    const headerEnd = text.indexOf(HEADER_SEPARATOR, offset);
    if (headerEnd < 0) break;
    const length = contentLength(text.slice(offset, headerEnd));
    const bodyStart = headerEnd + HEADER_SEPARATOR.length;
    const bodyEnd = bodyStart + length;
    if (bodyEnd > text.length) break;
    messages.push(asIncomingMessage(JSON.parse(text.slice(bodyStart, bodyEnd))));
    offset = bodyEnd;
  }
  return messages;
}

export function response(id: JsonRpcId, result: JsonValue): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function errorResponse(id: JsonRpcId, code: i32, message: Str): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export function notification(method: Str, params: JsonValue): JsonRpcNotification {
  return { jsonrpc: "2.0", method, params };
}

function contentLength(header: Str): usize {
  for (const line of header.split("\r\n")) {
    const [name, value] = line.split(":");
    if (name?.toLowerCase() === "content-length") return Number(value?.trim() ?? "0");
  }
  return 0;
}

function asIncomingMessage(value: unknown): IncomingMessage {
  const record = asRecord(value);
  const method = record.method;
  if (typeof method !== "string") throw new Error("Invalid JSON-RPC message");
  const base = { jsonrpc: "2.0" as const, method, params: asJsonValue(record.params) };
  if ("id" in record) return { ...base, id: asJsonRpcId(record.id) } satisfies JsonRpcRequest;
  return base satisfies JsonRpcNotification;
}

function asRecord(value: unknown): Record<Str, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected JSON object");
  }
  return value as Record<Str, unknown>;
}

function asJsonRpcId(value: unknown): JsonRpcId {
  if (typeof value === "number" || typeof value === "string" || value === null) return value;
  throw new Error("Invalid JSON-RPC id");
}

function asJsonValue(value: unknown): JsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => asJsonValue(entry) ?? null);
  const source = asRecord(value);
  const target: JsonRecord = {};
  for (const [key, entry] of Object.entries(source)) target[key] = asJsonValue(entry) ?? null;
  return target;
}
