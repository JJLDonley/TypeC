import type { Expression, FunctionDecl, RecordField, TypeRef } from "core/ast.ts";
import { typeName } from "core/type_ref.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

type TypeBindings = Map<Str, TypeRef>;
export type ArgumentTypeResolver = (expr: Expression) => TypeRef | null;

export function inferGenericCallTypeArgsFromResult(
  template: FunctionDecl,
  expected: TypeRef,
): TypeRef[] | null {
  const bindings = new Map<Str, TypeRef>();
  if (!bindGenericType(template.returnType, expected, genericParamNames(template), bindings)) {
    return null;
  }
  return orderedTypeArgs(template, bindings);
}

export function inferGenericCallTypeArgsFromArgs(
  template: FunctionDecl,
  args: Expression[],
): TypeRef[] | null {
  return inferGenericCallTypeArgsFromTypedArgs(template, args, () => null);
}

export function inferGenericCallTypeArgsFromTypedArgs(
  template: FunctionDecl,
  args: Expression[],
  resolveArgType: ArgumentTypeResolver,
): TypeRef[] | null {
  const bindings = new Map<Str, TypeRef>();
  const params = genericParamNames(template);
  for (let index: usize = 0; index < args.length && index < template.params.length; index += 1) {
    const actual = resolveArgType(args[index]!) ?? inferArgumentTypeRef(args[index]!);
    if (actual === null) continue;
    if (!bindGenericType(template.params[index]!.type, actual, params, bindings)) return null;
  }
  return orderedTypeArgs(template, bindings);
}

export function inferGenericArgumentTypeRef(expr: Expression): TypeRef | null {
  return inferArgumentTypeRef(expr);
}

export function inferGenericLocalContextTypeRef(expr: Expression): TypeRef | null {
  if (expr.kind === "RecordLiteralExpr") return inferRecordLiteralTypeRef(expr);
  return inferArgumentTypeRef(expr);
}

function inferArgumentTypeRef(expr: Expression): TypeRef | null {
  switch (expr.kind) {
    case "IntegerLiteral":
      return namedTypeRef("i32", expr);
    case "FloatLiteral":
      return namedTypeRef("f64", expr);
    case "BoolLiteral":
      return namedTypeRef("bool", expr);
    case "StringLiteral":
      return stringLiteralTypeRef(expr);
    case "UnaryExpr":
      return inferUnaryTypeRef(expr);
    case "BinaryExpr":
      return inferBinaryTypeRef(expr);
    case "ConditionalExpr":
      return inferConditionalTypeRef(expr);
    case "NullishCoalesceExpr":
      return inferNullishCoalesceTypeRef(expr);
    case "SatisfiesExpr":
      return inferArgumentTypeRef(expr.expression);
    case "CallExpr":
      return inferConstructorCallTypeRef(expr);
    case "ArrayLiteralExpr":
      return inferArrayLiteralTypeRef(expr);
    default:
      return null;
  }
}

function inferNullishCoalesceTypeRef(
  expr: Extract<Expression, { kind: "NullishCoalesceExpr" }>,
): TypeRef | null {
  const left = inferArgumentTypeRef(expr.left);
  const element = left === null ? null : optionalElementTypeRef(left);
  if (element === null) return null;
  const fallback = inferArgumentTypeRef(expr.fallback);
  if (fallback === null || typeName(fallback) !== typeName(element)) return null;
  return element;
}

function optionalElementTypeRef(type: TypeRef): TypeRef | null {
  if (type.kind !== "NamedTypeRef" || type.name !== "Optional") return null;
  const typeArgs = type.typeArgs ?? [];
  return typeArgs.length === 1 ? typeArgs[0]! : null;
}

function inferConstructorCallTypeRef(
  expr: Extract<Expression, { kind: "CallExpr" }>,
): TypeRef | null {
  if (expr.callee !== "Some") return null;
  const explicit = explicitConstructorTypeArg(expr);
  if (explicit !== null) {
    return { kind: "NamedTypeRef", name: "Optional", typeArgs: [explicit], span: expr.span };
  }
  if (expr.args.length !== 1) return null;
  const element = inferArgumentTypeRef(expr.args[0]!);
  if (element === null) return null;
  return { kind: "NamedTypeRef", name: "Optional", typeArgs: [element], span: expr.span };
}

function explicitConstructorTypeArg(
  expr: Extract<Expression, { kind: "CallExpr" }>,
): TypeRef | null {
  const typeArgs = expr.typeArgs ?? [];
  return typeArgs.length === 1 ? typeArgs[0]! : null;
}

function inferConditionalTypeRef(
  expr: Extract<Expression, { kind: "ConditionalExpr" }>,
): TypeRef | null {
  const condition = inferArgumentTypeRef(expr.condition);
  if (condition === null || !isNamedType(condition, "bool")) return null;
  const whenTrue = inferArgumentTypeRef(expr.whenTrue);
  const whenFalse = inferArgumentTypeRef(expr.whenFalse);
  if (whenTrue === null || whenFalse === null) return null;
  return typeName(whenTrue) === typeName(whenFalse) ? whenTrue : null;
}

function inferBinaryTypeRef(expr: Extract<Expression, { kind: "BinaryExpr" }>): TypeRef | null {
  const left = inferArgumentTypeRef(expr.left);
  const right = inferArgumentTypeRef(expr.right);
  if (left === null || right === null) return null;
  if (isLogicalBinaryOperator(expr.operator)) return inferLogicalBinaryTypeRef(expr, left, right);
  if (isComparisonBinaryOperator(expr.operator)) {
    return inferComparisonBinaryTypeRef(expr, left, right);
  }
  if (isNumericBinaryOperator(expr.operator)) return inferNumericBinaryTypeRef(left, right);
  return null;
}

function inferLogicalBinaryTypeRef(
  expr: Extract<Expression, { kind: "BinaryExpr" }>,
  left: TypeRef,
  right: TypeRef,
): TypeRef | null {
  if (isNamedType(left, "bool") && isNamedType(right, "bool")) return namedTypeRef("bool", expr);
  return null;
}

function inferComparisonBinaryTypeRef(
  expr: Extract<Expression, { kind: "BinaryExpr" }>,
  left: TypeRef,
  right: TypeRef,
): TypeRef | null {
  if (typeName(left) !== typeName(right)) return null;
  return namedTypeRef("bool", expr);
}

function inferNumericBinaryTypeRef(left: TypeRef, right: TypeRef): TypeRef | null {
  if (typeName(left) !== typeName(right)) return null;
  if (isNamedType(left, "i32") || isNamedType(left, "f64")) return left;
  return null;
}

function isNamedType(type: TypeRef, name: Str): b8 {
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
  expr: Extract<Expression, { kind: "ArrayLiteralExpr" }>,
): TypeRef | null {
  if (expr.elements.length === 0) return null;
  const first = inferArgumentTypeRef(expr.elements[0]!);
  if (first === null) return null;
  for (const element of expr.elements.slice(1)) {
    const actual = inferArgumentTypeRef(element);
    if (actual === null || typeName(actual) !== typeName(first)) return null;
  }
  return {
    kind: "FixedArrayTypeRef",
    element: first,
    sizeText: `${expr.elements.length}`,
    span: expr.span,
  };
}

function inferRecordLiteralTypeRef(
  expr: Extract<Expression, { kind: "RecordLiteralExpr" }>,
): TypeRef | null {
  const fields: RecordField[] = [];
  for (const field of expr.fields) {
    if (field.kind === "Spread") return null;
    const type = inferArgumentTypeRef(field.expression);
    if (type === null) return null;
    fields.push({ name: field.name, type, span: field.span });
  }
  return { kind: "RecordTypeRef", fields, span: expr.span };
}

function inferUnaryTypeRef(expr: Extract<Expression, { kind: "UnaryExpr" }>): TypeRef | null {
  if (expr.operator === "!" && expr.operand.kind === "BoolLiteral") {
    return namedTypeRef("bool", expr);
  }
  if (isNumericUnaryOperator(expr.operator)) return inferNumericUnaryTypeRef(expr);
  return null;
}

function inferNumericUnaryTypeRef(
  expr: Extract<Expression, { kind: "UnaryExpr" }>,
): TypeRef | null {
  if (expr.operand.kind === "IntegerLiteral") return namedTypeRef("i32", expr);
  if (expr.operand.kind === "FloatLiteral" && expr.operator !== "~") {
    return namedTypeRef("f64", expr);
  }
  return null;
}

function isNumericUnaryOperator(operator: Str): b8 {
  return operator === "+" || operator === "-" || operator === "~";
}

function stringLiteralTypeRef(expr: Expression): TypeRef {
  return { kind: "PointerTypeRef", element: namedTypeRef("u8", expr), span: expr.span };
}

function namedTypeRef(name: Str, expr: Expression): TypeRef {
  return { kind: "NamedTypeRef", name, span: expr.span };
}

function genericParamNames(template: FunctionDecl): Set<Str> {
  return new Set((template.genericParams ?? []).map((param) => param.name));
}

function orderedTypeArgs(template: FunctionDecl, bindings: TypeBindings): TypeRef[] | null {
  const args: TypeRef[] = [];
  for (const param of template.genericParams ?? []) {
    const arg = bindings.get(param.name) ?? null;
    if (arg === null) return null;
    args.push(arg);
  }
  return args;
}

function bindGenericType(
  pattern: TypeRef,
  actual: TypeRef,
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  if (pattern.kind === "NamedTypeRef" && params.has(pattern.name)) {
    return bindGenericName(pattern.name, actual, bindings);
  }
  return bindMatchingType(pattern, actual, params, bindings);
}

function bindGenericName(name: Str, actual: TypeRef, bindings: TypeBindings): b8 {
  const previous = bindings.get(name) ?? null;
  if (previous === null) {
    bindings.set(name, actual);
    return true;
  }
  return typeName(previous) === typeName(actual);
}

function bindMatchingType(
  pattern: TypeRef,
  actual: TypeRef,
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
      return typeName(pattern) === typeName(actual);
  }
}

function isArrayType(
  type: TypeRef,
): type is Extract<TypeRef, { kind: "InferredArrayTypeRef" | "FixedArrayTypeRef" }> {
  return type.kind === "InferredArrayTypeRef" || type.kind === "FixedArrayTypeRef";
}

function bindNamedTypeArgs(
  pattern: Extract<TypeRef, { kind: "NamedTypeRef" }>,
  actual: Extract<TypeRef, { kind: "NamedTypeRef" }>,
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  const patternArgs = pattern.typeArgs ?? [];
  const actualArgs = actual.typeArgs ?? [];
  return bindTypeList(patternArgs, actualArgs, params, bindings);
}

function bindFunctionType(
  pattern: Extract<TypeRef, { kind: "FunctionTypeRef" }>,
  actual: Extract<TypeRef, { kind: "FunctionTypeRef" }>,
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
  pattern: Extract<TypeRef, { kind: "RecordTypeRef" }>,
  actual: Extract<TypeRef, { kind: "RecordTypeRef" }>,
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
  pattern: TypeRef[],
  actual: TypeRef[],
  params: Set<Str>,
  bindings: TypeBindings,
): b8 {
  if (pattern.length !== actual.length) return false;
  for (let index: usize = 0; index < pattern.length; index += 1) {
    if (!bindGenericType(pattern[index]!, actual[index]!, params, bindings)) return false;
  }
  return true;
}
