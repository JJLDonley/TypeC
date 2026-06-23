import { decodeMessages, encodeMessage, notification } from "lsp/json_rpc.ts";
import { MessageBuffer } from "lsp/framing.ts";

Deno.test("encodes and decodes JSON-RPC messages", () => {
  const bytes = encodeMessage(notification("initialized", {}));
  const messages = decodeMessages(bytes);
  if (messages.length !== 1) throw new Error("Expected one message");
});

Deno.test("buffers partial JSON-RPC messages", () => {
  const bytes = encodeMessage(notification("initialized", {}));
  const midpoint = Math.floor(bytes.length / 2);
  const buffer = new MessageBuffer();
  if (buffer.append(bytes.slice(0, midpoint)).length !== 0) {
    throw new Error("Expected partial message to stay buffered");
  }
  const messages = buffer.append(bytes.slice(midpoint));
  if (messages.length !== 1) throw new Error("Expected buffered message");
});
