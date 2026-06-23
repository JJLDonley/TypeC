import { MessageBuffer, writeMessage } from "lsp/framing.ts";
import { errorResponse } from "lsp/json_rpc.ts";
import { LspServer } from "lsp/server.ts";

const PARSE_ERROR = -32700;

export async function runLspServer(): Promise<void> {
  const server = new LspServer();
  const buffer = new MessageBuffer();
  const reader = Deno.stdin.readable.getReader();
  const writer = Deno.stdout.writable.getWriter();

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    try {
      for (const message of buffer.append(chunk.value)) {
        for (const output of server.handle(message)) await writeMessage(writer, output);
        if (server.shouldExit()) return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON-RPC message";
      await writeMessage(writer, errorResponse(null, PARSE_ERROR, message));
    }
  }
}
