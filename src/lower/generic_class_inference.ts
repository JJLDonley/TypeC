import type {
  CastClassDecl,
  CastExpression,
  CastNewExpr,
  CastRecordField,
  CastTypeRef,
} from "core/cast.ts";
import { typeName } from "core/type_ref.ts";
import { lowerTypeRef } from "lower/types.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

type TypeBindings = Map<Str, CastTypeRef>;
export type CastArgumentTypeResolver = (expression: CastExpression) => CastTypeRef | null;

export function inferGenericClassNewTypeArgsFromArgs(
  template: CastClassDecl,
  expression: CastNewExpr,
  resolveType: CastArgumentTypeResolver = inferGenericClassArgumentTypeRef,
): CastTypeRef[] | null {
  if ((expression.typeArgs ?? []).length > 0) return null;
  const constructorDecl = template.constructorDecl;
  if (constructorDecl === null) return null;
  const bindings = new Map<Str, CastTypeRef>();
  const params = genericParamNames(template);
  for (
    let index: usize = 0;
    index < expression.args.length && index < constructorDecl.params.length;
    index += 1
  ) {
    const actual = resolveType(expression.args[index]!);
    if (actual === null) continue;
    if (!bindGenericType(constructorDecl.params[index]!.type, actual, params, bindings)) {
      return null;
    }
  }
  return orderedTypeArgs(template, bindings);
}

export function inferGenericClassNewTypeArgsFromExpected(
  expression: CastNewExpr,
  expected: CastTypeRef,
): CastTypeRef[] | null {
  if ((expression.typeArgs ?? []).length > 0) return null;
  if (expected.kind !== "NamedTypeRef") return null;
  if (expected.name !== expression.className) return null;
  const typeArgs = expected.typeArgs ?? [];
  return typeArgs.length === 0 ? null : typeArgs;
}

export function inferGenericClassArgumentTypeRef(expression: CastExpression): CastTypeRef | null {
  switch (expression.kind) {
    case "IntegerLiteral":
      return namedTypeRef("i32", expression);
    case "FloatLiteral":
      return namedTypeRef("f64", expression);
    case "BoolLiteral":
      return namedTypeRef("bool", expression);
    case "StringLiteral":
      return stringLiteralTypeRef(expression);
    case "UnaryExpr":
      return inferUnaryTypeRef(expression);
    case "BinaryExpr":
      return inferBinaryTypeRef(expression);
    case "ConditionalExpr":
      return inferConditionalTypeRef(expression);
    case "NullishCoalesceExpr":
      return inferNullishCoalesceTypeRef(expression);
    case "SatisfiesExpr":
      return inferGenericClassArgumentTypeRef(expression.expression);
    case "ArrayLiteralExpr":
      return inferArrayLiteralTypeRef(expression);
    case "RecordLiteralExpr":
      return inferRecordLiteralTypeRef(expression);
    default:
      return null;
  }
}

function inferNullishCoalesceTypeRef(
  expression: Extract<CastExpression, { kind: "NullishCoalesceExpr" }>,
): CastTypeRef | null {
  const left = inferNullishLeftTypeRef(expression.left);
  const element = left === null ? null : optionalCastTypeElement(left);
  if (element === null) return null;
  const fallback = inferGenericClassArgumentTypeRef(expression.fallback);
  if (fallback === null || castTypeName(fallback) !== castTypeName(element)) return null;
  return element;
}

function inferNullishLeftTypeRef(expression: CastExpression): CastTypeRef | null {
  if (expression.kind === "CallExpr") return inferOptionalConstructorTypeRef(expression);
  return inferGenericClassArgumentTypeRef(expression);
}

function inferOptionalConstructorTypeRef(
  expression: Extract<CastExpression, { kind: "CallExpr" }>,
): CastTypeRef | null {
  if (expression.callee !== "Some") return null;
  const explicit = explicitConstructorTypeArg(expression);
  if (explicit !== null) {
    return { kind: "NamedTypeRef", name: "Optional", typeArgs: [explicit], span: expression.span };
  }
  if (expression.args.length !== 1) return null;
  const element = inferGenericClassArgumentTypeRef(expression.args[0]!);
  if (element === null) return null;
  return { kind: "NamedTypeRef", name: "Optional", typeArgs: [element], span: expression.span };
}

function explicitConstructorTypeArg(
  expression: Extract<CastExpression, { kind: "CallExpr" }>,
): CastTypeRef | null {
  const typeArgs = expression.typeArgs ?? [];
  return typeArgs.length === 1 ? typeArgs[0]! : null;
}

function optionalCastTypeElement(type: CastTypeRef): CastTypeRef | null {
  if (type.kind !== "NamedTypeRef" || type.name !== "Optional") return null;
  const typeArgs = type.typeArgs ?? [];
  return typeArgs.length === 1 ? typeArgs[0]! : null;
}

function inferConditionalTypeRef(
  expression: Extract<CastExpression, { kind: "ConditionalExpr" }>,
): CastTypeRef | null {
  const condition = inferGenericClassArgumentTypeRef(expression.condition);
  if (condition === null || !isNamedType(condition, "bool")) return null;
  const whenTrue = inferGenericClassArgumentTypeRef(expression.whenTrue);
  const whenFalse = inferGenericClassArgumentTypeRef(expression.whenFalse);
  if (whenTrue === null || whenFalse === null) return null;
  return castTypeName(whenTrue) === castTypeName(whenFalse) ? whenTrue : null;
}

function inferBinaryTypeRef(
  expression: Extract<CastExpression, { kind: "BinaryExpr" }>,
): CastTypeRef | null {
  const left = inferGenericClassArgumentTypeRef(expression.left);
  const right = inferGenericClassArgumentTypeRef(expression.right);
  if (left === null || right === null) return null;
  if (isLogicalBinaryOperator(expression.operator)) {
    return inferLogicalBinaryTypeRef(expression, left, right);
  }
  if (isComparisonBinaryOperator(expression.operator)) {
    return inferComparisonBinaryTypeRef(expression, left, right);
  }
  if (isNumericBinaryOperator(expression.operator)) {
    return inferNumericBinaryTypeRef(expression, left, right);
  }
  return null;
}

function inferLogicalBinaryTypeRef(
  expression: Extract<CastExpression, { kind: "BinaryExpr" }>,
  left: CastTypeRef,
  right: CastTypeRef,
): CastTypeRef | null {
  if (isNamedType(left, "bool") && isNamedType(right, "bool")) {
    return namedTypeRef("bool", expression);
  }
  return null;
}

function inferComparisonBinaryTypeRef(
  expression: Extract<CastExpression, { kind: "BinaryExpr" }>,
  left: CastTypeRef,
  right: CastTypeRef,
): CastTypeRef | null {
  if (castTypeName(left) !== castTypeName(right)) return null;
  return namedTypeRef("bool", expression);
}

function inferNumericBinaryTypeRef(
  _expression: Extract<CastExpression, { kind: "BinaryExpr" }>,
  left: CastTypeRef,
  right: CastTypeRef,
): CastTypeRef | null {
  if (castTypeName(left) !== castTypeName(right)) return null;
  if (isNamedType(left, "i32") || isNamedType(left, "f64")) return left;
  return null;
}

function isNamedType(type: CastTypeRef, name: Str): b8 {
  return type.kind === "NamedTypeRef" && type.name === name;
}

function isLogicalBinaryOperator(operator: Str): b8 {
  return operator === "&&" || operator === "||";
}

function isComparisonBinaryOperator(operator: Str): b8 {
  return operator === "==" || operator === "!=" || operator === "<" || operator === "<=" ||
    operator === ">" || operator === ">=";
}

function isNumericBinaryOperator(operator: Str): b8 {
  return operator === "+" || operator === "-" || operator === "*" || operator === "/" ||
    operator === "%";
}

function inferArrayLiteralTypeRef(
  expression: Extract<CastExpression, { kind: "ArrayLiteralExpr" }>,
): CastTypeRef | null {
  if (expression.elements.length === 0) return null;
  const first = inferGenericClassArgumentTypeRef(expression.elements[0]!);
  if (first === null) return null;
  for (const element of expression.elements.slice(1)) {
    const actual = inferGenericClassArgumentTypeRef(element);
    if (actual === null || castTypeName(actual) !== castTypeName(first)) return null;
  }
  return {
    kind: "FixedArrayTypeRef",
    element: first,
    sizeText: `${expression.elements.length}`,
    span: expression.span,
  };
}

function inferRecordLiteralTypeRef(
  expression: Extract<CastExpression, { kind: "RecordLiteralExpr" }>,
): CastTypeRef | null {
  const fields: CastRecordField[] = [];
  for (const field of expression.fields) {
    if (field.kind === "Spread") return null;
    const type = inferGenericClassArgumentTypeRef(field.expression);
    if (type === null) return null;
    fields.push({ name: field.name, type, span: field.span });
  }
  return { kind: "RecordTypeRef", fields, span: expression.span };
}

function bindGenericType(
  pattern: CastTypeRef,
  actual: CastTypeRef,
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  if (pattern.kind === "NamedTypeRef" && params.has(pattern.name)) {
    return bindGenericName(pattern.name, actual, bindings);
  }
  return bindMatchingType(pattern, actual, params, bindings);
}

function bindGenericName(name: Str, actual: CastTypeRef, bindings: TypeBindings): b8 {
  const previous = bindings.get(name) ?? null;
  if (previous === null) {
    bindings.set(name, actual);
    return true;
  }
  return castTypeName(previous) === castTypeName(actual);
}

function bindMatchingType(
  pattern: CastTypeRef,
  actual: CastTypeRef,
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  switch (pattern.kind) {
    case "NamedTypeRef":
      return actual.kind === "NamedTypeRef" && pattern.name === actual.name &&
        bindNamedTypeArgs(pattern, actual, params, bindings);
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
      return actual.kind === pattern.kind &&
        bindGenericType(pattern.element, actual.element, params, bindings);
    case "InferredArrayTypeRef":
      return isArrayType(actual) &&
        bindGenericType(pattern.element, actual.element, params, bindings);
    case "FixedArrayTypeRef":
      return actual.kind === "FixedArrayTypeRef" && pattern.sizeText === actual.sizeText &&
        bindGenericType(pattern.element, actual.element, params, bindings);
    case "FunctionTypeRef":
      return actual.kind === "FunctionTypeRef" &&
        bindFunctionType(pattern, actual, params, bindings);
    case "TupleTypeRef":
      return actual.kind === "TupleTypeRef" &&
        bindTypeList(pattern.elements, actual.elements, params, bindings);
    case "RecordTypeRef":
      return actual.kind === "RecordTypeRef" && bindRecordType(pattern, actual, params, bindings);
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      return actual.kind === pattern.kind &&
        bindTypeList(pattern.members, actual.members, params, bindings);
    case "ConditionalTypeRef":
    case "IndexedAccessTypeRef":
    case "MappedTypeRef":
    case "LiteralTypeRef":
    case "KeyofTypeRef":
    case "TypeofTypeRef":
      return castTypeName(pattern) === castTypeName(actual);
  }
}

function bindNamedTypeArgs(
  pattern: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
  actual: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  const patternArgs = pattern.typeArgs ?? [];
  const actualArgs = actual.typeArgs ?? [];
  return bindTypeList(patternArgs, actualArgs, params, bindings);
}

function bindFunctionType(
  pattern: Extract<CastTypeRef, { kind: "FunctionTypeRef" }>,
  actual: Extract<CastTypeRef, { kind: "FunctionTypeRef" }>,
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  if (pattern.params.length !== actual.params.length) return false;
  for (let index: usize = 0; index < pattern.params.length; index += 1) {
    if (
      !bindGenericType(pattern.params[index]!.type, actual.params[index]!.type, params, bindings)
    ) {
      return false;
    }
  }
  return bindGenericType(pattern.returnType, actual.returnType, params, bindings);
}

function bindRecordType(
  pattern: Extract<CastTypeRef, { kind: "RecordTypeRef" }>,
  actual: Extract<CastTypeRef, { kind: "RecordTypeRef" }>,
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  if (pattern.fields.length !== actual.fields.length) return false;
  for (let index: usize = 0; index < pattern.fields.length; index += 1) {
    const left = pattern.fields[index]!;
    const right = actual.fields[index]!;
    if (left.name !== right.name) return false;
    if (!bindGenericType(left.type, right.type, params, bindings)) return false;
  }
  return true;
}

function bindTypeList(
  pattern: CastTypeRef[],
  actual: CastTypeRef[],
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  if (pattern.length !== actual.length) return false;
  for (let index: usize = 0; index < pattern.length; index += 1) {
    if (!bindGenericType(pattern[index]!, actual[index]!, params, bindings)) return false;
  }
  return true;
}

function orderedTypeArgs(template: CastClassDecl, bindings: TypeBindings): CastTypeRef[] | null {
  const typeArgs: CastTypeRef[] = [];
  for (const param of template.genericParams ?? []) {
    const typeArg = bindings.get(param.name) ?? null;
    if (typeArg === null) return null;
    typeArgs.push(typeArg);
  }
  return typeArgs;
}

function genericParamNames(template: CastClassDecl): Set<Str> {
  return new Set((template.genericParams ?? []).map((param) => param.name));
}

function isArrayType(
  type: CastTypeRef,
): type is Extract<CastTypeRef, { kind: "InferredArrayTypeRef" | "FixedArrayTypeRef" }> {
  return type.kind === "InferredArrayTypeRef" || type.kind === "FixedArrayTypeRef";
}

function inferUnaryTypeRef(
  expression: Extract<CastExpression, { kind: "UnaryExpr" }>,
): CastTypeRef | null {
  if (expression.operator === "!" && expression.operand.kind === "BoolLiteral") {
    return namedTypeRef("bool", expression);
  }
  if (isNumericUnaryOperator(expression.operator)) return inferNumericUnaryTypeRef(expression);
  return null;
}

function inferNumericUnaryTypeRef(
  expression: Extract<CastExpression, { kind: "UnaryExpr" }>,
): CastTypeRef | null {
  if (expression.operand.kind === "IntegerLiteral") return namedTypeRef("i32", expression);
  if (expression.operand.kind === "FloatLiteral" && expression.operator !== "~") {
    return namedTypeRef("f64", expression);
  }
  return null;
}

function isNumericUnaryOperator(operator: Str): b8 {
  return operator === "+" || operator === "-" || operator === "~";
}

function stringLiteralTypeRef(expression: CastExpression): CastTypeRef {
  return { kind: "PointerTypeRef", element: namedTypeRef("u8", expression), span: expression.span };
}

function namedTypeRef(name: Str, expression: CastExpression): CastTypeRef {
  return { kind: "NamedTypeRef", name, span: expression.span };
}

function castTypeName(type: CastTypeRef): Str {
  return typeName(lowerTypeRef(type));
}
