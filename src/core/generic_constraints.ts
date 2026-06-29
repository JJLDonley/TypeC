import {
  GENERIC_CONSTRAINT_INVALID,
  GENERIC_CONSTRAINT_MISSING_METHOD,
  GENERIC_CONSTRAINT_UNSATISFIED,
  GENERIC_INTERFACE_VALUE_TYPE,
  GENERIC_UNKNOWN_TYPE,
} from "core/diagnostic_codes.ts";
import type { FunctionDecl, GenericParam, InterfaceDecl, RecordField, TypeRef } from "core/ast.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { primitiveTypes } from "core/token.ts";
import { typeName } from "core/type_ref.ts";

export type Str = string;
type b8 = boolean;
type usize = number;

export interface ConstraintContext {
  interfaces: InterfaceDecl[];
  functions: FunctionDecl[];
  typeAliases: Map<Str, TypeRef>;
}

export interface ConstraintSubject {
  kind: "function" | "class";
  name: Str;
}

const RECORD_SHAPE_RECURSION_LIMIT: usize = 64;

type RecordTypeRef = Extract<TypeRef, { kind: "RecordTypeRef" }>;
type RecordShapeContext = {
  depth: usize;
  visited: Set<Str>;
};
type RecordShapeMismatch =
  | { kind: "DepthLimit"; path: Str }
  | { kind: "RecursiveShape"; path: Str }
  | { kind: "MissingField"; path: Str; expected: RecordField }
  | { kind: "RequiredFieldOptional"; path: Str; expected: RecordField; actual: RecordField }
  | { kind: "ReadonlyFieldMutable"; path: Str; expected: RecordField; actual: RecordField }
  | { kind: "FieldTypeMismatch"; path: Str; expected: RecordField; actual: RecordField };

export function checkGenericConstraints(
  params: GenericParam[],
  typeArgs: TypeRef[],
  context: ConstraintContext,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (let index: usize = 0; index < params.length; index += 1) {
    const constraint = params[index].constraint;
    const typeArg = typeArgs[index];
    if (!constraint || !typeArg) continue;
    diagnostics.push(
      ...checkGenericConstraint(params[index], typeArg, constraint, context, span, subject),
    );
  }
  return diagnostics;
}

function checkGenericConstraint(
  param: GenericParam,
  typeArg: TypeRef,
  constraint: TypeRef,
  context: ConstraintContext,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic[] {
  if (constraint.kind === "LiteralTypeRef") {
    return typeName(typeArg) === typeName(constraint)
      ? []
      : [unsatisfiedLiteralConstraint(param, typeArg, constraint, span, subject)];
  }
  if (constraint.kind === "RecordTypeRef") {
    return recordConstraintDiagnostics(param, typeArg, constraint, context, span, subject);
  }
  if (constraint.kind !== "NamedTypeRef") return [invalidConstraint(param, span)];
  const interfaceDecl = context.interfaces.find((candidate) => candidate.name === constraint.name);
  if (interfaceDecl) {
    return interfaceConstraintDiagnostics(param, typeArg, interfaceDecl, context, span, subject);
  }
  if (primitiveTypes.has(constraint.name)) {
    return exactNamedConstraintDiagnostics(param, typeArg, constraint.name, span, subject);
  }
  return [invalidConstraint(param, span)];
}

function interfaceConstraintDiagnostics(
  param: GenericParam,
  typeArg: TypeRef,
  interfaceDecl: InterfaceDecl,
  context: ConstraintContext,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic[] {
  const typeArgDiagnostic = genericTypeArgDiagnostic(typeArg, context, span);
  if (typeArgDiagnostic !== null) return [typeArgDiagnostic];
  if (typeArg.kind !== "NamedTypeRef") {
    return [unsatisfiedConstraint(param, typeArg, interfaceDecl, span, subject)];
  }
  return missingInterfaceMethods(typeArg.name, interfaceDecl, context.functions).map((
    method,
  ) => ({
    message: missingMethodMessage(param, typeArg.name, interfaceDecl.name, method, subject),
    code: GENERIC_CONSTRAINT_MISSING_METHOD,
    span,
  }));
}

function exactNamedConstraintDiagnostics(
  param: GenericParam,
  typeArg: TypeRef,
  constraintName: Str,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic[] {
  return typeName(typeArg) === constraintName
    ? []
    : [unsatisfiedNamedConstraint(param, typeArg, constraintName, span, subject)];
}

function genericTypeArgDiagnostic(
  typeArg: TypeRef,
  context: ConstraintContext,
  span: Diagnostic["span"],
): Diagnostic | null {
  if (typeArg.kind !== "NamedTypeRef") return null;
  if (context.interfaces.some((interfaceDecl) => interfaceDecl.name === typeArg.name)) {
    return {
      message: `Interface value type '${typeArg.name}' is not implemented`,
      code: GENERIC_INTERFACE_VALUE_TYPE,
      span,
    };
  }
  return isKnownTypeArg(typeArg.name, context)
    ? null
    : { message: `Unknown type '${typeArg.name}'`, code: GENERIC_UNKNOWN_TYPE, span };
}

function isKnownTypeArg(typeNameText: Str, context: ConstraintContext): b8 {
  return primitiveTypes.has(typeNameText) || context.typeAliases.has(typeNameText);
}

function invalidConstraint(param: GenericParam, span: Diagnostic["span"]): Diagnostic {
  return {
    message: `Invalid constraint for generic parameter '${param.name}'`,
    code: GENERIC_CONSTRAINT_INVALID,
    span,
  };
}

function recordConstraintDiagnostics(
  param: GenericParam,
  typeArg: TypeRef,
  constraint: Extract<TypeRef, { kind: "RecordTypeRef" }>,
  context: ConstraintContext,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic[] {
  const actual = recordConstraintSubject(typeArg, context);
  if (actual === null) return [unsatisfiedRecordConstraint(param, typeArg, span, subject)];
  return recordConstraintFieldDiagnostics(
    param,
    typeArg,
    constraint,
    actual,
    context,
    span,
    subject,
  );
}

function recordConstraintSubject(
  typeArg: TypeRef,
  context: ConstraintContext,
): RecordTypeRef | null {
  if (typeArg.kind === "RecordTypeRef") return typeArg;
  if (typeArg.kind !== "NamedTypeRef") return null;
  const alias = context.typeAliases.get(typeArg.name) ?? null;
  return alias?.kind === "RecordTypeRef" ? alias : null;
}

function recordConstraintFieldDiagnostics(
  param: GenericParam,
  typeArg: TypeRef,
  constraint: RecordTypeRef,
  actual: RecordTypeRef,
  context: ConstraintContext,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic[] {
  return recordShapeMismatches(constraint, actual, context).map((mismatch) =>
    recordConstraintMismatch(param, typeArg, mismatch, span, subject)
  );
}

function recordShapeMismatches(
  expected: RecordTypeRef,
  actual: RecordTypeRef,
  context: ConstraintContext,
  prefix: Str = "",
  shapeContext: RecordShapeContext = emptyRecordShapeContext(),
): RecordShapeMismatch[] {
  if (shapeContext.depth > RECORD_SHAPE_RECURSION_LIMIT) {
    return [{ kind: "DepthLimit", path: prefix }];
  }
  const key = recordShapeKey(expected, actual);
  if (shapeContext.visited.has(key)) return [{ kind: "RecursiveShape", path: prefix }];
  const nextContext = nestedRecordShapeContext(shapeContext, key);
  return expected.fields.flatMap((field) =>
    recordFieldMismatches(field, actual, context, prefix, nextContext)
  );
}

function recordFieldMismatches(
  expected: RecordField,
  actual: RecordTypeRef,
  context: ConstraintContext,
  prefix: Str,
  shapeContext: RecordShapeContext,
): RecordShapeMismatch[] {
  const path = recordFieldPath(prefix, expected.name);
  const actualField = actual.fields.find((field) => field.name === expected.name) ?? null;
  if (actualField === null) {
    return expected.optional === true ? [] : [{ kind: "MissingField", path, expected }];
  }
  if (expected.optional !== true && actualField.optional === true) {
    return [{ kind: "RequiredFieldOptional", path, expected, actual: actualField }];
  }
  if (expected.readonly !== true && actualField.readonly === true) {
    return [{ kind: "ReadonlyFieldMutable", path, expected, actual: actualField }];
  }
  return recordFieldTypeMismatches(expected, actualField, context, path, shapeContext);
}

function emptyRecordShapeContext(): RecordShapeContext {
  return { depth: 0, visited: new Set<Str>() };
}

function nestedRecordShapeContext(context: RecordShapeContext, key: Str): RecordShapeContext {
  const visited = new Set<Str>(context.visited);
  visited.add(key);
  return { depth: context.depth + 1, visited };
}

function recordShapeKey(expected: RecordTypeRef, actual: RecordTypeRef): Str {
  return `${recordShapeSignature(expected)}=>${recordShapeSignature(actual)}`;
}

function recordShapeSignature(record: RecordTypeRef): Str {
  return record.fields.map((field) => `${field.name}:${typeName(field.type)}`).join(";");
}

function recordFieldPath(prefix: Str, name: Str): Str {
  return prefix.length === 0 ? name : `${prefix}.${name}`;
}

function recordFieldTypeMismatches(
  expected: RecordField,
  actual: RecordField,
  context: ConstraintContext,
  path: Str,
  shapeContext: RecordShapeContext,
): RecordShapeMismatch[] {
  if (expected.type.kind !== "RecordTypeRef") {
    return typeName(actual.type) === typeName(expected.type)
      ? []
      : [{ kind: "FieldTypeMismatch", path, expected, actual }];
  }
  const actualRecord = recordConstraintSubject(actual.type, context);
  if (actualRecord === null) return [{ kind: "FieldTypeMismatch", path, expected, actual }];
  return recordShapeMismatches(expected.type, actualRecord, context, path, shapeContext);
}

function recordConstraintMismatch(
  param: GenericParam,
  typeArg: TypeRef,
  mismatch: RecordShapeMismatch,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  if (mismatch.kind === "DepthLimit") {
    return recordShapeDepthLimit(param, typeArg, mismatch.path, span, subject);
  }
  if (mismatch.kind === "RecursiveShape") {
    return recordShapeCycle(param, typeArg, mismatch.path, span, subject);
  }
  if (mismatch.kind === "MissingField") {
    return missingRecordField(param, typeArg, mismatch.path, span, subject);
  }
  if (mismatch.kind === "RequiredFieldOptional") {
    return optionalRecordField(param, typeArg, mismatch.path, span, subject);
  }
  if (mismatch.kind === "ReadonlyFieldMutable") {
    return readonlyRecordField(param, typeArg, mismatch.path, span, subject);
  }
  return mismatchedRecordField(
    param,
    typeArg,
    mismatch.path,
    mismatch.expected,
    mismatch.actual,
    span,
    subject,
  );
}

function unsatisfiedConstraint(
  param: GenericParam,
  typeArg: TypeRef,
  interfaceDecl: InterfaceDecl,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: constraintMessage(param, typeName(typeArg), interfaceDecl.name, subject),
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function unsatisfiedLiteralConstraint(
  param: GenericParam,
  typeArg: TypeRef,
  constraint: TypeRef,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: literalConstraintMessage(param, typeName(typeArg), typeName(constraint), subject),
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function unsatisfiedNamedConstraint(
  param: GenericParam,
  typeArg: TypeRef,
  constraintName: Str,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: literalConstraintMessage(param, typeName(typeArg), constraintName, subject),
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function unsatisfiedRecordConstraint(
  param: GenericParam,
  typeArg: TypeRef,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: recordConstraintMessage(param, typeName(typeArg), subject),
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function recordShapeDepthLimit(
  param: GenericParam,
  typeArg: TypeRef,
  path: Str,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordConstraintPrefix(param, typeName(typeArg), subject)
    } exceeds record constraint recursion limit at '${displayRecordPath(path)}'`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function recordShapeCycle(
  param: GenericParam,
  typeArg: TypeRef,
  path: Str,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordConstraintPrefix(param, typeName(typeArg), subject)
    } has recursive record constraint comparison at '${displayRecordPath(path)}'`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function displayRecordPath(path: Str): Str {
  return path.length === 0 ? "<root>" : path;
}

function missingRecordField(
  param: GenericParam,
  typeArg: TypeRef,
  fieldName: Str,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordConstraintPrefix(param, typeName(typeArg), subject)
    } is missing required field '${fieldName}' for record constraint`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function optionalRecordField(
  param: GenericParam,
  typeArg: TypeRef,
  fieldName: Str,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordConstraintPrefix(param, typeName(typeArg), subject)
    } has optional field '${fieldName}' but record constraint requires it`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function readonlyRecordField(
  param: GenericParam,
  typeArg: TypeRef,
  fieldName: Str,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordConstraintPrefix(param, typeName(typeArg), subject)
    } has readonly field '${fieldName}' but record constraint requires a mutable field`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function mismatchedRecordField(
  param: GenericParam,
  typeArg: TypeRef,
  fieldPath: Str,
  expected: RecordField,
  actual: RecordField,
  span: Diagnostic["span"],
  subject?: ConstraintSubject,
): Diagnostic {
  return {
    message: `${
      recordConstraintPrefix(param, typeName(typeArg), subject)
    } has field '${fieldPath}' of type '${typeName(actual.type)}' but record constraint requires '${
      typeName(expected.type)
    }'`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function missingMethodMessage(
  param: GenericParam,
  typeArgName: Str,
  interfaceName: Str,
  methodName: Str,
  subject?: ConstraintSubject,
): Str {
  return `${
    constraintMessage(param, typeArgName, interfaceName, subject)
  }: missing method '${methodName}'`;
}

function constraintMessage(
  param: GenericParam,
  typeArgName: Str,
  interfaceName: Str,
  subject?: ConstraintSubject,
): Str {
  if (!subject) return `Type '${typeArgName}' does not satisfy '${interfaceName}'`;
  return `Generic ${subject.kind} '${subject.name}' type parameter '${param.name}' with type '${typeArgName}' does not satisfy interface '${interfaceName}'`;
}

function literalConstraintMessage(
  param: GenericParam,
  typeArgName: Str,
  constraintName: Str,
  subject?: ConstraintSubject,
): Str {
  if (!subject) return `Type '${typeArgName}' does not satisfy '${constraintName}'`;
  return `Generic ${subject.kind} '${subject.name}' type parameter '${param.name}' with type '${typeArgName}' does not satisfy ${constraintName}`;
}

function recordConstraintMessage(
  param: GenericParam,
  typeArgName: Str,
  subject?: ConstraintSubject,
): Str {
  return `${recordConstraintPrefix(param, typeArgName, subject)} does not satisfy record shape`;
}

function recordConstraintPrefix(
  param: GenericParam,
  typeArgName: Str,
  subject?: ConstraintSubject,
): Str {
  if (!subject) return `Type '${typeArgName}'`;
  return `Generic ${subject.kind} '${subject.name}' type parameter '${param.name}' with type '${typeArgName}'`;
}

function missingInterfaceMethods(
  typeNameText: Str,
  interfaceDecl: InterfaceDecl,
  functions: FunctionDecl[],
): Str[] {
  const missing: Str[] = [];
  for (const method of interfaceDecl.methods) {
    const fn = functions.find((candidate) => candidate.name === `${typeNameText}.${method.name}`);
    if (!fn || !methodSignatureMatches(fn, method)) missing.push(method.name);
  }
  return missing;
}

function methodSignatureMatches(
  fn: FunctionDecl,
  method: InterfaceDecl["methods"][usize],
): b8 {
  const params = fn.params.slice(1);
  if (params.length !== method.params.length) return false;
  if (typeName(fn.returnType) !== typeName(method.returnType)) return false;
  return params.every((param, index) =>
    typeName(param.type) === typeName(method.params[index].type)
  );
}
