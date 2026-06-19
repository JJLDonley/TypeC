import type { Program } from "./ast.ts";

type Str = string;
type u32 = number;

export type SymbolKind = "function" | "type" | "parameter" | "local";
export type ScopeKind = "global" | "function" | "block";

export interface SymbolInfo {
  id: u32;
  scopeId: u32;
  kind: SymbolKind;
  name: Str;
}

export interface ScopeInfo {
  id: u32;
  kind: ScopeKind;
  parentId: u32 | null;
}

export interface ResolvedProgram extends Program {
  symbols: SymbolInfo[];
  scopes: ScopeInfo[];
}
