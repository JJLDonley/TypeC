import type { Diagnostic } from "core/diagnostics.ts";
import type { Expression, Statement, TypeRef } from "core/ast.ts";
import type { TypeName } from "core/tast.ts";
import { checkArrayInitializer } from "checker/array_initializers.ts";
import { localDeclaredType } from "checker/local_types.ts";
import { isAssignable } from "checker/types.ts";
import { checkTypeRef } from "checker/type_validation.ts";
import { checkValueType } from "checker/value_types.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

type TypeResolver = (expr: Expression, expected: TypeName) => TypeName;
type VarDeclStmt = Extract<Statement, { kind: "VarDeclStmt" }>;

export interface LocalDeclarationCheck {
  diagnostics: Diagnostic[];
  type: TypeName;
}

export function checkLocalDeclaration(
  stmt: VarDeclStmt,
  typeAliases: Map<Str, TypeRef>,
  resolveType: TypeResolver,
): LocalDeclarationCheck {
  const expected = typeName(stmt.type);
  const diagnostics: Diagnostic[] = [
    ...checkTypeRef(stmt.type, typeAliases),
    ...checkValueType(stmt.type, `Variable '${stmt.name}' cannot have type 'void'`, stmt.span),
    ...checkArrayInitializer(stmt.initializer, expected, stmt.span),
  ];
  const actual = resolveType(stmt.initializer, expected);
  if (!isAssignable(actual, expected)) {
    diagnostics.push({
      message: `Initializer type '${actual}' is not assignable to '${expected}'`,
      span: stmt.span,
    });
  }
  return { diagnostics, type: localDeclaredType(expected, actual) };
}
