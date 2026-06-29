import { readFormatTokens } from "formatter/tokens.ts";
import { writeFormattedTokens } from "formatter/writer.ts";

type Str = string;

export function formatTypeCSource(source: Str): Str {
  return writeFormattedTokens(readFormatTokens(source));
}
