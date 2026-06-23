import { LspServer } from "lsp/server.ts";

Deno.test("LSP server initializes", () => {
  const server = new LspServer();
  const output = server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  if (output.length !== 1) throw new Error("Expected initialize response");
});

Deno.test("LSP server publishes diagnostics for opened documents", () => {
  const server = new LspServer();
  const output = server.handle({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: {
      textDocument: {
        uri: "file:///main.tc",
        languageId: "typec",
        version: 1,
        text: "function main(: i32 { return 0; }",
      },
    },
  });
  if (output.length !== 1) throw new Error("Expected diagnostics notification");
  const message = output[0]!;
  if (!("method" in message) || message.method !== "textDocument/publishDiagnostics") {
    throw new Error("Expected diagnostics notification");
  }
});
