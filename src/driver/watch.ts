import { buildNative } from "c/compiler.ts";
import { compileFile } from "driver/compiler.ts";
import { missingMainMessage } from "core/entrypoint.ts";

type Str = string;
type b8 = boolean;

export async function watchFile(inputPath: Str, buildDir?: Str): Promise<void> {
  const outputDir = watchedBuildDir(buildDir);
  console.log(`Watching ${inputPath}`);
  const state = createWatchState();
  await rebuild(inputPath, outputDir, state);
  const watcher = Deno.watchFs(inputPath);
  for await (const event of watcher) {
    if (shouldRebuild(event.kind)) await rebuild(inputPath, outputDir, state);
  }
}

interface WatchState {
  building: b8;
}

function createWatchState(): WatchState {
  return { building: false };
}

async function rebuild(inputPath: Str, buildDir: Str, state: WatchState): Promise<void> {
  if (state.building) return;
  state.building = true;
  try {
    const result = await compileFile(inputPath, buildDir);
    if (!shouldBuildWatchedResult(result.hasMain)) {
      console.error(missingMainMessage());
      return;
    }
    await buildNative(result);
    console.log(`Built ${result.exePath}`);
  } finally {
    state.building = false;
  }
}

export function shouldRebuild(kind: Deno.FsEvent["kind"]): b8 {
  return kind === "modify" || kind === "create";
}

export function shouldBuildWatchedResult(hasMain: b8): b8 {
  return hasMain;
}

export function watchedBuildDir(buildDir: Str | undefined): Str {
  return buildDir ?? "build";
}
