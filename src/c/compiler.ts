type Str = string;

export interface NativeBuildInput {
  cPath: Str;
  exePath: Str;
  compilerFlags?: Str[];
}

export function nativeCompileArgs(input: NativeBuildInput): Str[] {
  return ["-std=c99", ...(input.compilerFlags ?? []), input.cPath, "-o", input.exePath];
}

export async function buildNative(input: NativeBuildInput): Promise<void> {
  const command = new Deno.Command("cc", { args: nativeCompileArgs(input) });
  const output = await command.output();
  if (!output.success) failNativeBuild(output);
}

function failNativeBuild(output: Deno.CommandOutput): never {
  console.error(new TextDecoder().decode(output.stderr));
  Deno.exit(output.code);
}
