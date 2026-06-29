import type {
  CastArrayDestructureStmt,
  CastAssignmentStmt,
  CastBlockStmt,
  CastCallExpr,
  CastClassDecl,
  CastConstDecl,
  CastEnumDecl,
  CastExpression,
  CastForStmt,
  CastFunctionDecl,
  CastFunctionTypeRef,
  CastIfStmt,
  CastImportDecl,
  CastInterfaceDecl,
  CastMethodCallExpr,
  CastNewExpr,
  CastOptionalMethodCallExpr,
  CastParam,
  CastProgram,
  CastRecordLiteralEntry,
  CastRecordRestStmt,
  CastRecordTypeRef,
  CastStatement,
  CastStructDecl,
  CastSwitchStmt,
  CastTaggedUnionDecl,
  CastTypeAliasDecl,
  CastTypeRef,
  CastVarDeclStmt,
} from "core/cast.ts";
import {
  DUPLICATE_GENERIC_PARAMETER,
  GENERIC_CONSTRAINT_INVALID,
  GENERIC_CONSTRAINT_UNSATISFIED,
  GENERIC_INSTANTIATION_CYCLE,
  GENERIC_INTERFACE_VALUE_TYPE,
  GENERIC_TYPE_ARGUMENT_ARITY,
  GENERIC_UNKNOWN_TYPE,
} from "core/diagnostic_codes.ts";
import type { Diagnostic } from "core/diagnostics.ts";
import { TypeCError } from "core/diagnostics.ts";
import { primitiveTypes } from "core/token.ts";
import { typeName } from "core/type_ref.ts";
import { lowerTypeRef } from "lower/types.ts";

type Str = string;
type b8 = boolean;
type usize = number;

type TypeSubstitutions = Map<Str, CastTypeRef>;

export function instantiateGenericTypeAliases(program: CastProgram): CastProgram {
  const templates = genericTypeAliasTemplates(program.typeAliases);
  if (templates.size === 0) return program;
  const diagnostics = duplicateGenericParamDiagnostics(program.typeAliases);
  if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  const instantiator = new GenericTypeAliasInstantiator(
    templates,
    concreteTypeAliasMap(program.typeAliases),
    program.interfaces ?? [],
    program.classes ?? [],
    program.enums ?? [],
    program.structs ?? [],
    program.taggedUnions ?? [],
  );
  return instantiator.rewriteProgram(program);
}

function genericTypeAliasTemplates(typeAliases: CastTypeAliasDecl[]): Map<Str, CastTypeAliasDecl> {
  const templates = new Map<Str, CastTypeAliasDecl>();
  for (const alias of typeAliases) {
    if ((alias.genericParams ?? []).length > 0) templates.set(alias.name, alias);
  }
  return templates;
}

function concreteTypeAliasMap(typeAliases: CastTypeAliasDecl[]): Map<Str, CastTypeAliasDecl> {
  const aliases = new Map<Str, CastTypeAliasDecl>();
  for (const alias of typeAliases) {
    if ((alias.genericParams ?? []).length === 0) aliases.set(alias.name, alias);
  }
  return aliases;
}

function duplicateGenericParamDiagnostics(typeAliases: CastTypeAliasDecl[]): Diagnostic[] {
  return typeAliases.flatMap(duplicateGenericParamsInAlias);
}

function duplicateGenericParamsInAlias(alias: CastTypeAliasDecl): Diagnostic[] {
  const names = new Set<Str>();
  const diagnostics: Diagnostic[] = [];
  for (const param of alias.genericParams ?? []) {
    if (names.has(param.name)) {
      diagnostics.push({
        message: `Duplicate generic parameter '${param.name}'`,
        code: DUPLICATE_GENERIC_PARAMETER,
        span: param.span,
      });
    }
    names.add(param.name);
  }
  return diagnostics;
}

function genericAliasConstraintDiagnostics(
  alias: CastTypeAliasDecl,
  typeArgs: CastTypeRef[],
  context: AliasConstraintContext,
  span: Diagnostic["span"],
): Diagnostic[] {
  const params = alias.genericParams ?? [];
  return params.flatMap((param, index) =>
    genericAliasConstraintDiagnostic(alias, param, typeArgs[index], context, span)
  );
}

interface AliasConstraintContext {
  interfaces: CastInterfaceDecl[];
  classes: CastClassDecl[];
  aliases: Map<Str, CastTypeAliasDecl>;
  templates: Map<Str, CastTypeAliasDecl>;
  enums: CastEnumDecl[];
  structs: CastStructDecl[];
  taggedUnions: CastTaggedUnionDecl[];
}

function genericAliasConstraintDiagnostic(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef | undefined,
  context: AliasConstraintContext,
  span: Diagnostic["span"],
): Diagnostic[] {
  const constraint = param.constraint ?? null;
  if (constraint === null || typeArg === undefined) return [];
  if (constraint.kind === "NamedTypeRef") {
    return namedAliasConstraintDiagnostic(alias, param, typeArg, constraint, context, span);
  }
  if (constraint.kind === "RecordTypeRef") {
    return recordAliasConstraintDiagnostic(alias, param, typeArg, constraint, context, span);
  }
  if (
    constraint.kind === "FixedArrayTypeRef" || constraint.kind === "TupleTypeRef" ||
    constraint.kind === "LiteralTypeRef"
  ) {
    return exactTypeRefAliasConstraintDiagnostic(alias, param, typeArg, constraint, span);
  }
  if (constraint.kind === "FunctionTypeRef") {
    return exactTypeRefAliasConstraintDiagnostic(alias, param, typeArg, constraint, span);
  }
  if (isPointerLikeConstraint(constraint)) {
    return exactTypeRefAliasConstraintDiagnostic(alias, param, typeArg, constraint, span);
  }
  return [invalidAliasConstraint(alias, param, span)];
}

function namedAliasConstraintDiagnostic(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  constraint: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
  context: AliasConstraintContext,
  span: Diagnostic["span"],
): Diagnostic[] {
  const interfaceDecl = context.interfaces.find((item) => item.name === constraint.name) ?? null;
  if (interfaceDecl === null) {
    return exactNamedAliasConstraintDiagnostic(alias, param, typeArg, constraint, context, span);
  }
  if (typeArg.kind !== "NamedTypeRef") {
    return [unsatisfiedAliasConstraint(alias, param, typeArg, interfaceDecl.name, span)];
  }
  if (context.interfaces.some((item) => item.name === typeArg.name)) {
    return [{
      message: `Interface value type '${typeArg.name}' is not implemented`,
      code: GENERIC_INTERFACE_VALUE_TYPE,
      span,
    }];
  }
  const classDecl = context.classes.find((item) => item.name === typeArg.name) ?? null;
  if (classDecl === null) {
    return primitiveTypes.has(typeArg.name)
      ? [unsatisfiedAliasConstraint(alias, param, typeArg, interfaceDecl.name, span)]
      : [{ message: `Unknown type '${typeArg.name}'`, code: GENERIC_UNKNOWN_TYPE, span }];
  }
  return classImplementsInterface(classDecl, interfaceDecl.name)
    ? []
    : [unsatisfiedAliasConstraint(alias, param, typeArg, interfaceDecl.name, span)];
}

function exactNamedAliasConstraintDiagnostic(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  constraint: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
  context: AliasConstraintContext,
  span: Diagnostic["span"],
): Diagnostic[] {
  if (!isKnownExactNamedConstraint(constraint, context)) {
    return [invalidAliasConstraint(alias, param, span)];
  }
  return sameNamedConstraintType(typeArg, constraint, context)
    ? []
    : [unsatisfiedAliasConstraint(alias, param, typeArg, typeName(lowerTypeRef(constraint)), span)];
}

function isKnownExactNamedConstraint(
  constraint: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
  context: AliasConstraintContext,
): b8 {
  return exactNamedConstraintName(constraint, context) !== null;
}

function sameNamedConstraintType(
  typeArg: CastTypeRef,
  constraint: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
  context: AliasConstraintContext,
): b8 {
  const expected = exactNamedConstraintName(constraint, context);
  return expected !== null && typeArg.kind === "NamedTypeRef" &&
    typeName(lowerTypeRef(typeArg)) === expected;
}

function exactNamedConstraintName(
  constraint: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
  context: AliasConstraintContext,
): Str | null {
  if (isExactOptionalConstraint(constraint)) return typeName(lowerTypeRef(constraint));
  const template = context.templates.get(constraint.name) ?? null;
  if (template !== null) return exactGenericConstraintName(template, constraint);
  if (constraint.typeArgs !== undefined) return null;
  return primitiveTypes.has(constraint.name) || context.aliases.has(constraint.name) ||
      context.classes.some((item) => item.name === constraint.name) ||
      context.enums.some((item) => item.name === constraint.name) ||
      context.structs.some((item) => item.name === constraint.name) ||
      context.taggedUnions.some((item) => item.name === constraint.name)
    ? constraint.name
    : null;
}

function exactGenericConstraintName(
  template: CastTypeAliasDecl,
  constraint: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
): Str | null {
  const typeArgs = constraint.typeArgs ?? [];
  const expected = template.genericParams?.length ?? 0;
  return typeArgs.length === expected ? genericAliasName(template.name, typeArgs) : null;
}

function isExactOptionalConstraint(
  constraint: Extract<CastTypeRef, { kind: "NamedTypeRef" }>,
): b8 {
  return constraint.name === "Optional" && (constraint.typeArgs ?? []).length === 1;
}

function exactTypeRefAliasConstraintDiagnostic(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  constraint: CastTypeRef,
  span: Diagnostic["span"],
): Diagnostic[] {
  return sameExactType(typeArg, constraint)
    ? []
    : [unsatisfiedAliasConstraint(alias, param, typeArg, typeName(lowerTypeRef(constraint)), span)];
}

function isPointerLikeConstraint(constraint: CastTypeRef): b8 {
  return constraint.kind === "PointerTypeRef" || constraint.kind === "ReferenceTypeRef" ||
    constraint.kind === "SafePointerTypeRef" || constraint.kind === "SliceTypeRef";
}

function sameExactType(left: CastTypeRef, right: CastTypeRef): b8 {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
      return sameExactElementType(left, right);
    case "FixedArrayTypeRef":
      return sameExactFixedArrayType(left, right);
    case "TupleTypeRef":
      return sameExactTupleType(left, right);
    case "FunctionTypeRef":
      return sameExactFunctionType(left, right);
    default:
      return typeName(lowerTypeRef(left)) === typeName(lowerTypeRef(right));
  }
}

function sameExactElementType(left: CastTypeRef, right: CastTypeRef): b8 {
  if (!("element" in left) || !("element" in right)) return false;
  return sameExactType(left.element, right.element);
}

function sameExactFixedArrayType(left: CastTypeRef, right: CastTypeRef): b8 {
  if (left.kind !== "FixedArrayTypeRef" || right.kind !== "FixedArrayTypeRef") return false;
  return left.sizeText === right.sizeText && sameExactType(left.element, right.element);
}

function sameExactTupleType(left: CastTypeRef, right: CastTypeRef): b8 {
  if (left.kind !== "TupleTypeRef" || right.kind !== "TupleTypeRef") return false;
  if (left.elements.length !== right.elements.length) return false;
  return left.elements.every((element, index) => sameExactType(element, right.elements[index]!));
}

function sameExactFunctionType(left: CastTypeRef, right: CastTypeRef): b8 {
  if (left.kind !== "FunctionTypeRef" || right.kind !== "FunctionTypeRef") return false;
  if (left.params.length !== right.params.length) return false;
  if (!sameExactType(left.returnType, right.returnType)) return false;
  return left.params.every((param, index) => sameExactType(param.type, right.params[index]!.type));
}

function classImplementsInterface(classDecl: CastClassDecl, interfaceName: Str): b8 {
  return (classDecl.implements ?? []).some((type) =>
    type.kind === "NamedTypeRef" && type.name === interfaceName
  );
}

function recordAliasConstraintDiagnostic(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  constraint: CastRecordTypeRef,
  context: AliasConstraintContext,
  span: Diagnostic["span"],
): Diagnostic[] {
  const actual = recordConstraintSubject(typeArg, context);
  if (actual === null) {
    return [unsatisfiedAliasConstraint(alias, param, typeArg, "record shape", span)];
  }
  return recordShapeMismatches(constraint, actual, context).map((mismatch) =>
    recordConstraintMismatch(alias, param, typeArg, mismatch, span)
  );
}

function recordConstraintSubject(
  typeArg: CastTypeRef,
  context: AliasConstraintContext,
): CastRecordTypeRef | null {
  if (typeArg.kind === "RecordTypeRef") return typeArg;
  if (typeArg.kind !== "NamedTypeRef") return null;
  const alias = context.aliases.get(typeArg.name) ?? null;
  if (alias?.type.kind === "RecordTypeRef") return alias.type;
  const classDecl = context.classes.find((item) => item.name === typeArg.name) ?? null;
  if (classDecl !== null) return classRecordType(classDecl);
  const structDecl = context.structs.find((item) => item.name === typeArg.name) ?? null;
  return structDecl === null ? null : structRecordType(structDecl);
}

function classRecordType(classDecl: CastClassDecl): CastRecordTypeRef {
  return {
    kind: "RecordTypeRef",
    fields: classDecl.fields.map((field) => ({
      name: field.name,
      readonly: field.readonly,
      optional: false,
      type: field.type,
      span: field.span,
    })),
    span: classDecl.span,
  };
}

function structRecordType(structDecl: CastStructDecl): CastRecordTypeRef {
  return { kind: "RecordTypeRef", fields: structDecl.fields, span: structDecl.span };
}

type RecordConstraintField = CastRecordTypeRef["fields"][usize];

type RecordShapeMismatch =
  | { kind: "MissingField"; path: Str; expected: RecordConstraintField }
  | {
    kind: "RequiredFieldOptional";
    path: Str;
    expected: RecordConstraintField;
    actual: RecordConstraintField;
  }
  | {
    kind: "ReadonlyFieldMutable";
    path: Str;
    expected: RecordConstraintField;
    actual: RecordConstraintField;
  }
  | {
    kind: "FieldTypeMismatch";
    path: Str;
    expected: RecordConstraintField;
    actual: RecordConstraintField;
  };

function recordShapeMismatches(
  expected: CastRecordTypeRef,
  actual: CastRecordTypeRef,
  context: AliasConstraintContext,
  prefix: Str = "",
): RecordShapeMismatch[] {
  return expected.fields.flatMap((field) => recordFieldMismatches(field, actual, context, prefix));
}

function recordFieldMismatches(
  expected: RecordConstraintField,
  actual: CastRecordTypeRef,
  context: AliasConstraintContext,
  prefix: Str,
): RecordShapeMismatch[] {
  const fieldPath = recordFieldPath(prefix, expected.name);
  const field = actual.fields.find((item) => item.name === expected.name) ?? null;
  if (field === null) {
    return expected.optional ? [] : [{ kind: "MissingField", path: fieldPath, expected }];
  }
  if (!expected.optional && field.optional) {
    return [{ kind: "RequiredFieldOptional", path: fieldPath, expected, actual: field }];
  }
  if (!expected.readonly && field.readonly) {
    return [{ kind: "ReadonlyFieldMutable", path: fieldPath, expected, actual: field }];
  }
  return recordFieldTypeMismatches(expected, field, context, fieldPath);
}

function recordFieldPath(prefix: Str, name: Str): Str {
  return prefix.length === 0 ? name : `${prefix}.${name}`;
}

function recordFieldTypeMismatches(
  expected: RecordConstraintField,
  actual: RecordConstraintField,
  context: AliasConstraintContext,
  path: Str,
): RecordShapeMismatch[] {
  if (expected.type.kind === "RecordTypeRef") {
    const actualRecord = recordConstraintSubject(actual.type, context);
    if (actualRecord === null) return [{ kind: "FieldTypeMismatch", path, expected, actual }];
    return recordShapeMismatches(expected.type, actualRecord, context, path);
  }
  return sameRecordFieldType(expected, actual)
    ? []
    : [{ kind: "FieldTypeMismatch", path, expected, actual }];
}

function sameRecordFieldType(
  expected: RecordConstraintField,
  actual: RecordConstraintField,
): b8 {
  return typeName(lowerTypeRef(actual.type)) === typeName(lowerTypeRef(expected.type));
}

function recordConstraintMismatch(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  mismatch: RecordShapeMismatch,
  span: Diagnostic["span"],
): Diagnostic {
  if (mismatch.kind === "MissingField") {
    return missingRecordConstraintField(alias, param, typeArg, mismatch.path, span);
  }
  if (mismatch.kind === "RequiredFieldOptional") {
    return optionalRecordConstraintField(alias, param, typeArg, mismatch.path, span);
  }
  if (mismatch.kind === "ReadonlyFieldMutable") {
    return readonlyRecordConstraintField(alias, param, typeArg, mismatch.path, span);
  }
  return mismatchedRecordConstraintField(
    alias,
    param,
    typeArg,
    mismatch.path,
    mismatch.expected,
    mismatch.actual,
    span,
  );
}

function readonlyRecordConstraintField(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  path: Str,
  span: Diagnostic["span"],
): Diagnostic {
  return {
    message: `Generic type alias '${alias.name}' type parameter '${param.name}' with type '${
      typeName(lowerTypeRef(typeArg))
    }' has readonly field '${path}' but record constraint requires a mutable field`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function optionalRecordConstraintField(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  path: Str,
  span: Diagnostic["span"],
): Diagnostic {
  return {
    message: `Generic type alias '${alias.name}' type parameter '${param.name}' with type '${
      typeName(lowerTypeRef(typeArg))
    }' has optional field '${path}' but record constraint requires it`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function missingRecordConstraintField(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  path: Str,
  span: Diagnostic["span"],
): Diagnostic {
  return {
    message: `Generic type alias '${alias.name}' type parameter '${param.name}' with type '${
      typeName(lowerTypeRef(typeArg))
    }' is missing required field '${path}' for record constraint`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function mismatchedRecordConstraintField(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  path: Str,
  expected: RecordConstraintField,
  actual: RecordConstraintField,
  span: Diagnostic["span"],
): Diagnostic {
  return {
    message: `Generic type alias '${alias.name}' type parameter '${param.name}' with type '${
      typeName(lowerTypeRef(typeArg))
    }' has field '${path}' of type '${
      typeName(lowerTypeRef(actual.type))
    }' but record constraint requires '${typeName(lowerTypeRef(expected.type))}'`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

function invalidAliasConstraint(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  span: Diagnostic["span"],
): Diagnostic {
  return {
    message: `Invalid constraint for generic type alias '${alias.name}' parameter '${param.name}'`,
    code: GENERIC_CONSTRAINT_INVALID,
    span,
  };
}

function unsatisfiedAliasConstraint(
  alias: CastTypeAliasDecl,
  param: NonNullable<CastTypeAliasDecl["genericParams"]>[usize],
  typeArg: CastTypeRef,
  constraintName: Str,
  span: Diagnostic["span"],
): Diagnostic {
  return {
    message: `Generic type alias '${alias.name}' type parameter '${param.name}' with type '${
      typeName(lowerTypeRef(typeArg))
    }' does not satisfy ${constraintName}`,
    code: GENERIC_CONSTRAINT_UNSATISFIED,
    span,
  };
}

class GenericTypeAliasInstantiator {
  private emitted = new Map<Str, CastTypeAliasDecl>();
  private active = new Set<Str>();

  constructor(
    private templates: Map<Str, CastTypeAliasDecl>,
    private aliases: Map<Str, CastTypeAliasDecl>,
    private interfaces: CastInterfaceDecl[],
    private classes: CastClassDecl[],
    private enums: CastEnumDecl[],
    private structs: CastStructDecl[],
    private taggedUnions: CastTaggedUnionDecl[],
  ) {}

  rewriteProgram(program: CastProgram): CastProgram {
    const rewritten: CastProgram = {
      ...program,
      imports: program.imports.map((decl) => this.rewriteImport(decl)),
      typeAliases: program.typeAliases
        .filter((alias) => !this.templates.has(alias.name))
        .map((alias) => this.rewriteTypeAlias(alias)),
      structs: (program.structs ?? []).map((decl) => ({
        ...decl,
        fields: decl.fields.map((field) => ({ ...field, type: this.rewriteTypeRef(field.type) })),
      })),
      interfaces: (program.interfaces ?? []).map((decl) => this.rewriteInterface(decl)),
      taggedUnions: (program.taggedUnions ?? []).map((decl) => this.rewriteTaggedUnion(decl)),
      constants: (program.constants ?? []).map((decl) => this.rewriteConst(decl)),
      classes: (program.classes ?? []).map((decl) => this.rewriteClass(decl)),
      functions: program.functions.map((decl) => this.rewriteFunction(decl)),
    };
    return { ...rewritten, typeAliases: [...rewritten.typeAliases, ...this.emitted.values()] };
  }

  private rewriteImport(decl: CastImportDecl): CastImportDecl {
    return decl;
  }

  private rewriteTypeAlias(alias: CastTypeAliasDecl): CastTypeAliasDecl {
    return { ...alias, type: this.rewriteTypeRef(alias.type), genericParams: [] };
  }

  private rewriteInterface(decl: CastInterfaceDecl): CastInterfaceDecl {
    return {
      ...decl,
      methods: decl.methods.map((method) => ({
        ...method,
        params: method.params.map((param) => this.rewriteParam(param)),
        returnType: this.rewriteTypeRef(method.returnType),
      })),
    };
  }

  private rewriteTaggedUnion(decl: CastTaggedUnionDecl): CastTaggedUnionDecl {
    return {
      ...decl,
      variants: decl.variants.map((variant) => ({
        ...variant,
        payload: variant.payload ? this.rewriteTypeRef(variant.payload) : null,
      })),
    };
  }

  private rewriteConst(decl: CastConstDecl): CastConstDecl {
    return {
      ...decl,
      type: this.rewriteTypeRef(decl.type),
      initializer: this.rewriteExpression(decl.initializer),
    };
  }

  private rewriteClass(decl: CastClassDecl): CastClassDecl {
    return {
      ...decl,
      extends: decl.extends ? this.rewriteTypeRef(decl.extends) : null,
      implements: decl.implements?.map((type) => this.rewriteTypeRef(type)) ?? [],
      fields: decl.fields.map((field) => ({
        ...field,
        type: this.rewriteTypeRef(field.type),
        initializer: field.initializer ? this.rewriteExpression(field.initializer) : null,
      })),
      constructorDecl: decl.constructorDecl
        ? {
          ...decl.constructorDecl,
          params: decl.constructorDecl.params.map((param) => this.rewriteParam(param)),
          body: this.rewriteBlock(decl.constructorDecl.body),
        }
        : null,
      methods: decl.methods.map((method) => ({
        ...method,
        params: method.params.map((param) => this.rewriteParam(param)),
        returnType: this.rewriteTypeRef(method.returnType),
        body: this.rewriteBlock(method.body),
      })),
    };
  }

  private rewriteFunction(decl: CastFunctionDecl): CastFunctionDecl {
    return {
      ...decl,
      params: decl.params.map((param) => this.rewriteParam(param)),
      returnType: this.rewriteTypeRef(decl.returnType),
      body: decl.body ? this.rewriteBlock(decl.body) : null,
    };
  }

  private rewriteParam(param: CastParam): CastParam {
    return { ...param, type: this.rewriteTypeRef(param.type) };
  }

  private rewriteBlock(block: CastBlockStmt): CastBlockStmt {
    return { ...block, statements: block.statements.map((stmt) => this.rewriteStatement(stmt)) };
  }

  private rewriteStatement(statement: CastStatement): CastStatement {
    switch (statement.kind) {
      case "EmptyStmt":
      case "BreakStmt":
      case "ContinueStmt":
        return statement;
      case "ReturnStmt":
        return statement.expression
          ? { ...statement, expression: this.rewriteExpression(statement.expression) }
          : statement;
      case "DeferStmt":
      case "ExpressionStmt":
        return { ...statement, expression: this.rewriteExpression(statement.expression) };
      case "VarDeclStmt":
        return this.rewriteVarDecl(statement);
      case "AssignmentStmt":
        return this.rewriteAssignment(statement);
      case "IncDecStmt":
        return {
          ...statement,
          target: this.rewriteExpression(statement.target) as typeof statement.target,
        };
      case "RecordRestStmt":
        return this.rewriteRecordRest(statement);
      case "ArrayDestructureStmt":
        return this.rewriteArrayDestructure(statement);
      case "SwitchStmt":
        return this.rewriteSwitch(statement);
      case "WhileStmt":
      case "DoWhileStmt":
        return {
          ...statement,
          condition: this.rewriteExpression(statement.condition),
          body: this.rewriteBlock(statement.body),
        };
      case "ForStmt":
        return this.rewriteFor(statement);
      case "ForOfStmt":
      case "ForInStmt":
        return {
          ...statement,
          iterable: this.rewriteExpression(statement.iterable),
          body: this.rewriteBlock(statement.body),
        };
      case "IfStmt":
        return this.rewriteIf(statement);
    }
  }

  private rewriteVarDecl(statement: CastVarDeclStmt): CastVarDeclStmt {
    return {
      ...statement,
      type: statement.type ? this.rewriteTypeRef(statement.type) : null,
      initializer: this.rewriteExpression(statement.initializer),
    };
  }

  private rewriteAssignment(statement: CastAssignmentStmt): CastAssignmentStmt {
    return {
      ...statement,
      target: this.rewriteExpression(statement.target) as typeof statement.target,
      expression: this.rewriteExpression(statement.expression),
    };
  }

  private rewriteRecordRest(statement: CastRecordRestStmt): CastRecordRestStmt {
    return { ...statement, source: this.rewriteExpression(statement.source) };
  }

  private rewriteArrayDestructure(statement: CastArrayDestructureStmt): CastArrayDestructureStmt {
    return { ...statement, source: this.rewriteExpression(statement.source) };
  }

  private rewriteSwitch(statement: CastSwitchStmt): CastSwitchStmt {
    return {
      ...statement,
      expression: this.rewriteExpression(statement.expression),
      cases: statement.cases.map((item) => ({
        ...item,
        labels: item.labels.map((label) => this.rewriteExpression(label)),
        statements: item.statements.map((stmt) => this.rewriteStatement(stmt)),
      })),
      defaultCase: statement.defaultCase
        ? {
          ...statement.defaultCase,
          statements: statement.defaultCase.statements.map((stmt) => this.rewriteStatement(stmt)),
        }
        : null,
    };
  }

  private rewriteFor(statement: CastForStmt): CastForStmt {
    return {
      ...statement,
      initializer: statement.initializer
        ? this.rewriteStatement(statement.initializer) as CastForStmt["initializer"]
        : null,
      condition: this.rewriteExpression(statement.condition),
      update: statement.update
        ? this.rewriteStatement(statement.update) as CastForStmt["update"]
        : null,
      body: this.rewriteBlock(statement.body),
    };
  }

  private rewriteIf(statement: CastIfStmt): CastIfStmt {
    return {
      ...statement,
      condition: this.rewriteExpression(statement.condition),
      thenBody: this.rewriteBlock(statement.thenBody),
      elseBody: statement.elseBody ? this.rewriteBlock(statement.elseBody) : null,
    };
  }

  private rewriteExpression(expression: CastExpression): CastExpression {
    switch (expression.kind) {
      case "IntegerLiteral":
      case "FloatLiteral":
      case "BoolLiteral":
      case "ZeroValueExpr":
      case "StringLiteral":
      case "IdentifierExpr":
        return expression;
      case "ArrowFunctionExpr":
        return { ...expression, body: this.rewriteExpression(expression.body) };
      case "UnaryExpr":
      case "PostfixPointerExpr":
      case "NonNullAssertExpr":
        return { ...expression, operand: this.rewriteExpression(expression.operand) };
      case "BinaryExpr":
        return {
          ...expression,
          left: this.rewriteExpression(expression.left),
          right: this.rewriteExpression(expression.right),
        };
      case "ConditionalExpr":
        return {
          ...expression,
          condition: this.rewriteExpression(expression.condition),
          whenTrue: this.rewriteExpression(expression.whenTrue),
          whenFalse: this.rewriteExpression(expression.whenFalse),
        };
      case "NullishCoalesceExpr":
        return {
          ...expression,
          left: this.rewriteExpression(expression.left),
          fallback: this.rewriteExpression(expression.fallback),
        };
      case "CastExpr":
      case "SatisfiesExpr":
        return {
          ...expression,
          type: this.rewriteTypeRef(expression.type),
          expression: this.rewriteExpression(expression.expression),
        };
      case "CallExpr":
        return this.rewriteCall(expression);
      case "NewExpr":
        return this.rewriteNew(expression);
      case "MethodCallExpr":
      case "OptionalMethodCallExpr":
        return this.rewriteMethodCall(expression);
      case "FieldAccessExpr":
      case "OptionalFieldAccessExpr":
        return { ...expression, operand: this.rewriteExpression(expression.operand) };
      case "OptionalIndexExpr":
      case "IndexExpr":
        return {
          ...expression,
          operand: this.rewriteExpression(expression.operand),
          index: this.rewriteExpression(expression.index),
        };
      case "RecordLiteralExpr":
        return {
          ...expression,
          fields: expression.fields.map((field) => this.rewriteRecordField(field)),
        };
      case "ArrayLiteralExpr":
        return {
          ...expression,
          elements: expression.elements.map((item) => this.rewriteExpression(item)),
        };
    }
  }

  private rewriteCall(expression: CastCallExpr): CastCallExpr {
    return {
      ...expression,
      typeArgs: expression.typeArgs?.map((type) => this.rewriteTypeRef(type)),
      args: expression.args.map((arg) => this.rewriteExpression(arg)),
    };
  }

  private rewriteNew(expression: CastNewExpr): CastNewExpr {
    return {
      ...expression,
      typeArgs: expression.typeArgs?.map((type) => this.rewriteTypeRef(type)),
      args: expression.args.map((arg) => this.rewriteExpression(arg)),
    };
  }

  private rewriteMethodCall<T extends CastMethodCallExpr | CastOptionalMethodCallExpr>(
    expression: T,
  ): T {
    return {
      ...expression,
      receiver: this.rewriteExpression(expression.receiver),
      args: expression.args.map((arg) => this.rewriteExpression(arg)),
    };
  }

  private rewriteRecordField(field: CastRecordLiteralEntry): CastRecordLiteralEntry {
    return { ...field, expression: this.rewriteExpression(field.expression) };
  }

  private rewriteTypeRef(type: CastTypeRef): CastTypeRef {
    switch (type.kind) {
      case "NamedTypeRef":
        return this.rewriteNamedTypeRef(type);
      case "PointerTypeRef":
      case "ReferenceTypeRef":
      case "SafePointerTypeRef":
      case "SliceTypeRef":
      case "InferredArrayTypeRef":
        return { ...type, element: this.rewriteTypeRef(type.element) };
      case "FixedArrayTypeRef":
        return { ...type, element: this.rewriteTypeRef(type.element) };
      case "FunctionTypeRef":
        return this.rewriteFunctionType(type);
      case "TupleTypeRef":
        return { ...type, elements: type.elements.map((item) => this.rewriteTypeRef(item)) };
      case "UnionTypeRef":
      case "IntersectionTypeRef":
        return { ...type, members: type.members.map((item) => this.rewriteTypeRef(item)) };
      case "ConditionalTypeRef":
        return {
          ...type,
          checkType: this.rewriteTypeRef(type.checkType),
          extendsType: this.rewriteTypeRef(type.extendsType),
          trueType: this.rewriteTypeRef(type.trueType),
          falseType: this.rewriteTypeRef(type.falseType),
        };
      case "IndexedAccessTypeRef":
        return { ...type, objectType: this.rewriteTypeRef(type.objectType) };
      case "MappedTypeRef":
        return {
          ...type,
          sourceType: this.rewriteTypeRef(type.sourceType),
          valueType: this.rewriteTypeRef(type.valueType),
        };
      case "KeyofTypeRef":
        return { ...type, target: this.rewriteTypeRef(type.target) };
      case "TypeofTypeRef":
      case "LiteralTypeRef":
        return type;
      case "RecordTypeRef":
        return this.rewriteRecordType(type);
    }
  }

  private rewriteNamedTypeRef(type: Extract<CastTypeRef, { kind: "NamedTypeRef" }>): CastTypeRef {
    const typeArgs = type.typeArgs?.map((arg) => this.rewriteTypeRef(arg)) ?? [];
    const template = this.templates.get(type.name) ?? null;
    if (template === null) return type.typeArgs === undefined ? type : { ...type, typeArgs };
    this.checkTypeArgCount(template, typeArgs, type.span);
    this.checkConstraints(template, typeArgs, type.span);
    const name = genericAliasName(template.name, typeArgs);
    this.checkInstantiationCycle(template.name, name, type.span);
    if (!this.emitted.has(name)) this.emitAliasInstantiation(template, typeArgs, name, type.span);
    return { kind: "NamedTypeRef", name, span: type.span };
  }

  private checkTypeArgCount(
    template: CastTypeAliasDecl,
    typeArgs: CastTypeRef[],
    span: CastTypeRef["span"],
  ): void {
    const expected = template.genericParams?.length ?? 0;
    if (typeArgs.length === expected) return;
    throw new TypeCError([{
      message: `Generic type alias '${template.name}' expects ${expected} type argument(s)`,
      code: GENERIC_TYPE_ARGUMENT_ARITY,
      span,
    }]);
  }

  private checkConstraints(
    template: CastTypeAliasDecl,
    typeArgs: CastTypeRef[],
    span: CastTypeRef["span"],
  ): void {
    const diagnostics = genericAliasConstraintDiagnostics(
      template,
      typeArgs,
      this.constraintContext(),
      span,
    );
    if (diagnostics.length > 0) throw new TypeCError(diagnostics);
  }

  private constraintContext(): AliasConstraintContext {
    return {
      interfaces: this.interfaces,
      classes: this.classes,
      aliases: new Map([...this.aliases, ...this.emitted]),
      templates: this.templates,
      enums: this.enums,
      structs: this.structs,
      taggedUnions: this.taggedUnions,
    };
  }

  private emitAliasInstantiation(
    template: CastTypeAliasDecl,
    typeArgs: CastTypeRef[],
    name: Str,
    span: CastTypeRef["span"],
  ): void {
    this.checkInstantiationCycle(template.name, name, span);
    this.active.add(name);
    try {
      const substituted = instantiateAlias(template, typeArgs, name);
      this.emitted.set(name, substituted);
      const rewritten = { ...substituted, type: this.rewriteTypeRef(substituted.type) };
      this.emitted.delete(name);
      this.emitted.set(name, rewritten);
    } finally {
      this.active.delete(name);
    }
  }

  private checkInstantiationCycle(templateName: Str, name: Str, span: CastTypeRef["span"]): void {
    if (!this.active.has(name)) return;
    throw new TypeCError([{
      message: `Recursive generic instantiation cycle involving type alias '${templateName}'`,
      code: GENERIC_INSTANTIATION_CYCLE,
      span,
    }]);
  }

  private rewriteFunctionType(type: CastFunctionTypeRef): CastFunctionTypeRef {
    return {
      ...type,
      params: type.params.map((param) => this.rewriteParam(param)),
      returnType: this.rewriteTypeRef(type.returnType),
    };
  }

  private rewriteRecordType(type: CastRecordTypeRef): CastRecordTypeRef {
    return {
      ...type,
      fields: type.fields.map((field) => ({ ...field, type: this.rewriteTypeRef(field.type) })),
    };
  }
}

function instantiateAlias(
  template: CastTypeAliasDecl,
  typeArgs: CastTypeRef[],
  name: Str,
): CastTypeAliasDecl {
  return {
    ...template,
    name,
    cName: name,
    generated: true,
    genericParams: [],
    type: substituteTypeRef(template.type, aliasSubstitutions(template, typeArgs)),
  };
}

function aliasSubstitutions(
  template: CastTypeAliasDecl,
  typeArgs: CastTypeRef[],
): TypeSubstitutions {
  const substitutions = new Map<Str, CastTypeRef>();
  const params = template.genericParams ?? [];
  for (let index: usize = 0; index < params.length; index += 1) {
    const typeArg = typeArgs[index];
    if (typeArg) substitutions.set(params[index]!.name, typeArg);
  }
  return substitutions;
}

function substituteTypeRef(type: CastTypeRef, substitutions: TypeSubstitutions): CastTypeRef {
  if (type.kind === "NamedTypeRef") {
    const substituted = substitutions.get(type.name) ?? null;
    if (substituted !== null) return substituted;
    const typeArgs = type.typeArgs?.map((arg) => substituteTypeRef(arg, substitutions));
    return typeArgs === undefined ? type : { ...type, typeArgs };
  }
  return substituteTypeChildren(type, (child) => substituteTypeRef(child, substitutions));
}

function substituteTypeChildren(
  type: CastTypeRef,
  rewrite: (type: CastTypeRef) => CastTypeRef,
): CastTypeRef {
  switch (type.kind) {
    case "NamedTypeRef":
      return type;
    case "PointerTypeRef":
    case "ReferenceTypeRef":
    case "SafePointerTypeRef":
    case "SliceTypeRef":
    case "InferredArrayTypeRef":
      return { ...type, element: rewrite(type.element) };
    case "FixedArrayTypeRef":
      return { ...type, element: rewrite(type.element) };
    case "FunctionTypeRef":
      return {
        ...type,
        params: type.params.map((param) => ({ ...param, type: rewrite(param.type) })),
        returnType: rewrite(type.returnType),
      };
    case "TupleTypeRef":
      return { ...type, elements: type.elements.map(rewrite) };
    case "UnionTypeRef":
    case "IntersectionTypeRef":
      return { ...type, members: type.members.map(rewrite) };
    case "ConditionalTypeRef":
      return {
        ...type,
        checkType: rewrite(type.checkType),
        extendsType: rewrite(type.extendsType),
        trueType: rewrite(type.trueType),
        falseType: rewrite(type.falseType),
      };
    case "IndexedAccessTypeRef":
      return { ...type, objectType: rewrite(type.objectType) };
    case "MappedTypeRef":
      return { ...type, sourceType: rewrite(type.sourceType), valueType: rewrite(type.valueType) };
    case "KeyofTypeRef":
      return { ...type, target: rewrite(type.target) };
    case "TypeofTypeRef":
    case "LiteralTypeRef":
      return type;
    case "RecordTypeRef":
      return {
        ...type,
        fields: type.fields.map((field) => ({ ...field, type: rewrite(field.type) })),
      };
  }
}

function genericAliasName(name: Str, typeArgs: CastTypeRef[]): Str {
  return `${name}_${typeArgs.map(typeArgName).join("_")}`;
}

function typeArgName(typeArg: CastTypeRef): Str {
  return sanitizeTypeName(typeName(lowerTypeRef(typeArg)));
}

function sanitizeTypeName(value: Str): Str {
  const sanitized = value.replace(/[^A-Za-z0-9_]/g, "_").replace(/_+/g, "_");
  return sanitized.replace(/^_+|_+$/g, "");
}
