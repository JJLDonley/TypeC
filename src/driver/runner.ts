type Str = string;

type RunStdio = "inherit";

export async function runExecutable(path: Str): Promise<never> {
  const child = new Deno.Command(path, { stdin: inherit(), stdout: inherit(), stderr: inherit() });
  const output = await child.output();
  Deno.exit(output.code);
}

function inherit(): RunStdio {
  return "inherit";
}
