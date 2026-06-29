import { EXIT_FAILURE } from "driver/exit_codes.ts";

type Str = string;

export interface NativeBuildInput {
  cPath: Str;
  exePath: Str;
  compilerFlags?: Str[];
}

export function nativeCompileArgs(input: NativeBuildInput): Str[] {
  return ["-std=c11", input.cPath, "-o", input.exePath, ...(input.compilerFlags ?? [])];
}

export async function buildNative(input: NativeBuildInput): Promise<void> {
  const output = await nativeCompilerOutput(input);
  if (!output.success) failNativeBuild(output);
}

export function nativeCompilerCommand(): Str {
  return "cc";
}

export function nativeCompilerNotFoundMessage(command: Str): Str {
  return `Native C compiler not found: ${command}`;
}

async function nativeCompilerOutput(input: NativeBuildInput): Promise<Deno.CommandOutput> {
  try {
    const command = new Deno.Command(nativeCompilerCommand(), { args: nativeCompileArgs(input) });
    return await command.output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) failNativeCompilerLaunch(nativeCompilerCommand());
    throw error;
  }
}

function failNativeCompilerLaunch(command: Str): never {
  console.error(nativeCompilerNotFoundMessage(command));
  Deno.exit(EXIT_FAILURE);
}

function failNativeBuild(output: Deno.CommandOutput): never {
  console.error(new TextDecoder().decode(output.stderr));
  Deno.exit(EXIT_FAILURE);
}
