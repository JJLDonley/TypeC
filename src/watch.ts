import { buildNative } from "./c_compiler.ts";
import { compileFile } from "./compiler.ts";

type Str = string;
type b8 = boolean;

export async function watchFile(inputPath: Str): Promise<void> {
  console.log(`Watching ${inputPath}`);
  const state = createWatchState();
  await rebuild(inputPath, state);
  const watcher = Deno.watchFs(inputPath);
  for await (const event of watcher) {
    if (shouldRebuild(event.kind)) await rebuild(inputPath, state);
  }
}

interface WatchState {
  building: b8;
}

function createWatchState(): WatchState {
  return { building: false };
}

async function rebuild(inputPath: Str, state: WatchState): Promise<void> {
  if (state.building) return;
  state.building = true;
  try {
    const result = await compileFile(inputPath);
    await buildNative(result);
    console.log(`Built ${result.exePath}`);
  } finally {
    state.building = false;
  }
}

export function shouldRebuild(kind: Deno.FsEvent["kind"]): b8 {
  return kind === "modify" || kind === "create";
}
