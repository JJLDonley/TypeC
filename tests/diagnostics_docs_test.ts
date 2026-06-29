import * as diagnosticCodes from "core/diagnostic_codes.ts";

type Str = string;
type i32 = number;

Deno.test("documents every diagnostic code", async () => {
  const sourceCodes = exportedDiagnosticCodes();
  const documentedCodes = await documentedDiagnosticCodes();
  assertSetEqual(documentedCodes, sourceCodes);
});

Deno.test("diagnostic code values are unique", () => {
  const codes = exportedDiagnosticCodes();
  if (codes.size !== exportedDiagnosticCodeList().length) {
    throw new Error("Diagnostic code values must be unique");
  }
});

function exportedDiagnosticCodes(): Set<Str> {
  return new Set(exportedDiagnosticCodeList());
}

function exportedDiagnosticCodeList(): Array<Str> {
  return Object.values(diagnosticCodes).filter(isDiagnosticCode);
}

async function documentedDiagnosticCodes(): Promise<Set<Str>> {
  const text = await Deno.readTextFile("docs/diagnostics.md");
  return new Set([...text.matchAll(/`(E\d{4})`/g)].map((match) => match[1]!));
}

function isDiagnosticCode(value: unknown): value is Str {
  return typeof value === "string" && /^E\d{4}$/.test(value);
}

function assertSetEqual(actual: Set<Str>, expected: Set<Str>): void {
  const missing = sortedDifference(expected, actual);
  const extra = sortedDifference(actual, expected);
  if (missing.length === 0 && extra.length === 0) return;
  throw new Error(
    `Diagnostic docs mismatch. Missing: ${missing.join(", ")}; extra: ${extra.join(", ")}`,
  );
}

function sortedDifference(left: Set<Str>, right: Set<Str>): Array<Str> {
  return [...left].filter((value) => !right.has(value)).sort(compareText);
}

function compareText(left: Str, right: Str): i32 {
  return left.localeCompare(right);
}
