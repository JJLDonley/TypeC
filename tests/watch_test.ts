import { shouldBuildWatchedResult, shouldRebuild } from "driver/watch.ts";

Deno.test("detects rebuild file events", () => {
  if (!shouldRebuild("modify")) throw new Error("Expected modify to rebuild");
  if (!shouldRebuild("create")) throw new Error("Expected create to rebuild");
  if (shouldRebuild("access")) throw new Error("Expected access to be ignored");
});

Deno.test("requires main before watched native builds", () => {
  if (!shouldBuildWatchedResult(true)) throw new Error("Expected executable program to build");
  if (shouldBuildWatchedResult(false)) {
    throw new Error("Expected library program to skip native build");
  }
});
