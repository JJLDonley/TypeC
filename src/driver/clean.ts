import { buildOutputPaths } from "paths";

type Str = string;
type b8 = boolean;

export interface CleanResult {
  removedPaths: Str[];
}

export async function cleanSourceArtifacts(inputPath: Str, buildDir: Str): Promise<CleanResult> {
  const paths = buildOutputPaths(inputPath, buildDir);
  return { removedPaths: await removedArtifactPaths([paths.cPath, paths.exePath]) };
}

async function removedArtifactPaths(paths: Str[]): Promise<Str[]> {
  const removedPaths: Str[] = [];
  for (const path of paths) {
    if (await removeIfPresent(path)) removedPaths.push(path);
  }
  return removedPaths;
}

async function removeIfPresent(path: Str): Promise<b8> {
  try {
    await Deno.remove(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}
