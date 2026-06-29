import { formatDiagnostic, TypeCError } from "core/diagnostics.ts";
import { EXIT_FAILURE } from "driver/exit_codes.ts";

type Str = string;

export function exitWithTypeCDiagnostics(inputPath: Str, source: Str, err: TypeCError): never {
  console.error(formatTypeCDiagnostics(inputPath, source, err));
  Deno.exit(EXIT_FAILURE);
}

export function formatTypeCDiagnostics(inputPath: Str, source: Str, err: TypeCError): Str {
  return err.diagnostics.map((diagnostic) => formatDiagnostic(inputPath, source, diagnostic)).join(
    "\n",
  );
}
