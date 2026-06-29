import { LspServer } from "lsp/server.ts";
import type {
  JsonRecord,
  JsonRpcNotification,
  JsonRpcResponse,
  JsonValue,
  Str,
} from "lsp/types.ts";

Deno.test("LSP server initializes", () => {
  const server = new LspServer();
  const output = server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  if (output.length !== 1) throw new Error("Expected initialize response");
  const result = asRecord(responseResult(output[0]!));
  const capabilities = recordField(result, "capabilities");
  assertSame(capabilities.documentFormattingProvider, true);
  assertSame(capabilities.documentRangeFormattingProvider, true);
  assertSame(capabilities.hoverProvider, true);
  assertSame(capabilities.declarationProvider, true);
  assertSame(capabilities.definitionProvider, true);
  assertSame(capabilities.typeDefinitionProvider, true);
  assertSame(capabilities.referencesProvider, true);
  const renameProvider = recordField(capabilities, "renameProvider");
  assertSame(renameProvider.prepareProvider, true);
  assertSame(capabilities.linkedEditingRangeProvider, true);
  assertSame(capabilities.callHierarchyProvider, true);
  const signatureHelpProvider = recordField(capabilities, "signatureHelpProvider");
  const triggerCharacters = asArray(signatureHelpProvider.triggerCharacters!);
  if (!triggerCharacters.includes("(")) throw new Error("Expected signature trigger");
  assertSame(capabilities.documentHighlightProvider, true);
  assertSame(capabilities.foldingRangeProvider, true);
  assertSame(capabilities.selectionRangeProvider, true);
  assertSame(capabilities.workspaceSymbolProvider, true);
  const documentLinkProvider = recordField(capabilities, "documentLinkProvider");
  assertSame(documentLinkProvider.resolveProvider, false);
  assertSame(capabilities.inlayHintProvider, true);
  const semanticTokensProvider = recordField(capabilities, "semanticTokensProvider");
  assertSame(semanticTokensProvider.full, true);
  assertSame(capabilities.codeActionProvider, true);
  const codeLensProvider = recordField(capabilities, "codeLensProvider");
  assertSame(codeLensProvider.resolveProvider, false);
  assertSame(capabilities.documentSymbolProvider, true);
});

Deno.test("LSP server publishes diagnostics for opened documents", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(: i32 { return 0; }");
  if (output.length !== 1) throw new Error("Expected diagnostics notification");
  const message = output[0]!;
  if (!isNotification(message) || message.method !== "textDocument/publishDiagnostics") {
    throw new Error("Expected diagnostics notification");
  }
});

Deno.test("LSP server publishes related diagnostic information", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "type Point = { readonly x: i32; }; function main(): i32 { const p: Point = { x: 1 }; p.x = 2; return p.x; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasRelated = diagnostics.some((item) => {
    const diagnostic = asRecord(item);
    const description = asRecord(diagnostic.codeDescription!);
    return diagnostic.code === "E0182" &&
      description.href === "https://typec.dev/diagnostics/E0182" &&
      asArray(diagnostic.relatedInformation!).length === 1;
  });
  if (!hasRelated) throw new Error("Expected related diagnostic information");
});

Deno.test("LSP server publishes semantic diagnostics", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): i32 { return missing; }");
  const params = notificationParams(output[0]!);
  const diagnostics = arrayField(params, "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.message, "Unknown identifier 'missing'");
  assertSame(diagnostic.code, "E0001");
});

Deno.test("LSP server publishes type-check diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function id(value: i32): i32 { return value; } function main(): i32 { return id(true); }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.code, "E0101");
});

Deno.test("LSP server publishes aggregate diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "type User = { id: i32; }; function main(): i32 { const user: User = { name: 1 }; return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasUnknownField = diagnostics.some((item) => asRecord(item).code === "E0202");
  if (!hasUnknownField) throw new Error("Expected unknown record field diagnostic code");
});

Deno.test("LSP server publishes slice diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function main(): i32 { const values: Array<i32, 2> = [1, 2]; const bad: Slice<i32> = values.slice(0, 3); return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasSliceBounds = diagnostics.some((item) => asRecord(item).code === "E0303");
  if (!hasSliceBounds) throw new Error("Expected slice bounds diagnostic code");
});

Deno.test("LSP server publishes optional diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): i32 { const value = Some(1); return 0; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.code, "E0400");
});

Deno.test("LSP server publishes control-flow diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): i32 { if (1) { return 0; } return 0; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.code, "E0600");
});

Deno.test("LSP server publishes index diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function main(): i32 { const values: Array<i32, 2> = [1, 2]; return values[2]; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.code, "E0702");
});

Deno.test("LSP server publishes field access diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "type User = { id: i32; }; function main(): i32 { const user: User = { id: 1 }; return user.name; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.code, "E0801");
});

Deno.test("LSP server publishes optional operator diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): i32 { return 1 ?? 2; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.code, "E0901");
});

Deno.test("LSP server publishes operator diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): i32 { return 1 + true; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.code, "E1000");
});

Deno.test("LSP server publishes literal diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): i32 { const value: u8 = 300; return 0; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasRange = diagnostics.some((item) => asRecord(item).code === "E1100");
  if (!hasRange) throw new Error("Expected integer literal range diagnostic code");
});

Deno.test("LSP server publishes function diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): u32 { return 0; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasMainReturn = diagnostics.some((item) => asRecord(item).code === "E1204");
  if (!hasMainReturn) throw new Error("Expected main return diagnostic code");
});

Deno.test("LSP server publishes generic diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function id<T, T>(value: i32): i32 { return value; } function main(): i32 { return id<i32>(1); }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasDuplicateGeneric = diagnostics.some((item) => asRecord(item).code === "E1300");
  if (!hasDuplicateGeneric) throw new Error("Expected duplicate generic diagnostic code");
});

Deno.test("LSP server publishes enum and union diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "enum Key: u8 { A = 1, A = 2 } function main(): i32 { return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasDuplicateEnum = diagnostics.some((item) => asRecord(item).code === "E1400");
  if (!hasDuplicateEnum) throw new Error("Expected duplicate enum diagnostic code");
});

Deno.test("LSP server publishes type reference diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): Missing { return 0; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasUnknownType = diagnostics.some((item) => asRecord(item).code === "E1508");
  if (!hasUnknownType) throw new Error("Expected unknown type diagnostic code");
});

Deno.test("LSP server publishes lexer diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): i32 { return $; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasUnexpectedCharacter = diagnostics.some((item) => asRecord(item).code === "E1600");
  if (!hasUnexpectedCharacter) throw new Error("Expected lexer diagnostic code");
});

Deno.test("LSP server publishes parser diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(: i32 { return 0; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasParserError = diagnostics.some((item) => asRecord(item).code === "E1700");
  if (!hasParserError) throw new Error("Expected parser diagnostic code");
});

Deno.test("LSP server publishes C ABI diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "extern function pair(): Slice<i32>; function main(): i32 { return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasCAbiReturn = diagnostics.some((item) => asRecord(item).code === "E1800");
  if (!hasCAbiReturn) throw new Error("Expected C ABI diagnostic code");
});

Deno.test("LSP server publishes array diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function main(): i32 { let values: i32[2] = [1, 2, 3]; return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasArrayLength = diagnostics.some((item) => asRecord(item).code === "E1904");
  if (!hasArrayLength) throw new Error("Expected array diagnostic code");
});

Deno.test("LSP server publishes declaration inference diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "type A = B; type B = i32; function main(): i32 { return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasTypeAliasOrder = diagnostics.some((item) => asRecord(item).code === "E2002");
  if (!hasTypeAliasOrder) throw new Error("Expected declaration inference diagnostic code");
});

Deno.test("LSP server publishes conditional and statement diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(server, "function main(): i32 { 1; return 0; }");
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasExpressionStatement = diagnostics.some((item) => asRecord(item).code === "E2100");
  if (!hasExpressionStatement) throw new Error("Expected conditional or statement diagnostic code");
});

Deno.test("LSP server publishes interface diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "interface Drawable { draw(): void; draw(): void; } function main(): i32 { return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasDuplicateMethod = diagnostics.some((item) => asRecord(item).code === "E2200");
  if (!hasDuplicateMethod) throw new Error("Expected interface diagnostic code");
});

Deno.test("LSP server publishes pointer and constant diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "const value: i32 = make(); function make(): i32 { return 1; } function main(): i32 { return value; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasConstantExpression = diagnostics.some((item) => asRecord(item).code === "E2307");
  if (!hasConstantExpression) throw new Error("Expected pointer or constant diagnostic code");
});

Deno.test("LSP server publishes assignment diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function main(): i32 { const value: i32 = 1; value = 2; return value; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasConstAssignment = diagnostics.some((item) => asRecord(item).code === "E2400");
  if (!hasConstAssignment) throw new Error("Expected assignment diagnostic code");
});

Deno.test("LSP server publishes tuple and basic expression diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function main(): i32 { const pair: [i32, i32] = [1]; return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasTupleLength = diagnostics.some((item) => asRecord(item).code === "E2501");
  if (!hasTupleLength) throw new Error("Expected tuple diagnostic code");
});

Deno.test("LSP server publishes arrow function diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function main(): i32 { const f = (x) => x; return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasArrowContext = diagnostics.some((item) => asRecord(item).code === "E2600");
  if (!hasArrowContext) throw new Error("Expected arrow function diagnostic code");
});

Deno.test("LSP server publishes class lowering diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "class Child extends Missing {} function main(): i32 { return 0; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasUnknownBase = diagnostics.some((item) => asRecord(item).code === "E2709");
  if (!hasUnknownBase) throw new Error("Expected class lowering diagnostic code");
});

Deno.test("LSP server publishes expression helper diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "const value: i32 = 1; function main(): i32 { return value satisfies u8; }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasSatisfies = diagnostics.some((item) => asRecord(item).code === "E3005");
  if (!hasSatisfies) throw new Error("Expected expression helper diagnostic code");
});

Deno.test("LSP server publishes parameter diagnostic codes", () => {
  const server = new LspServer();
  const output = openDocument(
    server,
    "function bad(value: i32 = true): i32 { return value; } function main(): i32 { return bad(); }",
  );
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const hasDefaultType = diagnostics.some((item) => asRecord(item).code === "E3201");
  if (!hasDefaultType) throw new Error("Expected parameter diagnostic code");
});

Deno.test("LSP server returns completions", () => {
  const server = new LspServer();
  openDocument(server, "");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 3,
    method: "textDocument/completion",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 0 } },
  });
  const completions = asArray(responseResult(output[0]!));
  const labels = completions.map((item) => stringField(asRecord(item), "label"));
  if (!labels.includes("function")) throw new Error("Expected function completion");
});

Deno.test("LSP server returns hover content", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 4,
    method: "textDocument/hover",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 9 } },
  });
  const hover = asRecord(responseResult(output[0]!));
  const contents = recordField(hover, "contents");
  assertSame(contents.value, "```typec\nfunction main\n```");
});

Deno.test("LSP server returns null hover for whitespace", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 5,
    method: "textDocument/hover",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 8 } },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server returns declaration locations", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { const value: i32 = 1; return value; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 32,
    method: "textDocument/declaration",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 55 } },
  });
  const location = asRecord(responseResult(output[0]!));
  const range = recordField(location, "range");
  const start = recordField(range, "start");
  assertSame(location.uri, "file:///main.tc");
  assertSame(start.line, 0);
  assertSame(start.character, 29);
});

Deno.test("LSP server returns null declaration for whitespace", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 33,
    method: "textDocument/declaration",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 8 } },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server returns definition locations", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function helper(): i32 { return 1; }\nfunction main(): i32 { return helper(); }",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 6,
    method: "textDocument/definition",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 1, character: 31 } },
  });
  const location = asRecord(responseResult(output[0]!));
  const range = recordField(location, "range");
  const start = recordField(range, "start");
  assertSame(location.uri, "file:///main.tc");
  assertSame(start.line, 0);
  assertSame(start.character, 9);
});

Deno.test("LSP server returns null definition for unknown identifiers", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return missing; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 7,
    method: "textDocument/definition",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 31 } },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server returns type definition locations", () => {
  const server = new LspServer();
  openDocument(
    server,
    "struct Point { x: i32; y: i32; }\nfunction origin(): Point { return { x: 0, y: 0 }; }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 30,
    method: "textDocument/typeDefinition",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 1, character: 19 } },
  });
  const location = asRecord(responseResult(output[0]!));
  const range = recordField(location, "range");
  const start = recordField(range, "start");
  assertSame(location.uri, "file:///main.tc");
  assertSame(start.line, 0);
  assertSame(start.character, 7);
});

Deno.test("LSP server returns null type definition for value declarations", () => {
  const server = new LspServer();
  openDocument(server, "const Point: i32 = 1;\nfunction main(): i32 { return Point; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 31,
    method: "textDocument/typeDefinition",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 1, character: 32 } },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server returns references", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function helper(): i32 { return 1; }\nfunction main(): i32 { return helper(); }",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 8,
    method: "textDocument/references",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 1, character: 31 },
      context: { includeDeclaration: true },
    },
  });
  const references = asArray(responseResult(output[0]!));
  if (references.length !== 2) throw new Error("Expected declaration and use references");
  const first = asRecord(references[0]!);
  const firstRange = recordField(first, "range");
  const firstStart = recordField(firstRange, "start");
  assertSame(firstStart.line, 0);
  assertSame(firstStart.character, 9);
});

Deno.test("LSP server excludes declaration references when requested", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function helper(): i32 { return 1; }\nfunction main(): i32 { return helper(); }",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 9,
    method: "textDocument/references",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 1, character: 31 },
      context: { includeDeclaration: false },
    },
  });
  const references = asArray(responseResult(output[0]!));
  if (references.length !== 1) throw new Error("Expected one use reference");
  const reference = asRecord(references[0]!);
  const range = recordField(reference, "range");
  const start = recordField(range, "start");
  assertSame(start.line, 1);
});

Deno.test("LSP server returns rename edits", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function helper(): i32 { return 1; }\nfunction main(): i32 { return helper(); }",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 10,
    method: "textDocument/rename",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 1, character: 31 },
      newName: "renamed",
    },
  });
  const edit = asRecord(responseResult(output[0]!));
  const changes = recordField(edit, "changes");
  const edits = asArray(changes["file:///main.tc"]!);
  if (edits.length !== 2) throw new Error("Expected declaration and use rename edits");
  const first = asRecord(edits[0]!);
  assertSame(first.newText, "renamed");
});

Deno.test("LSP server returns null rename for whitespace", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 11,
    method: "textDocument/rename",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 0, character: 8 },
      newName: "renamed",
    },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server prepares rename", () => {
  const server = new LspServer();
  openDocument(server, "function main(value: i32): i32 { return value; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 12,
    method: "textDocument/prepareRename",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 0, character: 14 },
    },
  });
  const result = asRecord(responseResult(output[0]!));
  const range = recordField(result, "range");
  const start = recordField(range, "start");
  assertSame(result.placeholder, "value");
  assertSame(start.character, 14);
});

Deno.test("LSP server returns null prepare rename for whitespace", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 13,
    method: "textDocument/prepareRename",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 0, character: 8 },
    },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server returns linked editing ranges", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { const value: i32 = 1; return value; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 34,
    method: "textDocument/linkedEditingRange",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 55 } },
  });
  const result = asRecord(responseResult(output[0]!));
  const ranges = asArray(result.ranges!);
  if (ranges.length !== 2) throw new Error("Expected two linked ranges");
  assertSame(result.wordPattern, "[A-Za-z_][A-Za-z0-9_]*");
});

Deno.test("LSP server returns null linked editing ranges for unknown identifiers", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return missing; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 35,
    method: "textDocument/linkedEditingRange",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 31 } },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server prepares call hierarchy", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function add(a: i32, b: i32): i32 { return a + b; }\nfunction main(): i32 { return add(1, 2); }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 36,
    method: "textDocument/prepareCallHierarchy",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 1, character: 31 } },
  });
  const items = asArray(responseResult(output[0]!));
  if (items.length !== 1) throw new Error("Expected one call hierarchy item");
  const item = asRecord(items[0]!);
  assertSame(item.name, "add");
  assertSame(item.kind, 12);
  assertSame(item.uri, "file:///main.tc");
});

Deno.test("LSP server returns null call hierarchy for non-functions", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { const value: i32 = 1; return value; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 37,
    method: "textDocument/prepareCallHierarchy",
    params: { textDocument: { uri: "file:///main.tc" }, position: { line: 0, character: 55 } },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server returns incoming call hierarchy", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function add(a: i32): i32 { return a; }\nfunction main(): i32 { return add(1) + add(2); }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 38,
    method: "callHierarchy/incomingCalls",
    params: { item: { name: "add", kind: 12, uri: "file:///main.tc" } },
  });
  const calls = asArray(responseResult(output[0]!));
  if (calls.length !== 1) throw new Error("Expected one incoming caller");
  const call = asRecord(calls[0]!);
  const from = recordField(call, "from");
  assertSame(from.name, "main");
  const ranges = arrayField(call, "fromRanges");
  assertSame(ranges.length, 2);
});

Deno.test("LSP server returns no incoming calls for unopened documents", () => {
  const server = new LspServer();
  const output = server.handle({
    jsonrpc: "2.0",
    id: 39,
    method: "callHierarchy/incomingCalls",
    params: { item: { name: "add", kind: 12, uri: "file:///missing.tc" } },
  });
  const calls = asArray(responseResult(output[0]!));
  assertSame(calls.length, 0);
});

Deno.test("LSP server returns outgoing call hierarchy", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function add(a: i32): i32 { return a; }\nfunction sub(a: i32): i32 { return a; }\nfunction main(): i32 { return add(1) + sub(2) + add(3); }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 40,
    method: "callHierarchy/outgoingCalls",
    params: { item: { name: "main", kind: 12, uri: "file:///main.tc" } },
  });
  const calls = asArray(responseResult(output[0]!));
  if (calls.length !== 2) throw new Error("Expected two outgoing callees");
  const first = asRecord(calls[0]!);
  const firstTarget = recordField(first, "to");
  assertSame(firstTarget.name, "add");
  assertSame(arrayField(first, "fromRanges").length, 2);
  const second = asRecord(calls[1]!);
  const secondTarget = recordField(second, "to");
  assertSame(secondTarget.name, "sub");
  assertSame(arrayField(second, "fromRanges").length, 1);
});

Deno.test("LSP server returns no outgoing calls for unknown functions", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 41,
    method: "callHierarchy/outgoingCalls",
    params: { item: { name: "missing", kind: 12, uri: "file:///main.tc" } },
  });
  const calls = asArray(responseResult(output[0]!));
  assertSame(calls.length, 0);
});

Deno.test("LSP server returns signature help", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function add(left: i32, right: i32): i32 { return left + right; }\nfunction main(): i32 { return add(1, 2); }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 14,
    method: "textDocument/signatureHelp",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 1, character: 36 },
    },
  });
  const result = asRecord(responseResult(output[0]!));
  const signatures = asArray(result.signatures!);
  const signature = asRecord(signatures[0]!);
  assertSame(signature.label, "add(left: i32, right: i32): i32");
  assertSame(result.activeParameter, 1);
});

Deno.test("LSP server returns null signature help outside calls", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 15,
    method: "textDocument/signatureHelp",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 0, character: 9 },
    },
  });
  assertSame(responseResult(output[0]!), null);
});

Deno.test("LSP server returns document highlights", () => {
  const server = new LspServer();
  openDocument(server, "function main(value: i32): i32 { return value; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 16,
    method: "textDocument/documentHighlight",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 0, character: 14 },
    },
  });
  const highlights = asArray(responseResult(output[0]!));
  if (highlights.length !== 2) throw new Error("Expected declaration and use highlights");
  const first = asRecord(highlights[0]!);
  const range = recordField(first, "range");
  const start = recordField(range, "start");
  assertSame(start.character, 14);
});

Deno.test("LSP server returns no document highlights for whitespace", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 17,
    method: "textDocument/documentHighlight",
    params: {
      textDocument: { uri: "file:///main.tc" },
      position: { line: 0, character: 8 },
    },
  });
  const highlights = asArray(responseResult(output[0]!));
  if (highlights.length !== 0) throw new Error("Expected no highlights");
});

Deno.test("LSP server returns folding ranges", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 {\n  if true {\n    return 1;\n  }\n  return 0;\n}\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 18,
    method: "textDocument/foldingRange",
    params: { textDocument: { uri: "file:///main.tc" } },
  });
  const ranges = asArray(responseResult(output[0]!));
  if (ranges.length !== 2) throw new Error("Expected block folding ranges");
  const outer = asRecord(ranges[1]!);
  assertSame(outer.startLine, 0);
  assertSame(outer.endLine, 5);
});

Deno.test("LSP server ignores single-line folding ranges", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 19,
    method: "textDocument/foldingRange",
    params: { textDocument: { uri: "file:///main.tc" } },
  });
  const ranges = asArray(responseResult(output[0]!));
  if (ranges.length !== 0) throw new Error("Expected no folding ranges");
});

Deno.test("LSP server returns selection ranges", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 {\n  if true {\n    return 1;\n  }\n}\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 20,
    method: "textDocument/selectionRange",
    params: {
      textDocument: { uri: "file:///main.tc" },
      positions: [{ line: 2, character: 4 }],
    },
  });
  const ranges = asArray(responseResult(output[0]!));
  const tokenRange = asRecord(ranges[0]!);
  const tokenStart = recordField(recordField(tokenRange, "range"), "start");
  const innerRange = recordField(tokenRange, "parent");
  const innerStart = recordField(recordField(innerRange, "range"), "start");
  const outerRange = recordField(innerRange, "parent");
  const outerStart = recordField(recordField(outerRange, "range"), "start");
  assertSame(tokenStart.line, 2);
  assertSame(tokenStart.character, 4);
  assertSame(innerStart.line, 1);
  assertSame(outerStart.line, 0);
});

Deno.test("LSP server returns no selection range for whitespace", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 {\n  return 0;\n}\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 21,
    method: "textDocument/selectionRange",
    params: {
      textDocument: { uri: "file:///main.tc" },
      positions: [{ line: 0, character: 8 }],
    },
  });
  const ranges = asArray(responseResult(output[0]!));
  if (ranges.length !== 0) throw new Error("Expected no selection ranges");
});

Deno.test("LSP server returns inlay hints", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function add(left: i32, right: i32): i32 { return left + right; }\nfunction main(): i32 { return add(1, 2); }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 24,
    method: "textDocument/inlayHint",
    params: {
      textDocument: { uri: "file:///main.tc" },
      range: { start: { line: 0, character: 0 }, end: { line: 1, character: 40 } },
    },
  });
  const hints = asArray(responseResult(output[0]!));
  if (hints.length !== 2) throw new Error("Expected two inlay hints");
  assertSame(stringField(asRecord(hints[0]!), "label"), "left:");
  assertSame(stringField(asRecord(hints[1]!), "label"), "right:");
});

Deno.test("LSP server returns inferred type inlay hints", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { const value = 42; return value; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 26,
    method: "textDocument/inlayHint",
    params: {
      textDocument: { uri: "file:///main.tc" },
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 60 } },
    },
  });
  const hints = asArray(responseResult(output[0]!));
  if (!hints.some((hint) => stringField(asRecord(hint), "label") === ": i32")) {
    throw new Error("Expected inferred local type hint");
  }
});

Deno.test("LSP server returns inferred generic argument inlay hints", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function identity<T>(value: T): T { return value; }\nfunction main(): i32 { return identity(42); }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 27,
    method: "textDocument/inlayHint",
    params: {
      textDocument: { uri: "file:///main.tc" },
      range: { start: { line: 0, character: 0 }, end: { line: 1, character: 60 } },
    },
  });
  const hints = asArray(responseResult(output[0]!));
  if (!hints.some((hint) => stringField(asRecord(hint), "label") === "<i32>")) {
    throw new Error("Expected inferred generic argument hint");
  }
});

Deno.test("LSP server omits inlay hints for unknown calls", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return add(1, 2); }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 25,
    method: "textDocument/inlayHint",
    params: {
      textDocument: { uri: "file:///main.tc" },
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 40 } },
    },
  });
  const hints = asArray(responseResult(output[0]!));
  assertSame(hints.length, 0);
});

Deno.test("LSP server returns semantic tokens", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 12,
    method: "textDocument/semanticTokens/full",
    params: { textDocument: { uri: "file:///main.tc" } },
  });
  const result = asRecord(responseResult(output[0]!));
  const data = asArray(result.data!);
  if (data.length === 0) throw new Error("Expected semantic token data");
  assertSame(data[0], 0);
  assertSame(data[1], 0);
});

Deno.test("LSP server returns format code actions", () => {
  const server = new LspServer();
  openDocument(server, "function main():i32{return 0;}");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 13,
    method: "textDocument/codeAction",
    params: {
      textDocument: { uri: "file:///main.tc" },
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      context: { diagnostics: [] },
    },
  });
  const actions = asArray(responseResult(output[0]!));
  const action = asRecord(actions[0]!);
  assertSame(action.title, "Format document");
  assertSame(action.kind, "source.format");
});

Deno.test("LSP server returns no code actions for formatted documents", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 {\n  return 0;\n}\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 14,
    method: "textDocument/codeAction",
    params: {
      textDocument: { uri: "file:///main.tc" },
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      context: { diagnostics: [] },
    },
  });
  const actions = asArray(responseResult(output[0]!));
  if (actions.length !== 0) throw new Error("Expected no code actions");
});

Deno.test("LSP server returns code lenses", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function add(a: i32, b: i32): i32 { return a + b; }\nfunction main(): i32 { return add(1, 2); }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 28,
    method: "textDocument/codeLens",
    params: { textDocument: { uri: "file:///main.tc" } },
  });
  const lenses = asArray(responseResult(output[0]!));
  if (lenses.length !== 2) throw new Error("Expected two code lenses");
  const firstCommand = recordField(asRecord(lenses[0]!), "command");
  assertSame(firstCommand.title, "1 reference");
  const secondCommand = recordField(asRecord(lenses[1]!), "command");
  assertSame(secondCommand.title, "0 references");
});

Deno.test("LSP server returns no code lenses for unopened documents", () => {
  const server = new LspServer();
  const output = server.handle({
    jsonrpc: "2.0",
    id: 29,
    method: "textDocument/codeLens",
    params: { textDocument: { uri: "file:///missing.tc" } },
  });
  const lenses = asArray(responseResult(output[0]!));
  assertSame(lenses.length, 0);
});

Deno.test("LSP server returns document symbols", () => {
  const server = new LspServer();
  openDocument(
    server,
    "function main(value: i32): i32 {\n  const answer: i32 = value;\n  return answer;\n}\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 15,
    method: "textDocument/documentSymbol",
    params: { textDocument: { uri: "file:///main.tc" } },
  });
  const symbols = asArray(responseResult(output[0]!));
  const names = symbols.map((symbol) => stringField(asRecord(symbol), "name"));
  if (!names.includes("main")) throw new Error("Expected function symbol");
  if (!names.includes("value")) throw new Error("Expected parameter symbol");
  if (!names.includes("answer")) throw new Error("Expected local symbol");
});

Deno.test("LSP server returns document links", () => {
  const server = new LspServer();
  openDocumentUri(
    server,
    "file:///project/src/main.tc",
    'import { add } from "./math.tc";\nfunction main(): i32 { return add(1, 2); }\n',
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 22,
    method: "textDocument/documentLink",
    params: { textDocument: { uri: "file:///project/src/main.tc" } },
  });
  const links = asArray(responseResult(output[0]!));
  if (links.length !== 1) throw new Error("Expected one document link");
  const link = asRecord(links[0]!);
  assertSame(link.target, "file:///project/src/math.tc");
});

Deno.test("LSP server returns bare non-relative document links", () => {
  const server = new LspServer();
  openDocumentUri(server, "file:///main.tc", 'import { exit } from "std/process.tc";\n');
  const output = server.handle({
    jsonrpc: "2.0",
    id: 23,
    method: "textDocument/documentLink",
    params: { textDocument: { uri: "file:///main.tc" } },
  });
  const links = asArray(responseResult(output[0]!));
  const link = asRecord(links[0]!);
  assertSame(link.target, "std/process.tc");
});

Deno.test("LSP server returns workspace symbols from opened documents", () => {
  const server = new LspServer();
  openDocumentUri(server, "file:///main.tc", "function main(): i32 { return 0; }\n");
  openDocumentUri(
    server,
    "file:///math.tc",
    "function add(a: i32, b: i32): i32 { return a + b; }\n",
  );
  const output = server.handle({
    jsonrpc: "2.0",
    id: 22,
    method: "workspace/symbol",
    params: { query: "add" },
  });
  const symbols = asArray(responseResult(output[0]!));
  if (symbols.length !== 1) throw new Error("Expected one workspace symbol");
  const symbol = asRecord(symbols[0]!);
  const location = recordField(symbol, "location");
  assertSame(symbol.name, "add");
  assertSame(location.uri, "file:///math.tc");
});

Deno.test("LSP server returns all workspace symbols for empty query", () => {
  const server = new LspServer();
  openDocumentUri(server, "file:///main.tc", "function main(): i32 { return 0; }\n");
  openDocumentUri(server, "file:///types.tc", "struct Point { x: i32; y: i32; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 23,
    method: "workspace/symbol",
    params: { query: "" },
  });
  const symbols = asArray(responseResult(output[0]!));
  const names = symbols.map((symbol) => stringField(asRecord(symbol), "name"));
  if (!names.includes("main")) throw new Error("Expected main symbol");
  if (!names.includes("Point")) throw new Error("Expected Point symbol");
});

Deno.test("LSP server formats ranges", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 {\nreturn 0;\n}\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 26,
    method: "textDocument/rangeFormatting",
    params: {
      textDocument: { uri: "file:///main.tc" },
      range: { start: { line: 1, character: 0 }, end: { line: 2, character: 0 } },
      options: { tabSize: 2, insertSpaces: true },
    },
  });
  const edits = asArray(responseResult(output[0]!));
  const edit = asRecord(edits[0] ?? null);
  assertSame(edit.newText, "return 0;\n");
});

Deno.test("LSP server returns no range edits for empty ranges", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }\n");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 27,
    method: "textDocument/rangeFormatting",
    params: {
      textDocument: { uri: "file:///main.tc" },
      range: { start: { line: 0, character: 8 }, end: { line: 0, character: 8 } },
      options: { tabSize: 2, insertSpaces: true },
    },
  });
  const edits = asArray(responseResult(output[0]!));
  assertSame(edits.length, 0);
});

Deno.test("LSP server applies partial changes before diagnostics", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return 0; }");
  const output = server.handle({
    jsonrpc: "2.0",
    method: "textDocument/didChange",
    params: {
      textDocument: { uri: "file:///main.tc", version: 2 },
      contentChanges: [{
        range: { start: { line: 0, character: 30 }, end: { line: 0, character: 31 } },
        text: "true",
      }],
    },
  });
  const diagnostics = arrayField(notificationParams(output[0]!), "diagnostics");
  const diagnostic = asRecord(diagnostics[0] ?? null);
  assertSame(diagnostic.message, "Return type 'bool' is not assignable to 'i32'");
});

Deno.test("LSP server returns no formatting edits for semantically invalid documents", () => {
  const server = new LspServer();
  openDocument(server, "function main(): i32 { return true; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 28,
    method: "textDocument/formatting",
    params: {
      textDocument: { uri: "file:///main.tc" },
      options: { tabSize: 2, insertSpaces: true },
    },
  });
  const edits = asArray(responseResult(output[0]!));
  assertSame(edits.length, 0);
});

Deno.test("LSP server returns no formatting edits for syntactically invalid documents", () => {
  const server = new LspServer();
  openDocument(server, "function main(: i32 { return 0; }");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 29,
    method: "textDocument/formatting",
    params: {
      textDocument: { uri: "file:///main.tc" },
      options: { tabSize: 2, insertSpaces: true },
    },
  });
  const edits = asArray(responseResult(output[0]!));
  assertSame(edits.length, 0);
});

Deno.test("LSP server formats documents", () => {
  const server = new LspServer();
  openDocument(server, "function main():i32{return 0;}");
  const output = server.handle({
    jsonrpc: "2.0",
    id: 2,
    method: "textDocument/formatting",
    params: {
      textDocument: { uri: "file:///main.tc" },
      options: { tabSize: 2, insertSpaces: true },
    },
  });
  const edits = asArray(responseResult(output[0]!));
  const edit = asRecord(edits[0] ?? null);
  assertSame(edit.newText, "function main(): i32 {\n  return 0;\n}\n");
});

function openDocument(server: LspServer, text: Str): (JsonRpcResponse | JsonRpcNotification)[] {
  return openDocumentUri(server, "file:///main.tc", text);
}

function openDocumentUri(
  server: LspServer,
  uri: Str,
  text: Str,
): (JsonRpcResponse | JsonRpcNotification)[] {
  return server.handle({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        uri,
        languageId: "typec",
        version: 1,
        text,
      },
    },
  });
}

function responseResult(message: JsonRpcResponse | JsonRpcNotification): JsonValue {
  if (isNotification(message) || message.result === undefined) throw new Error("Expected response");
  return message.result;
}

function notificationParams(message: JsonRpcResponse | JsonRpcNotification): JsonRecord {
  if (!isNotification(message) || message.params === undefined) throw new Error("Expected params");
  return asRecord(message.params);
}

function isNotification(
  message: JsonRpcResponse | JsonRpcNotification,
): message is JsonRpcNotification {
  return !("id" in message);
}

function recordField(record: JsonRecord, field: Str): JsonRecord {
  return asRecord(record[field]);
}

function stringField(record: JsonRecord, field: Str): Str {
  const value = record[field];
  if (typeof value !== "string") throw new Error(`Expected string field ${field}`);
  return value;
}

function arrayField(record: JsonRecord, field: Str): JsonValue[] {
  return asArray(record[field]);
}

function asRecord(value: JsonValue): JsonRecord {
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Expected record");
  }
  return value;
}

function asArray(value: JsonValue): JsonValue[] {
  if (!Array.isArray(value)) throw new Error("Expected array");
  return value;
}

function assertSame(actual: JsonValue | undefined, expected: JsonValue): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
