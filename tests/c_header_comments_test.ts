import { stripHeaderTrailingComment } from "c/header/comments.ts";

Deno.test("strips header trailing comments outside strings", () => {
  assertText(stripHeaderTrailingComment(" 7 // pixels"), " 7");
  assertText(stripHeaderTrailingComment(" 8 /* pixels */"), " 8");
  assertText(stripHeaderTrailingComment(' "http://typec" // url'), ' "http://typec"');
});

function assertText(actual: Str, expected: Str): void {
  if (actual !== expected) throw new Error(`Expected '${expected}', got '${actual}'`);
}

type Str = string;
