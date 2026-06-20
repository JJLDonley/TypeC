import type { Program, TypeAliasDecl } from "core/ast.ts";

export function markHeaderModule(program: Program): Program {
  return { ...program, typeAliases: program.typeAliases.map(markHeaderTypeAlias) };
}

function markHeaderTypeAlias(typeAlias: TypeAliasDecl): TypeAliasDecl {
  return { ...typeAlias, cName: typeAlias.cName ?? typeAlias.name };
}
