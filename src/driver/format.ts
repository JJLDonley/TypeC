import { formatTypeCSource } from "formatter";
import { parseSourceFile } from "driver/syntax.ts";
import { readSourceText } from "driver/source_files.ts";

type Str = string;
type b8 = boolean;

export async function formatSourceFile(inputPath: Str): Promise<b8> {
  await parseSourceFile(inputPath);
  const source = await readSourceText(inputPath);
  const formatted = formatTypeCSource(source);
  if (source === formatted) return false;
  await Deno.writeTextFile(inputPath, formatted);
  return true;
}

export async function sourceFileIsFormatted(inputPath: Str): Promise<b8> {
  await parseSourceFile(inputPath);
  const source = await readSourceText(inputPath);
  return source === formatTypeCSource(source);
}
