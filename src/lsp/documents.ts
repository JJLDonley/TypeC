import type { Str } from "lsp/types.ts";

export class TextDocuments {
  private readonly texts = new Map<Str, Str>();

  open(uri: Str, text: Str): void {
    this.texts.set(uri, text);
  }

  change(uri: Str, text: Str): void {
    this.texts.set(uri, text);
  }

  close(uri: Str): void {
    this.texts.delete(uri);
  }

  get(uri: Str): Str | null {
    return this.texts.get(uri) ?? null;
  }

  entries(): [Str, Str][] {
    return [...this.texts.entries()];
  }
}
