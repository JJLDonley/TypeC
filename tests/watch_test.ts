import { shouldRebuild } from "../src/watch.ts";

Deno.test("detects rebuild file events", () => {
  if (!shouldRebuild("modify")) throw new Error("Expected modify to rebuild");
  if (!shouldRebuild("create")) throw new Error("Expected create to rebuild");
  if (shouldRebuild("access")) throw new Error("Expected access to be ignored");
});
