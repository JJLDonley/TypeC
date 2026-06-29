import type { TypeAliasDecl } from "core/ast.ts";
import { TYPE_ALIAS_CYCLE } from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { collectTypeAliasRefs } from "checker/type_refs.ts";

type Str = string;

type VisitState = "visiting" | "done";

export function checkTypeAliasCycles(typeAliases: TypeAliasDecl[]): Diagnostic[] {
  const aliases = typeAliasMap(typeAliases);
  const states = new Map<Str, VisitState>();
  const diagnostics: Diagnostic[] = [];
  for (const typeAlias of typeAliases) {
    visitAlias(typeAlias, aliases, states, diagnostics);
  }
  return diagnostics;
}

function typeAliasMap(typeAliases: TypeAliasDecl[]): Map<Str, TypeAliasDecl> {
  return new Map(typeAliases.map((typeAlias): [Str, TypeAliasDecl] => [typeAlias.name, typeAlias]));
}

function visitAlias(
  typeAlias: TypeAliasDecl,
  aliases: Map<Str, TypeAliasDecl>,
  states: Map<Str, VisitState>,
  diagnostics: Diagnostic[],
): void {
  const state = states.get(typeAlias.name) ?? null;
  if (state === "done") return;
  if (state === "visiting") {
    diagnostics.push(cycleDiagnostic(typeAlias));
    return;
  }
  states.set(typeAlias.name, "visiting");
  for (const ref of collectTypeAliasRefs(typeAlias.type)) {
    const dependency = aliases.get(ref) ?? null;
    if (dependency !== null) visitAlias(dependency, aliases, states, diagnostics);
  }
  states.set(typeAlias.name, "done");
}

function cycleDiagnostic(typeAlias: TypeAliasDecl): Diagnostic {
  return {
    message: `Type alias cycle involving '${typeAlias.name}'`,
    code: TYPE_ALIAS_CYCLE,
    span: typeAlias.span,
  };
}
