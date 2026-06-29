import { documentFormattingEdits } from "lsp/formatting.ts";
import {
  incomingCallHierarchy,
  outgoingCallHierarchy,
  prepareCallHierarchy,
} from "lsp/call_hierarchy.ts";
import { codeActions } from "lsp/code_actions.ts";
import { codeLenses } from "lsp/code_lens.ts";
import { completionItems } from "lsp/completions.ts";
import { declarationLocation } from "lsp/declaration.ts";
import { documentLinks } from "lsp/document_links.ts";
import { documentSymbols } from "lsp/document_symbols.ts";
import { TextDocuments } from "lsp/documents.ts";
import { semanticDiagnostics } from "lsp/diagnostics.ts";
import { foldingRanges } from "lsp/folding_ranges.ts";
import { hoverContent } from "lsp/hover.ts";
import { inlayHints } from "lsp/inlay_hints.ts";
import { linkedEditingRanges } from "lsp/linked_editing.ts";
import {
  definitionLocation,
  documentHighlights,
  prepareRenameRange,
  referenceLocations,
  renameWorkspaceEdit,
} from "lsp/symbols.ts";
import { errorResponse, notification, response } from "lsp/json_rpc.ts";
import { rangeFormattingEdits } from "lsp/range_formatting.ts";
import {
  semanticTokenModifiers,
  semanticTokensFull,
  semanticTokenTypes,
} from "lsp/semantic_tokens.ts";
import { selectionRanges } from "lsp/selection_ranges.ts";
import { signatureHelp } from "lsp/signature_help.ts";
import { applyTextDocumentChange } from "lsp/text_changes.ts";
import { typeDefinitionLocation } from "lsp/type_definition.ts";
import { workspaceSymbols } from "lsp/workspace_symbols.ts";
import type {
  b8,
  i32,
  IncomingMessage,
  JsonRecord,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonValue,
  LspPosition,
  LspRange,
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
      case "textDocument/formatting":
        return this.formatting(message);
      case "textDocument/rangeFormatting":
        return this.rangeFormatting(message);
      case "textDocument/completion":
        return this.withResponse(message, completionItems());
      case "textDocument/hover":
        return this.hover(message);
      case "textDocument/declaration":
        return this.declaration(message);
      case "textDocument/definition":
        return this.definition(message);
      case "textDocument/typeDefinition":
        return this.typeDefinition(message);
      case "textDocument/references":
        return this.references(message);
      case "textDocument/rename":
        return this.rename(message);
      case "textDocument/prepareRename":
        return this.prepareRename(message);
      case "textDocument/linkedEditingRange":
        return this.linkedEditingRange(message);
      case "textDocument/prepareCallHierarchy":
        return this.prepareCallHierarchy(message);
      case "callHierarchy/incomingCalls":
        return this.incomingCallHierarchy(message);
      case "callHierarchy/outgoingCalls":
        return this.outgoingCallHierarchy(message);
      case "textDocument/signatureHelp":
        return this.signatureHelp(message);
      case "textDocument/documentHighlight":
        return this.documentHighlight(message);
      case "textDocument/foldingRange":
        return this.foldingRange(message);
      case "textDocument/selectionRange":
        return this.selectionRange(message);
      case "textDocument/inlayHint":
        return this.inlayHint(message);
      case "textDocument/semanticTokens/full":
        return this.semanticTokens(message);
      case "textDocument/codeAction":
        return this.codeAction(message);
      case "textDocument/codeLens":
        return this.codeLens(message);
      case "textDocument/documentSymbol":
        return this.documentSymbol(message);
      case "textDocument/documentLink":
        return this.documentLink(message);
      case "workspace/symbol":
        return this.workspaceSymbol(message);
      default:
        return this.withError(message, METHOD_NOT_FOUND, `Unknown method '${message.method}'`);
    }
  }

  shouldExit(): b8 {
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
    const text = applyTextDocumentChange(this.documents.get(uri), latest);
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
      diagnostics: semanticDiagnostics(text, uri) as unknown as JsonValue,
    });
  }

  private formatting(message: IncomingMessage): JsonRpcResponse[] {
    const document = recordField(asRecord(message.params), "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, documentFormattingEdits(text));
  }

  private rangeFormatting(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(
      message,
      rangeFormattingEdits(text, lspRange(recordField(params, "range"))),
    );
  }

  private hover(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      hoverContent(text, lspPosition(recordField(params, "position"))),
    );
  }

  private declaration(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      declarationLocation(text, uri, lspPosition(recordField(params, "position"))),
    );
  }

  private definition(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      definitionLocation(text, uri, lspPosition(recordField(params, "position"))),
    );
  }

  private typeDefinition(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      typeDefinitionLocation(text, uri, lspPosition(recordField(params, "position"))),
    );
  }

  private references(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(
      message,
      referenceLocations(
        text,
        uri,
        lspPosition(recordField(params, "position")),
        includeDeclaration(params),
      ),
    );
  }

  private rename(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      renameWorkspaceEdit(
        text,
        uri,
        lspPosition(recordField(params, "position")),
        stringField(params, "newName"),
      ),
    );
  }

  private prepareRename(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      prepareRenameRange(text, lspPosition(recordField(params, "position"))),
    );
  }

  private linkedEditingRange(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      linkedEditingRanges(text, lspPosition(recordField(params, "position"))),
    );
  }

  private prepareCallHierarchy(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      prepareCallHierarchy(text, uri, lspPosition(recordField(params, "position"))),
    );
  }

  private incomingCallHierarchy(message: IncomingMessage): JsonRpcResponse[] {
    const item = recordField(asRecord(message.params), "item");
    const uri = stringField(item, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, incomingCallHierarchy(text, uri, item));
  }

  private outgoingCallHierarchy(message: IncomingMessage): JsonRpcResponse[] {
    const item = recordField(asRecord(message.params), "item");
    const uri = stringField(item, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, outgoingCallHierarchy(text, uri, item));
  }

  private signatureHelp(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, null);
    return this.withResponse(
      message,
      signatureHelp(text, lspPosition(recordField(params, "position"))),
    );
  }

  private documentHighlight(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(
      message,
      documentHighlights(text, lspPosition(recordField(params, "position"))),
    );
  }

  private foldingRange(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, foldingRanges(text));
  }

  private selectionRange(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, selectionRanges(text, lspPositions(params)));
  }

  private inlayHint(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, inlayHints(text, uri));
  }

  private semanticTokens(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, { data: [] });
    return this.withResponse(message, semanticTokensFull(text));
  }

  private codeAction(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, codeActions(text, uri));
  }

  private codeLens(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, codeLenses(text));
  }

  private documentSymbol(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, documentSymbols(text));
  }

  private documentLink(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    const document = recordField(params, "textDocument");
    const uri = stringField(document, "uri");
    const text = this.documents.get(uri);
    if (text === null) return this.withResponse(message, []);
    return this.withResponse(message, documentLinks(text, uri));
  }

  private workspaceSymbol(message: IncomingMessage): JsonRpcResponse[] {
    const params = asRecord(message.params);
    return this.withResponse(
      message,
      workspaceSymbols(this.documents.entries(), stringField(params, "query")),
    );
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
      documentFormattingProvider: true,
      documentRangeFormattingProvider: true,
      completionProvider: { triggerCharacters: [] },
      hoverProvider: true,
      declarationProvider: true,
      definitionProvider: true,
      typeDefinitionProvider: true,
      referencesProvider: true,
      renameProvider: { prepareProvider: true },
      linkedEditingRangeProvider: true,
      callHierarchyProvider: true,
      signatureHelpProvider: { triggerCharacters: ["(", ","] },
      documentHighlightProvider: true,
      foldingRangeProvider: true,
      selectionRangeProvider: true,
      workspaceSymbolProvider: true,
      documentLinkProvider: { resolveProvider: false },
      inlayHintProvider: true,
      semanticTokensProvider: {
        legend: {
          tokenTypes: semanticTokenTypes as unknown as JsonValue,
          tokenModifiers: semanticTokenModifiers as unknown as JsonValue,
        },
        full: true,
      },
      codeActionProvider: true,
      codeLensProvider: { resolveProvider: false },
      documentSymbolProvider: true,
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

function numberField(record: JsonRecord, field: Str): i32 {
  const value = record[field];
  if (typeof value !== "number") throw new Error(`Expected number field '${field}'`);
  return value;
}

function booleanField(record: JsonRecord, field: Str): b8 {
  const value = record[field];
  if (typeof value !== "boolean") throw new Error(`Expected boolean field '${field}'`);
  return value;
}

function includeDeclaration(params: JsonRecord): b8 {
  return booleanField(recordField(params, "context"), "includeDeclaration");
}

function lspPosition(record: JsonRecord): LspPosition {
  return {
    line: numberField(record, "line"),
    character: numberField(record, "character"),
  };
}

function lspRange(record: JsonRecord): LspRange {
  return {
    start: lspPosition(recordField(record, "start")),
    end: lspPosition(recordField(record, "end")),
  };
}

function lspPositions(record: JsonRecord): LspPosition[] {
  return arrayField(record, "positions").map((position) => lspPosition(asRecord(position)));
}

function arrayField(record: JsonRecord, field: Str): JsonValue[] {
  const value = record[field];
  if (!Array.isArray(value)) throw new Error(`Expected array field '${field}'`);
  return value;
}
