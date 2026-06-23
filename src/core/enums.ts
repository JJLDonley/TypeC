import type { ConstDecl, EnumDecl, Expression, TypeRef } from "core/ast.ts";

type Str = string;
type IntValue = bigint;
type usize = number;

export function enumMemberSymbolName(enumName: Str, memberName: Str): Str {
  return `${enumName}.${memberName}`;
}

export function enumMemberCName(enumName: Str, memberName: Str): Str {
  return `${enumName}_${memberName}`;
}

export function enumMemberType(enumName: Str, span: TypeRef["span"]): TypeRef {
  return { kind: "NamedTypeRef", name: enumName, span };
}

export function enumMemberConstant(
  enumDecl: EnumDecl,
  memberIndex: usize,
  value: IntValue,
): ConstDecl {
  const member = enumDecl.members[memberIndex]!;
  return {
    kind: "ConstDecl",
    exported: enumDecl.exported,
    name: enumMemberSymbolName(enumDecl.name, member.name),
    cName: member.cName ?? enumMemberCName(enumDecl.name, member.name),
    type: enumMemberType(enumDecl.name, member.span),
    initializer: integerExpression(value, member.span),
    span: member.span,
  };
}

function integerExpression(value: IntValue, span: Expression["span"]): Expression {
  return { kind: "IntegerLiteral", value, text: value.toString(), span };
}
