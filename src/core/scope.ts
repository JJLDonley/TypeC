import type { ScopeInfo, ScopeKind, SymbolInfo, SymbolKind } from "core/rast.ts";

type Str = string;
type u32 = number;

export interface Scope {
  info: ScopeInfo;
  parent: Scope | null;
  symbols: Map<Str, SymbolInfo>;
}

export class ScopeTable {
  private symbols: SymbolInfo[] = [];
  private scopes: ScopeInfo[] = [];

  createScope(kind: ScopeKind, parent: Scope | null): Scope {
    const id: u32 = this.scopes.length;
    const info = { id, kind, parentId: parent?.info.id ?? null };
    this.scopes.push(info);
    return { info, parent, symbols: new Map() };
  }

  declare(scope: Scope, name: Str, kind: SymbolKind): SymbolInfo | null {
    if (scope.symbols.has(name)) return null;

    const id: u32 = this.symbols.length;
    const symbol = { id, scopeId: scope.info.id, kind, name };
    scope.symbols.set(name, symbol);
    this.symbols.push(symbol);
    return symbol;
  }

  lookup(scope: Scope | null, name: Str): SymbolInfo | null {
    let current = scope;
    while (current) {
      const symbol = current.symbols.get(name);
      if (symbol) return symbol;
      current = current.parent;
    }
    return null;
  }

  getSymbols(): SymbolInfo[] {
    return this.symbols;
  }

  getScopes(): ScopeInfo[] {
    return this.scopes;
  }
}
