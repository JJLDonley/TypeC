export type Str = string;
export type i32 = number;
export type usize = number;
export type b8 = boolean;

export type JsonPrimitive = Str | i32 | b8 | null;
export type JsonValue = JsonPrimitive | JsonArray | JsonRecord;
export interface JsonArray extends Array<JsonValue> {}
export interface JsonRecord {
  [key: Str]: JsonValue;
}

export type JsonRpcId = i32 | Str | null;

export interface JsonRpcMessage {
  jsonrpc: "2.0";
}

export interface JsonRpcRequest extends JsonRpcMessage {
  id: JsonRpcId;
  method: Str;
  params?: JsonValue;
}

export interface JsonRpcNotification extends JsonRpcMessage {
  method: Str;
  params?: JsonValue;
}

export interface JsonRpcResponse extends JsonRpcMessage {
  id: JsonRpcId;
  result?: JsonValue;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: i32;
  message: Str;
}

export type IncomingMessage = JsonRpcRequest | JsonRpcNotification;

export interface LspPosition {
  line: usize;
  character: usize;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspLocation {
  uri: Str;
  range: LspRange;
}

export interface LspRelatedDiagnosticInformation {
  location: LspLocation;
  message: Str;
}

export interface LspDiagnostic {
  range: LspRange;
  severity: i32;
  source: Str;
  message: Str;
  code?: Str;
  relatedInformation?: LspRelatedDiagnosticInformation[];
  codeDescription?: { href: Str };
}
