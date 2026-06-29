type Str = string;
type i32 = number;

type RunStdio = "inherit";

export async function runExecutable(path: Str): Promise<never> {
  const output = await executableOutput(path);
  Deno.exit(exitCode(output));
}

export function executableNotFoundMessage(path: Str): Str {
  return `Executable not found: ${path}`;
}

export function executableNotLaunchableMessage(path: Str): Str {
  return `Executable cannot be launched: ${path}`;
}

async function executableOutput(path: Str): Promise<Deno.CommandOutput> {
  try {
    const child = new Deno.Command(path, {
      stdin: inherit(),
      stdout: inherit(),
      stderr: inherit(),
    });
    return await child.output();
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) failExecutableNotFound(path);
    if (error instanceof Deno.errors.PermissionDenied) failExecutableNotLaunchable(path);
    throw error;
  }
}

function failExecutableNotFound(path: Str): never {
  console.error(executableNotFoundMessage(path));
  Deno.exit(1);
}

function failExecutableNotLaunchable(path: Str): never {
  console.error(executableNotLaunchableMessage(path));
  Deno.exit(1);
}

function exitCode(output: Deno.CommandOutput): i32 {
  return output.code;
}

function inherit(): RunStdio {
  return "inherit";
}
