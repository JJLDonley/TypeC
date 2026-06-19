import { printAst } from "./ast_printer.ts";
import { buildNative, compileFile } from "./compiler.ts";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";

type Str = string;

async function main(args: Str[]): Promise<void> {
  const [command, input] = args;
  if (!command || !["build", "run", "emit-c", "emit-ast", "watch"].includes(command)) usage();
  if (!input) usage();

  if (command === "watch") {
    await watch(input);
    return;
  }

  if (command === "emit-ast") {
    console.log(printAst(parse(lex(await Deno.readTextFile(input)))));
    return;
  }

  const result = await compileFile(input);
  if (command === "emit-c") {
    console.log(result.cSource);
    return;
  }

  await buildNative(result);
  console.log(`Built ${result.exePath}`);

  if (command === "run") {
    const child = new Deno.Command(result.exePath, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    const output = await child.output();
    Deno.exit(output.code);
  }
}

async function watch(input: string): Promise<void> {
  console.log(`Watching ${input}`);
  let building = false;
  const rebuild = async () => {
    if (building) return;
    building = true;
    try {
      const result = await compileFile(input);
      await buildNative(result);
      console.log(`Built ${result.exePath}`);
    } finally {
      building = false;
    }
  };

  await rebuild();
  const watcher = Deno.watchFs(input);
  for await (const event of watcher) {
    if (["modify", "create"].includes(event.kind)) await rebuild();
  }
}

function usage(): never {
  console.error("Usage: deno run -A src/main.ts <build|run|emit-c|emit-ast|watch> <file.tc>");
  Deno.exit(1);
}

if (import.meta.main) await main(Deno.args);
