import { TextDocuments } from "lsp/documents.ts";
import { syntaxDiagnostics } from "lsp/diagnostics.ts";
import { errorResponse, notification, response } from "lsp/json_rpc.ts";
import type {
  i32,
  IncomingMessage,
  JsonRecord,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonValue,
  Str,
} from "lsp/types.ts";

const METHOD_NOT_FOUND = -32601;

export class LspServer {
  private readonly documents = new TextDocuments();
  private shutdownRequested = false;

  handle(message: IncomingMessage): (JsonRpcResponse | JsonRpcNotification)[] {
    switch (message.method) {
      case "initialize":
        return this.withResponse(message, initializeResult());
      case "initialized":
        return [];
      case "shutdown":
        this.shutdownRequested = true;
        return this.withResponse(message, null);
      case "exit":
        return [];
      case "textDocument/didOpen":
        return this.didOpen(message.params);
      case "textDocument/didChange":
        return this.didChange(message.params);
      case "textDocument/didClose":
        return this.didClose(message.params);
      default:
        return this.withError(message, METHOD_NOT_FOUND, `Unknown method '${message.method}'`);
    }
  }

  shouldExit(): boolean {
    return this.shutdownRequested;
  }

  private didOpen(params: JsonValue | undefined): JsonRpcNotification[] {
    const document = recordField(asRecord(params), "textDocument");
    const uri = stringField(document, "uri");
    const text = stringField(document, "text");
    this.documents.open(uri, text);
    return [this.publishDiagnostics(uri, text)];
  }

  private didChange(params: JsonValue | undefined): JsonRpcNotification[] {
    const record = asRecord(params);
    const document = recordField(record, "textDocument");
    const changes = arrayField(record, "contentChanges");
    const latest = asRecord(changes[changes.length - 1] ?? null);
    const uri = stringField(document, "uri");
    const text = stringField(latest, "text");
    this.documents.change(uri, text);
    return [this.publishDiagnostics(uri, text)];
  }

  private didClose(params: JsonValue | undefined): JsonRpcNotification[] {
    const document = recordField(asRecord(params), "textDocument");
    const uri = stringField(document, "uri");
    this.documents.close(uri);
    return [this.publishDiagnostics(uri, "")];
  }

  private publishDiagnostics(uri: Str, text: Str): JsonRpcNotification {
    return notification("textDocument/publishDiagnostics", {
      uri,
      diagnostics: syntaxDiagnostics(text) as unknown as JsonValue,
    });
  }

  private withResponse(
    message: IncomingMessage,
    result: JsonValue,
  ): JsonRpcResponse[] {
    if (!("id" in message)) return [];
    return [response(message.id, result)];
  }

  private withError(
    message: IncomingMessage,
    code: i32,
    text: Str,
  ): JsonRpcResponse[] {
    if (!("id" in message)) return [];
    return [errorResponse(message.id, code, text)];
  }
}

function initializeResult(): JsonRecord {
  return {
    capabilities: {
      textDocumentSync: 1,
    },
    serverInfo: {
      name: "typec-lsp",
    },
  };
}

function asRecord(value: JsonValue | undefined): JsonRecord {
  if (value === undefined || value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Expected object parameter");
  }
  return value;
}

function recordField(record: JsonRecord, field: Str): JsonRecord {
  return asRecord(record[field]);
}

function stringField(record: JsonRecord, field: Str): Str {
  const value = record[field];
  if (typeof value !== "string") throw new Error(`Expected string field '${field}'`);
  return value;
}

function arrayField(record: JsonRecord, field: Str): JsonValue[] {
  const value = record[field];
  if (!Array.isArray(value)) throw new Error(`Expected array field '${field}'`);
  return value;
}
