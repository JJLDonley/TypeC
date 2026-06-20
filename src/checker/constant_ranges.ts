import { evaluateFloatConstant, evaluateIntegerConstant } from "checker/constant_values.ts";
import { lookupRecordAlias } from "checker/record_aliases.ts";
import { parseArrayTypeName } from "checker/type_name_shapes.ts";
import { integerRange, maxF32 } from "checker/types.ts";
import type { ConstDecl, Expression, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import type { TypeName } from "core/tast.ts";
import { typeName } from "core/type_ref.ts";

type Str = string;

export function checkConstantRanges(
  expr: Expression,
  expectedType: TypeName,
  availableConstants: Map<Str, ConstDecl>,
  aliases: Map<Str, TypeRef>,
): Diagnostic[] {
  return [
    ...checkConstantIntegerRange(expr, expectedType, availableConstants),
    ...checkConstantFloatRange(expr, expectedType, availableConstants),
    ...checkConstantAggregateRanges(expr, expectedType, availableConstants, aliases),
  ];
}

function checkConstantIntegerRange(
  expr: Expression,
  expectedType: TypeName,
  availableConstants: Map<Str, ConstDecl>,
): Diagnostic[] {
  const range = integerRange(expectedType);
  if (range === null) return [];
  const value = evaluateIntegerConstant(expr, availableConstants);
  if (value === null || (value >= range.min && value <= range.max)) return [];
  return [{
    message: `Integer constant '${value}' is out of range for '${expectedType}'`,
    span: expr.span,
  }];
}

function checkConstantFloatRange(
  expr: Expression,
  expectedType: TypeName,
  availableConstants: Map<Str, ConstDecl>,
): Diagnostic[] {
  if (expectedType !== "f32") return [];
  const value = evaluateFloatConstant(expr, availableConstants);
  if (value === null || Math.abs(value) <= maxF32) return [];
  return [{
    message: `Float constant '${value}' is out of range for 'f32'`,
    span: expr.span,
  }];
}

function checkConstantAggregateRanges(
  expr: Expression,
  expectedType: TypeName,
  availableConstants: Map<Str, ConstDecl>,
  aliases: Map<Str, TypeRef>,
): Diagnostic[] {
  if (expr.kind === "ArrayLiteralExpr") {
    return checkConstantArrayRanges(expr, expectedType, availableConstants, aliases);
  }
  if (expr.kind === "RecordLiteralExpr") {
    return checkConstantRecordRanges(expr, expectedType, availableConstants, aliases);
  }
  return [];
}

function checkConstantArrayRanges(
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
  expectedType: TypeName,
  availableConstants: Map<Str, ConstDecl>,
  aliases: Map<Str, TypeRef>,
): Diagnostic[] {
  const array = parseArrayTypeName(expectedType);
  if (array === null) return [];
  return expr.elements.flatMap((element) =>
    checkConstantRanges(element, array.element, availableConstants, aliases)
  );
}

function checkConstantRecordRanges(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
  expectedType: TypeName,
  availableConstants: Map<Str, ConstDecl>,
  aliases: Map<Str, TypeRef>,
): Diagnostic[] {
  const record = lookupRecordAlias(expectedType, aliases);
  if (record === null) return [];
  return expr.fields.flatMap((field) => {
    const expected = record.fields.find((candidate) => candidate.name === field.name);
    if (expected === undefined) return [];
    return checkConstantRanges(
      field.expression,
      typeName(expected.type),
      availableConstants,
      aliases,
    );
  });
}
