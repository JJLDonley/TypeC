import type { CheckedProgram } from "checker";
import { emitTranslationUnit } from "emitter/translation_units.ts";

type Str = string;

export function emitC(program: CheckedProgram): Str {
  return emitTranslationUnit(program);
}
