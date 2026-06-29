import {
  readSourceText,
  sourceNotFoundMessage,
  SourceReadError,
  sourceUnreadableMessage,
} from "driver/source_files.ts";

type Str = string;

Deno.test("reports missing source files", async () => {
  const inputPath = await missingPath();
  try {
    await readSourceText(inputPath);
  } catch (err) {
    if (err instanceof SourceReadError) {
      assertEquals(err.messageText, sourceNotFoundMessage(inputPath));
      return;
    }
  }
  throw new Error("Expected source read error");
});

Deno.test("formats source read messages", () => {
  assertEquals(sourceNotFoundMessage("missing.tc"), "Source file not found: missing.tc");
  assertEquals(sourceUnreadableMessage("locked.tc"), "Source file is not readable: locked.tc");
});

async function missingPath(): Promise<Str> {
  const dir = await Deno.makeTempDir();
  return `${dir}/missing.tc`;
}

function assertEquals(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
}
