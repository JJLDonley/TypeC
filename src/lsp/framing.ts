import { encodeMessage } from "lsp/json_rpc.ts";
import type {
  b8,
  i32,
  IncomingMessage,
  JsonRpcNotification,
  JsonRpcResponse,
  usize,
} from "lsp/types.ts";

type Bytes = Uint8Array<ArrayBufferLike>;

const SEPARATOR: Bytes = new TextEncoder().encode("\r\n\r\n");

export class MessageBuffer {
  private bytes: Bytes = new Uint8Array();

  append(chunk: Bytes): IncomingMessage[] {
    this.bytes = concatBytes(this.bytes, chunk);
    const messages: IncomingMessage[] = [];
    while (true) {
      const message = this.shiftMessage();
      if (message === null) return messages;
      messages.push(message);
    }
  }

  private shiftMessage(): IncomingMessage | null {
    const headerEnd = indexOfBytes(this.bytes, SEPARATOR);
    if (headerEnd < 0) return null;
    const length = contentLength(this.bytes.slice(0, headerEnd));
    const bodyStart = headerEnd + SEPARATOR.length;
    const bodyEnd = bodyStart + length;
    if (this.bytes.length < bodyEnd) return null;
    const body = this.bytes.slice(bodyStart, bodyEnd);
    this.bytes = this.bytes.slice(bodyEnd);
    return JSON.parse(new TextDecoder().decode(body)) as IncomingMessage;
  }
}

export async function writeMessage(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  message: JsonRpcResponse | JsonRpcNotification,
): Promise<void> {
  await writer.write(encodeMessage(message));
}

function contentLength(header: Bytes): usize {
  const text = new TextDecoder().decode(header);
  for (const line of text.split("\r\n")) {
    const [name, value] = line.split(":");
    if (name?.toLowerCase() === "content-length") return Number(value?.trim() ?? "0");
  }
  return 0;
}

function concatBytes(left: Bytes, right: Bytes): Bytes {
  const result = new Uint8Array(left.length + right.length);
  result.set(left, 0);
  result.set(right, left.length);
  return result;
}

function indexOfBytes(source: Bytes, needle: Bytes): i32 {
  for (let index: usize = 0; index <= source.length - needle.length; index += 1) {
    if (matchesAt(source, needle, index)) return index;
  }
  return -1;
}

function matchesAt(source: Bytes, needle: Bytes, start: usize): b8 {
  for (let index: usize = 0; index < needle.length; index += 1) {
    if (source[start + index] !== needle[index]) return false;
  }
  return true;
}
